import pandas as pd
import json

file_path = "Portafolio_de_Proyectos_2026 (2).xlsx"

# Read sheet names
xls = pd.ExcelFile(file_path)
print(f"Hojas encontradas: {xls.sheet_names}")

for sheet in xls.sheet_names:
    print(f"\n--- Analizando hoja: {sheet} ---")
    try:
        df_raw = pd.read_excel(xls, sheet_name=sheet, header=None, nrows=20)
        # Mostrar filas no completamente vacías para ver dónde empieza
        for i in range(len(df_raw)):
            row_data = df_raw.iloc[i].dropna().tolist()
            if row_data:
                print(f"Fila {i}: {row_data[:15]} ... ({len(row_data)} celdas)")
    except Exception as e:
        print(f"Error leyendo la hoja: {e}")
