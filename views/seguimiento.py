import streamlit as st
import pandas as pd
from utils.ui_components import apply_global_filters, create_bar_chart, render_section_header

def render_seguimiento_view(df):
    st.title("📋 Seguimiento Semanal")
    
    if df is None or df.empty:
        st.warning("No hay datos disponibles para la hoja 'Seguimiento Semanal'.")
        return
        
    df_filtered = apply_global_filters(df)
    
    col1, col2 = st.columns(2)
    
    with col1:
        if 'Responsable' in df_filtered.columns:
            render_section_header("Pendientes por Responsable", bg_color="#e74c3c")
            st.markdown('<div class="chart-container">', unsafe_allow_html=True)
            resp_counts = df_filtered['Responsable'].value_counts().reset_index()
            resp_counts.columns = ['Responsable', 'Cantidad']
            fig1 = create_bar_chart(resp_counts.head(10), 'Responsable', 'Cantidad', orientation='h')
            st.plotly_chart(fig1, use_container_width=True)
            st.markdown('</div>', unsafe_allow_html=True)
            
    with col2:
        if 'Estado Automático' in df_filtered.columns:
            render_section_header("Semáforo de Proyectos", bg_color="#f1c40f")
            st.markdown('<div class="chart-container">', unsafe_allow_html=True)
            estado_counts = df_filtered['Estado Automático'].value_counts().reset_index()
            estado_counts.columns = ['Estado', 'Cantidad']
            fig2 = create_bar_chart(estado_counts, 'Estado', 'Cantidad', color_col='Estado')
            st.plotly_chart(fig2, use_container_width=True)
            st.markdown('</div>', unsafe_allow_html=True)
        elif 'Estado' in df_filtered.columns:
            render_section_header("Estado de Compromisos", bg_color="#f1c40f")
            st.markdown('<div class="chart-container">', unsafe_allow_html=True)
            estado_counts = df_filtered['Estado'].value_counts().reset_index()
            estado_counts.columns = ['Estado', 'Cantidad']
            fig2 = create_bar_chart(estado_counts, 'Estado', 'Cantidad', color_col='Estado')
            st.plotly_chart(fig2, use_container_width=True)
            st.markdown('</div>', unsafe_allow_html=True)

    render_section_header("Matriz de Seguimiento", bg_color="#34495e")
    st.markdown('<div class="chart-container">', unsafe_allow_html=True)
    
    def color_status(val):
        color = ''
        val_str = str(val).lower()
        if 'retrasado' in val_str or 'rojo' in val_str or 'alto' in val_str:
            color = 'background-color: #ffcccc'
        elif 'alerta' in val_str or 'amarillo' in val_str or 'medio' in val_str:
            color = 'background-color: #ffffcc'
        elif 'en tiempo' in val_str or 'verde' in val_str or 'bajo' in val_str:
            color = 'background-color: #ccffcc'
        return color
        
    cols_to_style = [c for c in ['Estado Automático', 'Estado', 'Estado Proyecto TI'] if c in df_filtered.columns]
    
    if cols_to_style:
        st.dataframe(
            df_filtered.style.applymap(color_status, subset=cols_to_style), 
            use_container_width=True, 
            hide_index=True
        )
    else:
        st.dataframe(df_filtered, use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)
