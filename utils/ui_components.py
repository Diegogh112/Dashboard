import streamlit as st
import plotly.express as px
import plotly.graph_objects as go

def inject_custom_css():
    """Inyecta CSS personalizado para un diseño tipo Dashboard Premium."""
    st.markdown("""
        <style>
        /* Fondo general */
        .block-container {
            padding-top: 1.5rem;
            padding-bottom: 2rem;
            padding-left: 2rem;
            padding-right: 2rem;
            background-color: #f8f9fa;
        }
        
        /* Ocultar elementos de Streamlit */
        #MainMenu {visibility: hidden;}
        header {visibility: hidden;}
        footer {visibility: hidden;}
        
        /* Estilos para KPI Cards - Estilo Bloque Sólido */
        .kpi-wrapper {
            padding: 0 5px;
        }
        .kpi-card {
            color: white;
            padding: 20px 10px;
            text-align: center;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 15px;
        }
        .kpi-title {
            font-size: 0.95rem;
            font-weight: 500;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .kpi-value {
            font-size: 3rem;
            font-weight: bold;
            margin: 0;
            line-height: 1.2;
        }
        .kpi-subtitle {
            font-size: 0.85rem;
            margin-top: 10px;
            opacity: 0.9;
        }
        
        /* Headers para secciones de gráficos */
        .section-header {
            color: white;
            padding: 8px 15px;
            font-weight: 600;
            font-size: 1rem;
            margin-top: 15px;
            margin-bottom: 0px;
            display: flex;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        /* Contenedores de gráficos */
        .chart-container {
            background-color: white;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            margin-bottom: 20px;
            border: 1px solid #f0f0f0;
            border-top: none;
        }
        
        /* Ajuste de Tabs */
        .stTabs [data-baseweb="tab-list"] {
            gap: 10px;
        }
        .stTabs [data-baseweb="tab"] {
            height: 50px;
            white-space: pre-wrap;
            background-color: #fff;
            border-radius: 0px;
            padding-top: 10px;
            padding-bottom: 10px;
            border: 1px solid #e1dfdd;
            border-bottom: none;
            color: #605e5c;
            font-weight: 600;
        }
        .stTabs [aria-selected="true"] {
            background-color: #f8f9fa;
            color: #2c3e50;
            border-top: 3px solid #2c3e50;
        }
        
        /* Estilizar dataframes */
        .stDataFrame {
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        </style>
    """, unsafe_allow_html=True)

def render_kpi_card(title, value, subtitle="", bg_color="#3498db"):
    """Renderiza una tarjeta KPI tipo bloque sólido."""
    html = f"""
        <div class="kpi-wrapper">
            <div class="kpi-card" style="background-color: {bg_color};">
                <div class="kpi-title">{title}</div>
                <div class="kpi-value">{value}</div>
                <div class="kpi-subtitle">{subtitle}</div>
            </div>
        </div>
    """
    st.markdown(html, unsafe_allow_html=True)

def render_section_header(title, bg_color="#2ecc71"):
    """Renderiza un encabezado de sección coloreado."""
    html = f"""
        <div class="section-header" style="background-color: {bg_color};">
            {title}
        </div>
    """
    st.markdown(html, unsafe_allow_html=True)

# Paleta de colores para gráficos
CHART_COLORS = ['#3498db', '#2ecc71', '#9b59b6', '#e74c3c', '#f1c40f', '#e67e22', '#1abc9c', '#34495e']

def create_bar_chart(df, x, y, color_col=None, orientation='v', colors=CHART_COLORS):
    """Crea un gráfico de barras minimalista."""
    fig = px.bar(
        df, 
        x=x, 
        y=y, 
        color=color_col,
        color_discrete_sequence=colors,
        orientation=orientation,
        template='plotly_white'
    )
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=10, l=10, r=10, b=10),
        showlegend=True if color_col else False,
        xaxis_title="",
        yaxis_title=""
    )
    # Quitar grid lines
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor='#f0f0f0')
    return fig

def create_donut_chart(df, names, values, colors=CHART_COLORS):
    """Crea un gráfico de dona minimalista."""
    fig = px.pie(
        df, 
        names=names, 
        values=values,
        hole=0.5,
        color_discrete_sequence=colors,
        template='plotly_white'
    )
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=10, l=10, r=10, b=10),
        showlegend=True,
        legend=dict(orientation="v", yanchor="top", y=1, xanchor="left", x=1.0)
    )
    fig.update_traces(textposition='inside', textinfo='percent')
    return fig

def create_line_chart(df, x, y, color_col=None, colors=CHART_COLORS):
    """Crea un gráfico de líneas."""
    fig = px.line(
        df, 
        x=x, 
        y=y, 
        color=color_col,
        color_discrete_sequence=colors,
        template='plotly_white',
        markers=True
    )
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        margin=dict(t=10, l=10, r=10, b=10),
        hovermode="x unified",
        xaxis_title="",
        yaxis_title=""
    )
    fig.update_traces(line=dict(width=3))
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor='#f0f0f0')
    return fig

def apply_global_filters(df, st_container=st.sidebar):
    """Genera filtros en el sidebar basados en las columnas del dataframe y devuelve el df filtrado."""
    filtered_df = df.copy()
    
    if filtered_df.empty:
        return filtered_df
        
    st_container.markdown("### 🔍 Filtros Dinámicos")
    
    filter_cols = ['Gerencia Líder', 'Cartera', 'Estado Proyecto TI', 'Líder del Proyecto', 'Estado']
    
    for col in filter_cols:
        if col in filtered_df.columns:
            unique_vals = [x for x in filtered_df[col].dropna().unique() if str(x).strip() != '']
            if not unique_vals:
                continue
                
            unique_vals.sort(key=lambda x: str(x))
            
            selected = st_container.multiselect(
                f"{col}",
                options=unique_vals,
                default=[]
            )
            
            if selected:
                filtered_df = filtered_df[filtered_df[col].isin(selected)]
                
    return filtered_df

