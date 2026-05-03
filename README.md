# Dashboard Demanda Estratégica TI

Aplicación web desarrollada en Streamlit para el análisis de portafolios de proyectos TI a partir de archivos Excel no estructurados.

## Características
- **Procesamiento Inteligente:** Detecta automáticamente los encabezados de tabla saltándose las filas "basura" o títulos iniciales.
- **Normalización:** Homologa automáticamente los nombres de las columnas.
- **Unpivot Automático:** Detecta columnas de meses (Ene 2024, Feb 2024) y las transforma para análisis temporal.
- **Dashboards Interactivos:** Estilo Power BI con KPIs y gráficos.

## Instalación Local

1. Clona o descarga el repositorio.
2. Asegúrate de tener Python 3.9+ instalado.
3. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Ejecuta la aplicación:
   ```bash
   streamlit run app.py
   ```

## Archivos de Prueba
Puedes generar un archivo Excel de prueba ejecutando:
```bash
python generate_dummy_data.py
```
Esto creará `dummy_data.xlsx` en la raíz del proyecto.

## Instrucciones para Despliegue (Producción)

Si planeas desplegar esta aplicación internamente, tienes dos opciones principales recomendadas:

### Opción 1: Docker (Recomendado para servidores Linux)

Crea un archivo `Dockerfile` en la raíz con este contenido:
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8501
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```
Construye y corre la imagen:
```bash
docker build -t dashboard-ti .
docker run -p 8501:8501 dashboard-ti
```

### Opción 2: Windows Server (Usando IIS o Servicio Windows)
Para Windows, lo más sencillo es usar una herramienta como `NSSM` (Non-Sucking Service Manager) para correr el comando `streamlit run app.py` como un servicio de fondo que se reinicie automáticamente si la máquina se apaga.
Alternativamente, Streamlit recomienda correrlo detrás de un proxy reverso como Nginx configurado en el servidor Windows.
