import pandas as pd
import numpy as np

def create_dummy_excel(filename="dummy_data.xlsx"):
    # 1. Portafolio P&D (con basura arriba)
    data_port = {
        'Nombre del Proyecto': ['Portal Web', 'App Móvil', 'Migración Cloud', 'CRM', 'ERP'],
        'Gerencia Líder': ['Sistemas', 'Sistemas', 'Infra', 'Comercial', 'Finanzas'],
        'Cartera': ['Digital', 'Digital', 'Core', 'Ventas', 'Core'],
        'Presupuesto asignado': [50000, 120000, 80000, 45000, 200000],
        '% Avance Ejecutado': [100, 45, 80, 20, 10],
        '% Avance Planificado': [100, 60, 80, 20, 15]
    }
    df_port = pd.DataFrame(data_port)
    
    # Añadir filas basura arriba simulando un excel mal formateado
    df_port_dirty = pd.DataFrame(index=range(5), columns=df_port.columns)
    df_port_dirty.iloc[0, 0] = "REPORTE CONFIDENCIAL"
    df_port_dirty.iloc[1, 0] = "Generado el 2024-01-01"
    df_port_dirty.loc[5] = df_port.columns # El header real
    df_port_dirty = pd.concat([df_port_dirty, df_port]).reset_index(drop=True)
    
    # 2. Demanda Estratégica
    data_demanda = {
        'Proyecto': ['Integración SAP', 'BI Dashboard', 'Chatbot', 'Renovación Licencias'],
        'Estado': ['En Evaluación', 'Aprobado', 'En Ejecución', 'Cerrado'],
        'Gerencia': ['Finanzas', 'Data', 'Sistemas', 'Infra']
    }
    df_demanda = pd.DataFrame(data_demanda)
    
    # 3. Tendencia (con columnas de meses)
    data_tendencia = {
        'Nombre del Proyecto': ['Portal Web', 'App Móvil', 'Migración Cloud'],
        'Gerencia Líder': ['Sistemas', 'Sistemas', 'Infra'],
        'Ene 2024': [10, 5, 20],
        'Feb 2024': [30, 10, 40],
        'Mar 2024': [60, 20, 60],
        'Abr 2024': [90, 30, 80],
        'May 2024': [100, 45, 80]
    }
    df_tendencia = pd.DataFrame(data_tendencia)
    
    # 4. Seguimiento Semanal
    data_seg = {
        'Proyecto': ['Portal Web', 'App Móvil', 'CRM'],
        'Pendientes': ['Pase a PROD', 'Fix bugs iOS', 'Definir scope'],
        'Responsable': ['Juan Perez', 'Maria Gomez', 'Carlos Ruiz'],
        'Estado Proyecto TI': ['Al día', 'Con retraso', 'Al día'],
        'Desviación': [0, 15, 0]
    }
    df_seg = pd.DataFrame(data_seg)

    with pd.ExcelWriter(filename) as writer:
        # Portafolio sin headers (ya los incluimos en los datos dirty)
        df_port_dirty.to_excel(writer, sheet_name='Portafolio P&D', index=False, header=False)
        df_demanda.to_excel(writer, sheet_name='Demanda Estratégica CT', index=False)
        df_tendencia.to_excel(writer, sheet_name='Tendencia del Proyecto', index=False)
        df_seg.to_excel(writer, sheet_name='Seguimiento Semanal', index=False)
        
    print(f"Archivo {filename} generado exitosamente.")

if __name__ == "__main__":
    create_dummy_excel()
