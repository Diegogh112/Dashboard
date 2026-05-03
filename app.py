import streamlit as st
import pandas as pd
from data_processor import load_and_clean_excel
from utils.ui_components import inject_custom_css
from views.general import render_general_view
from views.portfolio import render_portfolio_view
from views.demanda import render_demanda_view
from views.tendencia import render_tendencia_view
from views.seguimiento import render_seguimiento_view

# Configuración de página
st.set_page_config(
    page_title="Dashboard Demanda Estratégica TI",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Inyectar estilos personalizados (Power BI vibe)
inject_custom_css()

def initialize_session_state():
    if 'data_dict' not in st.session_state:
        st.session_state.data_dict = None
    if 'sheet_names' not in st.session_state:
        st.session_state.sheet_names = []

initialize_session_state()

def main():
    # Sidebar Navigation
    st.sidebar.image("https://img.icons8.com/color/96/000000/power-bi.png", width=60)
    st.sidebar.title("Navegación")
    
    # Manejo de archivo en el sidebar para mantener el contexto
    st.sidebar.markdown("---")
    st.sidebar.subheader("Datos Origen")
    uploaded_file = st.sidebar.file_uploader("Subir archivo Excel (.xlsx)", type=['xlsx'])
    
    if uploaded_file is not None and st.session_state.data_dict is None:
        with st.spinner("Procesando y limpiando archivo Excel..."):
            try:
                data_dict, sheet_names = load_and_clean_excel(uploaded_file)
                st.session_state.data_dict = data_dict
                st.session_state.sheet_names = sheet_names
                st.sidebar.success("Archivo procesado exitosamente!")
            except Exception as e:
                st.sidebar.error(f"Error al procesar archivo: {e}")
                
    elif uploaded_file is None:
        st.session_state.data_dict = None
        
    st.sidebar.markdown("---")
    
    # Opciones de Menú
    menu_options = [
        "Dashboard General",
        "Portafolio P&D",
        "Demanda Estratégica CT",
        "Tendencia del Proyecto",
        "Seguimiento Semanal"
    ]
    
    selected_page = st.sidebar.radio("Ir a:", menu_options)
    
    # Si no hay datos, mostrar pantalla de inicio
    if st.session_state.data_dict is None:
        st.title("📊 Dashboard de Demanda Estratégica TI")
        st.markdown("""
            ### Bienvenido
            Esta aplicación analiza el portafolio y demanda estratégica de proyectos TI.
            
            **Instrucciones:**
            1. Sube tu archivo Excel usando el panel lateral izquierdo.
            2. La aplicación detectará automáticamente las tablas, limpiará encabezados y unificará los datos.
            3. Navega por las diferentes vistas utilizando el menú lateral.
            
            *Nota: El sistema está diseñado para ser robusto ante archivos con filas en blanco o encabezados desplazados.*
        """)
        
        # Mostrar imagen de placeholder/demo generada
        st.info("👈 Por favor, carga un archivo Excel en el panel lateral para comenzar.")
        return

    # Enrutamiento de vistas
    if selected_page == "Dashboard General":
        render_general_view(st.session_state.data_dict)
        
    elif selected_page == "Portafolio P&D":
        df = st.session_state.data_dict.get('Portafolio P&D')
        render_portfolio_view(df)
        
    elif selected_page == "Demanda Estratégica CT":
        df = st.session_state.data_dict.get('Demanda Estratégica CT')
        render_demanda_view(df)
        
    elif selected_page == "Tendencia del Proyecto":
        df_main = st.session_state.data_dict.get('Tendencia del Proyecto')
        df_tendencias = st.session_state.data_dict.get('Tendencias Consolidado')
        render_tendencia_view(df_main, df_tendencias)
        
    elif selected_page == "Seguimiento Semanal":
        df = st.session_state.data_dict.get('Seguimiento Semanal')
        render_seguimiento_view(df)

if __name__ == "__main__":
    main()
