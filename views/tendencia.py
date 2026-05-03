import streamlit as st
import pandas as pd
from utils.ui_components import apply_global_filters, create_line_chart, create_bar_chart, render_section_header

def render_tendencia_view(df_main, df_tendencias):
    st.title("📈 Tendencia del Proyecto")
    
    if df_tendencias is None or df_tendencias.empty:
        st.warning("No se encontraron datos de tendencia mensuales (columnas como Ene 2024, Feb 2024) en los archivos cargados.")
        if df_main is not None and not df_main.empty:
            st.dataframe(df_main, use_container_width=True, hide_index=True)
        return
        
    st.info("Mostrando datos consolidados de avance a lo largo del tiempo.")
    
    df_filtered = apply_global_filters(df_tendencias)
    
    if df_filtered.empty:
        st.warning("No hay datos para mostrar con los filtros seleccionados.")
        return
        
    df_filtered['Avance Mensual'] = pd.to_numeric(df_filtered['Avance Mensual'], errors='coerce').fillna(0)
    
    render_section_header("Avance Histórico", bg_color="#9b59b6")
    st.markdown('<div class="chart-container">', unsafe_allow_html=True)
    
    if 'Nombre del Proyecto' in df_filtered.columns:
        proyectos_unicos = df_filtered['Nombre del Proyecto'].unique()
        if len(proyectos_unicos) > 5:
            st.write("Demasiados proyectos para un gráfico claro. Mostrando el top 5 por default o selecciona uno.")
            seleccion = st.multiselect("Seleccionar Proyectos Específicos para Tendencia", proyectos_unicos, default=list(proyectos_unicos)[:5])
            df_plot = df_filtered[df_filtered['Nombre del Proyecto'].isin(seleccion)]
        else:
            df_plot = df_filtered
            
        fig_line = create_line_chart(df_plot, 'Periodo', 'Avance Mensual', color_col='Nombre del Proyecto')
        st.plotly_chart(fig_line, use_container_width=True)
    else:
        df_agrupado = df_filtered.groupby('Periodo')['Avance Mensual'].mean().reset_index()
        fig_line = create_line_chart(df_agrupado, 'Periodo', 'Avance Mensual')
        st.plotly_chart(fig_line, use_container_width=True)
        
    st.markdown('</div>', unsafe_allow_html=True)
        
    render_section_header("Datos Mensuales", bg_color="#34495e")
    st.markdown('<div class="chart-container">', unsafe_allow_html=True)
    st.dataframe(df_filtered, use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)
