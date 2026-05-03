import pandas as pd
import numpy as np
import re
from io import BytesIO

# Palabras clave para detectar si una fila es un encabezado real
HEADER_KEYWORDS = [
    'proyecto', 'gerencia', 'avance', 'estado', 'presupuesto', 
    'cartera', 'lider', 'líder', 'fecha', 'seguimiento'
]

# Diccionario para mapear variaciones de columnas a nombres estándar
COLUMN_MAPPING = {
    'nombre del proyecto': 'Nombre del Proyecto',
    'proyecto': 'Nombre del Proyecto',
    'proyectos priorizados': 'Nombre del Proyecto',
    'gerencia lider': 'Gerencia Líder',
    'gerencia líder': 'Gerencia Líder',
    'gerencia': 'Gerencia Líder',
    'lider del proyecto': 'Líder del Proyecto',
    'líder del proyecto': 'Líder del Proyecto',
    'usuario funcional': 'Usuario Funcional',
    'gestor de planeamiento': 'Gestor de Planeamiento',
    'presupuesto asignado': 'Presupuesto asignado',
    'presupuesto': 'Presupuesto asignado',
    'n° solicitudes de cambio': 'N° Solicitudes de cambio',
    'solicitudes de cambio': 'N° Solicitudes de cambio',
    'n° solicitudes cambio': 'N° Solicitudes de cambio',
    'cartera': 'Cartera',
    'lider tecnico': 'Líder Técnico',
    'líder técnico': 'Líder Técnico',
    'fecha inicio': 'Fecha Inicio',
    'fecha fin': 'Fecha Fin',
    'avance planificado': '% Avance Planificado',
    '% avance planificado': '% Avance Planificado',
    'avance ejecutado': '% Avance Ejecutado',
    '% avance ejecutado': '% Avance Ejecutado',
    'estado proyecto ti': 'Estado Proyecto TI',
    'estado proyecto': 'Estado',
    'estado ti': 'Estado Proyecto TI',
    'estado del proyecto': 'Estado',
    'seguimiento opp': 'Seguimiento OPP',
    'seguimiento': 'Seguimiento',
    'pendientes': 'Pendientes',
    'responsable': 'Responsable',
    'fecha compromiso': 'Fecha Compromiso',
    'estado': 'Estado',
    'desv. %': 'Desviación'
}

def clean_column_name(col):
    """Limpia y normaliza un nombre de columna."""
    if pd.isna(col):
        return ""
    col_str = str(col).lower().strip()
    # Eliminar dobles espacios y saltos de línea
    col_str = re.sub(r'\s+', ' ', col_str)
    
    # Buscar coincidencia exacta en el mapeo
    if col_str in COLUMN_MAPPING:
        return COLUMN_MAPPING[col_str]
        
    # Búsqueda difusa simple
    for key, val in COLUMN_MAPPING.items():
        if key in col_str:
            return val
            
    # Si no hay mapeo, capitalizar y devolver
    return str(col).strip().title()

def find_header_row(df_raw, max_rows_to_check=30):
    """
    Analiza las primeras N filas para determinar cuál es el encabezado real de la tabla.
    Busca la fila con más coincidencias de palabras clave o más celdas no vacías.
    """
    best_row_idx = 0
    max_score = -1
    
    for i in range(min(max_rows_to_check, len(df_raw))):
        row = df_raw.iloc[i]
        # Filtrar celdas no vacías
        non_empty = row.dropna().astype(str).str.lower().str.strip()
        num_non_empty = len(non_empty)
        
        # Contar cuántas palabras clave contiene la fila
        keyword_matches = sum(1 for cell in non_empty for kw in HEADER_KEYWORDS if kw in cell)
        
        # Puntuación ponderada: prioriza palabras clave, pero también considera número de columnas
        score = (keyword_matches * 5) + num_non_empty
        
        if score > max_score and num_non_empty >= 3: # Asumir al menos 3 columnas para una tabla válida
            max_score = score
            best_row_idx = i
            
    return best_row_idx

def process_month_columns(df):
    """
    Detecta columnas de meses (ej. "Ene 2024", "Feb-24") y hace un unpivot (melt) 
    para convertirlas en filas ('Periodo', 'Avance').
    Devuelve un DataFrame adicional para tendencias.
    """
    # Regex para detectar nombres de meses o columnas tipo Ene-24, Feb 2024, %ENE 2024
    month_pattern = re.compile(r'^%?\s*(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*[-_\s]?20\d{2}$', re.IGNORECASE)

    
    id_vars = []
    value_vars = []
    
    for col in df.columns:
        if isinstance(col, str) and month_pattern.match(col.strip()):
            value_vars.append(col)
        else:
            id_vars.append(col)
            
    if not value_vars:
        return None # No se encontraron columnas de meses
        
    # Para la tabla unpivotada, solo necesitamos algunas columnas clave de contexto
    key_cols = [c for c in ['Nombre del Proyecto', 'Gerencia Líder', 'Cartera', 'Estado Proyecto TI'] if c in df.columns]
    
    if not key_cols and len(id_vars) > 0:
        key_cols = [id_vars[0]] # Tomar al menos la primera columna como ID
        
    # Filtrar id_vars para mantener la tabla de tendencias más liviana
    id_vars_filtered = [c for c in id_vars if c in key_cols]
        
    df_melted = pd.melt(
        df, 
        id_vars=id_vars_filtered, 
        value_vars=value_vars,
        var_name='Periodo',
        value_name='Avance Mensual'
    )
    
    # Limpiar NaN en la columna de valor
    df_melted = df_melted.dropna(subset=['Avance Mensual'])
    
    # Intentar parsear el mes y año para ordenarlo cronológicamente si es necesario
    return df_melted

def process_sheet(excel_file, sheet_name):
    """
    Procesa una hoja individual del Excel, detectando la tabla, 
    limpiando datos y estandarizando columnas.
    """
    try:
        # Leer primero sin encabezado para analizar todo
        df_raw = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
        
        if df_raw.empty:
            return pd.DataFrame(), None
            
        header_idx = find_header_row(df_raw)
        
        # Re-leer con el encabezado correcto (usamos iloc para más control)
        # Tomamos los nombres de columnas de la fila detectada
        columns_raw = df_raw.iloc[header_idx]
        
        # Cortar el dataframe desde la fila siguiente al encabezado
        df = df_raw.iloc[header_idx + 1:].copy()
        df.columns = columns_raw
        
        # Eliminar filas donde todos o casi todos los valores son nulos (filas vacías)
        df = df.dropna(how='all')
        
        # Eliminar columnas sin nombre
        df = df.loc[:, df.columns.notna()]
        
        # Normalizar nombres de columnas
        df.columns = [clean_column_name(col) for col in df.columns]
        
        # Manejo de duplicados en nombres de columnas después de normalizar
        cols = pd.Series(df.columns)
        for dup in cols[cols.duplicated()].unique(): 
            cols[cols[cols == dup].index.values.tolist()] = [dup + '_' + str(i) if i != 0 else dup for i in range(sum(cols == dup))]
        df.columns = cols
        
        # Columnas calculadas automáticas
        if '% Avance Planificado' in df.columns and '% Avance Ejecutado' in df.columns:
            # Asegurar numéricos. En excel pueden venir como "80%" en texto o flotantes
            for col in ['% Avance Planificado', '% Avance Ejecutado']:
                df[col] = pd.to_numeric(df[col].astype(str).str.replace('%', '', regex=False), errors='coerce').fillna(0)
            
            if 'Desviación' not in df.columns:
                df['Desviación'] = df['% Avance Planificado'] - df['% Avance Ejecutado']
            else:
                df['Desviación'] = pd.to_numeric(df['Desviación'].astype(str).str.replace('%', '', regex=False).str.replace('+', '', regex=False), errors='coerce').fillna(0)
            
            # Estado Automático si no existe uno de seguimiento
            if 'Estado Automático' not in df.columns:
                conditions = [
                    (df['Desviación'] <= 0),
                    (df['Desviación'] > 0) & (df['Desviación'] <= 5),
                    (df['Desviación'] > 5)
                ]
                choices = ['En tiempo', 'Alerta', 'Retrasado']
                df['Estado Automático'] = np.select(conditions, choices, default='Desconocido')
                
        # Procesar meses si los hay (hoja Pys Transf Digital)
        df_tendencia = process_month_columns(df)
        
        return df, df_tendencia
        
    except Exception as e:
        print(f"Error procesando hoja {sheet_name}: {str(e)}")
        return pd.DataFrame(), None

def load_and_clean_excel(file_buffer):
    """
    Función principal para cargar el Excel, obtener las hojas y procesarlas.
    """
    # Leer archivo de excel (nombres de hojas)
    xls = pd.ExcelFile(file_buffer)
    sheet_names = xls.sheet_names
    
    # Hojas esperadas usando los nombres reales del archivo del usuario
    expected_sheets = [
        'Portafolio P&D',
        'Demanda Estrategica CT', # Sin tilde, como en el excel
        'Pys Transf Digital',     # Esta es la que tiene los datos de tendencias
        'Seguimiento Semanal'
    ]
    
    results = {}
    tendencias_global = pd.DataFrame()
    
    for sheet in expected_sheets:
        # Búsqueda difusa de la hoja
        matched_sheet = None
        for name in sheet_names:
            # Normalizar sin acentos para la comparación
            name_norm = name.lower().replace('é', 'e').replace('&', 'y')
            sheet_norm = sheet.lower().replace('é', 'e').replace('&', 'y')
            if sheet_norm in name_norm or name_norm in sheet_norm:
                matched_sheet = name
                break
                
        if not matched_sheet:
            if sheet in sheet_names:
                matched_sheet = sheet
                
        if matched_sheet:
            df, df_tendencia = process_sheet(file_buffer, matched_sheet)
            
            # Guardamos con un nombre estándar interno para no romper las vistas
            key_name = sheet
            if sheet == 'Demanda Estrategica CT':
                key_name = 'Demanda Estratégica CT' # Las vistas esperan la tilde
            elif sheet == 'Pys Transf Digital':
                key_name = 'Tendencia del Proyecto' # Las vistas esperan este nombre
                
            results[key_name] = df
            
            # Consolidar tendencias si existen
            if df_tendencia is not None and not df_tendencia.empty:
                df_tendencia['Origen'] = sheet
                tendencias_global = pd.concat([tendencias_global, df_tendencia], ignore_index=True)
        else:
            results[sheet] = pd.DataFrame() # Hoja no encontrada
            
    # Agregar la tabla maestra de tendencias al resultado
    results['Tendencias Consolidado'] = tendencias_global
    
    return results, sheet_names
