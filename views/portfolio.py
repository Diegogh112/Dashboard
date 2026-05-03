import streamlit as st
import pandas as pd
from utils.ui_components import apply_global_filters, create_bar_chart, render_section_header

def render_portfolio_view(df):
    st.title("💼 Portafolio P&D")
    
    if df is None or df.empty:
        st.warning("No hay datos disponibles para la hoja 'Portafolio P&D'.")
        return
        
    df_filtered = apply_global_filters(df)
    
    col1, col2 = st.columns(2)
    
    with col1:
        if 'Gerencia Líder' in df_filtered.columns:
            render_section_header("Proyectos por Gerencia Líder", bg_color="#3498db")
            st.markdown('<div class="chart-container">', unsafe_allow_html=True)
            gerencia_counts = df_filtered['Gerencia Líder'].value_counts().reset_index()
            gerencia_counts.columns = ['Gerencia', 'Cantidad']
            fig1 = create_bar_chart(gerencia_counts, 'Gerencia', 'Cantidad', color_col='Gerencia')
            st.plotly_chart(fig1, use_container_width=True)
            st.markdown('</div>', unsafe_allow_html=True)
            
    with col2:
        if 'Presupuesto asignado' in df_filtered.columns and 'Gerencia Líder' in df_filtered.columns:
            render_section_header("Presupuesto por Gerencia", bg_color="#2ecc71")
            st.markdown('<div class="chart-container">', unsafe_allow_html=True)
            df_pres = df_filtered.copy()
            df_pres['Presupuesto asignado'] = pd.to_numeric(df_pres['Presupuesto asignado'], errors='coerce').fillna(0)
            presupuesto_gerencia = df_pres.groupby('Gerencia Líder')['Presupuesto asignado'].sum().reset_index()
            fig2 = create_bar_chart(presupuesto_gerencia, 'Gerencia Líder', 'Presupuesto asignado', orientation='h')
            st.plotly_chart(fig2, use_container_width=True)
            st.markdown('</div>', unsafe_allow_html=True)

    render_section_header("Detalle de Proyectos", bg_color="#e67e22")
    st.markdown('<div class="chart-container">', unsafe_allow_html=True)
    st.dataframe(df_filtered, use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)
