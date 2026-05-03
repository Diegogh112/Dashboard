import streamlit as st
import pandas as pd
from utils.ui_components import render_kpi_card, render_section_header, create_bar_chart, create_donut_chart, apply_global_filters

def render_general_view(data_dict):
    # Intentar obtener el dataframe principal
    df_main = None
    for key in ['Portafolio P&D', 'Demanda Estratégica CT']:
        if key in data_dict and not data_dict[key].empty:
            df_main = data_dict[key]
            break
            
    if df_main is None or df_main.empty:
        st.warning("No hay datos suficientes para mostrar el dashboard general.")
        return
        
    # Aplicar filtros
    df_filtered = apply_global_filters(df_main)
    
    # 1. Calcular KPIs
    total_proyectos = len(df_filtered)
    
    presupuesto_total = 0
    if 'Presupuesto asignado' in df_filtered.columns:
        presupuesto_total = pd.to_numeric(df_filtered['Presupuesto asignado'], errors='coerce').sum()
        
    avance_promedio = 0
    if '% Avance Ejecutado' in df_filtered.columns:
        avance_promedio = pd.to_numeric(df_filtered['% Avance Ejecutado'], errors='coerce').mean()
        
    retrasados = 0
    if 'Estado Automático' in df_filtered.columns:
        retrasados = len(df_filtered[df_filtered['Estado Automático'] == 'Retrasado'])
    elif 'Estado Proyecto TI' in df_filtered.columns:
        retrasados = len(df_filtered[df_filtered['Estado Proyecto TI'].str.contains('retraso', case=False, na=False)])

    # 2. Renderizar KPIs en 4 columnas con colores estilo Dashboard de Referencia
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        render_kpi_card("Total Proyectos", f"{total_proyectos}", "Proyectos Activos", bg_color="#3498db") # Azul
        
    with col2:
        if presupuesto_total > 1000000:
            val_str = f"${presupuesto_total/1000000:.1f}M"
        else:
            val_str = f"${presupuesto_total:,.0f}"
        render_kpi_card("Presupuesto Asignado", val_str, "Soles Aprobados", bg_color="#2ecc71") # Verde
        
    with col3:
        render_kpi_card("Avance Promedio", f"{avance_promedio:.1f}%", "Ejecución Global", bg_color="#8854d0") # Morado
        
    with col4:
        sub_text = "Requieren atención" if retrasados > 0 else "Todo en orden"
        render_kpi_card("Proyectos Retrasados", f"{retrasados}", sub_text, bg_color="#7f8fa6") # Gris Oscuro

    # 3. Gráficos
    col_chart1, col_chart2 = st.columns(2)
    
    with col_chart1:
        render_section_header("Distribución por Estado", bg_color="#2ecc71")
        st.markdown('<div class="chart-container">', unsafe_allow_html=True)
        if 'Estado Proyecto TI' in df_filtered.columns:
            estado_counts = df_filtered['Estado Proyecto TI'].value_counts().reset_index()
            estado_counts.columns = ['Estado', 'Cantidad']
            fig1 = create_donut_chart(estado_counts, 'Estado', 'Cantidad')
            st.plotly_chart(fig1, use_container_width=True)
        else:
            st.info("No se encontró la columna de Estado.")
        st.markdown('</div>', unsafe_allow_html=True)
            
    with col_chart2:
        render_section_header("Proyectos por Cartera", bg_color="#3498db")
        st.markdown('<div class="chart-container">', unsafe_allow_html=True)
        if 'Cartera' in df_filtered.columns:
            cartera_counts = df_filtered['Cartera'].value_counts().reset_index()
            cartera_counts.columns = ['Cartera', 'Cantidad']
            fig2 = create_bar_chart(cartera_counts, 'Cartera', 'Cantidad', color_col='Cartera')
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.info("No se encontró la columna de Cartera.")
        st.markdown('</div>', unsafe_allow_html=True)
            
    # 4. Tabla Inferior (Heatmap o Tabla Detalle)
    render_section_header("Detalle Top Proyectos Priorizados", bg_color="#e67e22")
    st.markdown('<div class="chart-container">', unsafe_allow_html=True)
    
    cols_to_show = ['Nombre del Proyecto', 'Gerencia Líder', 'Líder del Proyecto']
    if 'Presupuesto asignado' in df_filtered.columns:
        cols_to_show.append('Presupuesto asignado')
    if '% Avance Ejecutado' in df_filtered.columns:
        cols_to_show.append('% Avance Ejecutado')
    if 'Estado Automático' in df_filtered.columns:
        cols_to_show.append('Estado Automático')
        
    cols_to_show = [c for c in cols_to_show if c in df_filtered.columns]
    
    if cols_to_show:
        df_display = df_filtered[cols_to_show].copy()
        if 'Presupuesto asignado' in df_display.columns:
            df_display['Presupuesto asignado'] = pd.to_numeric(df_display['Presupuesto asignado'], errors='coerce')
            df_display = df_display.sort_values(by='Presupuesto asignado', ascending=False)
            
        st.dataframe(df_display.head(10), use_container_width=True, hide_index=True)
    st.markdown('</div>', unsafe_allow_html=True)

