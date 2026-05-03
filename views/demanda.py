import streamlit as st
import pandas as pd
import plotly.express as px
from utils.ui_components import apply_global_filters, render_section_header

def render_demanda_view(df):
    st.title("🎯 Demanda Estratégica CT")
    
    if df is None or df.empty:
        st.warning("No hay datos disponibles para la hoja 'Demanda Estratégica CT'.")
        return
        
    df_filtered = apply_global_filters(df)
    
    render_section_header("Embudo de Estados de Demanda", bg_color="#3498db")
    st.markdown('<div class="chart-container">', unsafe_allow_html=True)
    
    if 'Estado' in df_filtered.columns:
        estado_counts = df_filtered['Estado'].value_counts().reset_index()
        estado_counts.columns = ['Estado', 'Cantidad']
        estado_counts = estado_counts.sort_values('Cantidad', ascending=False)
        
        fig = px.funnel(
            estado_counts, 
            x='Cantidad', 
            y='Estado',
            template='plotly_white',
            color_discrete_sequence=['#3498db']
        )
        fig.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            margin=dict(t=10, l=10, r=10, b=10)
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No se encontró la columna 'Estado' para generar el pipeline.")
    st.markdown('</div>', unsafe_allow_html=True)

    render_section_header("Detalle de Demandas", bg_color="#e67e22")
    st.markdown('<div class="chart-container">', unsafe_allow_html=True)
    st.dataframe(df_filtered, use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)
