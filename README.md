# Dashboard de Gestión de Proyectos TI

Dashboard interactivo para el seguimiento y análisis de proyectos de TI, portafolio, demanda estratégica y transformación digital. Permite cargar archivos Excel (.xlsx / .xlsm) y visualizar la información en gráficos, tablas y cronogramas Gantt.

---

## ¿Para qué sirve?

La aplicación centraliza el monitoreo de proyectos de TI en una sola interfaz, permitiendo:

- Visualizar el **avance planificado vs. real** de cada proyecto.
- Hacer seguimiento a la **Demanda Estratégica TI** con cronograma Gantt interactivo.
- Analizar el **Portafolio P&D** por gerencia, estado y salud del proyecto.
- Revisar los **Proyectos de Transformación Digital** priorizados.
- Gestionar el **Seguimiento Semanal** de pendientes y responsables.
- Filtrar, cruzar y explorar datos de forma interactiva sin necesidad de backend.

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| **React 18** | Framework principal de UI |
| **Vite** | Bundler y servidor de desarrollo |
| **Tailwind CSS** | Estilos utilitarios |
| **Recharts** | Gráficos (barras, tortas, áreas, treemap) |
| **SheetJS (xlsx)** | Lectura de archivos Excel (.xlsx, .xlsm) |
| **Lucide React** | Iconografía |
| **clsx + tailwind-merge** | Manejo condicional de clases CSS |

---

## Estructura del proyecto

```
project-dashboard/
├── src/
│   ├── App.jsx          # Componente principal — toda la lógica y UI
│   ├── main.jsx         # Punto de entrada de React
│   └── index.css        # Estilos globales y configuración de Tailwind
├── index.html           # HTML base
├── package.json         # Dependencias y scripts
├── vite.config.js       # Configuración de Vite
├── tailwind.config.js   # Configuración de Tailwind CSS
└── postcss.config.js    # Configuración de PostCSS
```

### Componentes principales dentro de `App.jsx`

| Componente / Función | Descripción |
|---|---|
| `GanttTable` | Cronograma Gantt interactivo con expand/collapse, tooltip y modo pantalla completa |
| `renderDemandDashboard()` | Dashboard de Demanda Estratégica TI (hoja "Demanda Estrategica CT") |
| `renderDemand2Dashboard()` | Dashboard de Demanda Estratégica (2) con Gantt (archivo .xlsm separado) |
| `renderPortfolioDashboard()` | Dashboard de Portafolio P&D |
| `renderTrendDashboard()` | Dashboard de Proyectos de Transformación Digital |
| `renderWeeklyDashboard()` | Dashboard de Seguimiento Semanal |
| `handleFileUpload()` | Parser del archivo Excel principal |
| `handleDemand2Upload()` | Parser del archivo .xlsm de Demanda Estratégica |

---

## Pantallas

### 1. Demanda Estratégica TI
Analiza los requerimientos de la hoja **"Demanda Estrategica CT"**. Incluye KPIs de estado, gráficos por gerencia y categoría, tabla detallada con filtros por columna, y vista de detalle por requerimiento.

Filtros disponibles: Cartera, Estado, Solo Proyectos (filtra por `Tipo de Requerimiento = Proyecto`).

### 2. Portafolio P&D
Visualiza los proyectos del portafolio con métricas de avance, distribución por gerencia, estado y salud. Permite hacer clic en los gráficos para filtrar la tabla.

### 3. Proyectos de Transformación Digital
Seguimiento de proyectos priorizados con avance mensual/anual planificado vs. ejecutado.

### 4. Seguimiento Semanal
Listado de pendientes con distribución de estados y top proyectos por tareas. Filtros por proyecto, responsable, fecha de compromiso y estado.

### 5. Demanda Estratégica (2)
Cargado desde un archivo **.xlsm separado**. Muestra:
- KPIs por indicador (En Curso, En Riesgo, Atrasado, Finalizado, No Iniciado).
- Gráficos de avance por proyecto y por gerencia.
- Cronograma Gantt con barras de rango (gris), avance planificado (verde claro) y avance completado (verde oscuro).
- Soporte para jerarquía: Proyecto → Etapa → Actividad/Entregable.
- Modo pantalla completa para el cronograma.

---

## Cómo ejecutar

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build
```

---

## Cómo usar

1. Ejecutar la app con `npm run dev`.
2. Hacer clic en **"SUBIR ORIGINAL"** para cargar el archivo Excel principal (con las hojas: Portafolio P&D, Demanda Estrategica CT, Seguimiento Semanal, Pys Transf Digital).
3. Opcionalmente, hacer clic en **"SUBIR DEMANDA TI"** para cargar el archivo `.xlsm` con la hoja "Demanda Estratégica" y activar la pantalla **Demanda Estratégica (2)**.
4. Navegar entre las pestañas para explorar cada dashboard.
5. Hacer clic en los gráficos para filtrar los datos de forma cruzada.

---

## Formato esperado de los archivos Excel

### Archivo principal (.xlsx)
| Hoja | Contenido |
|---|---|
| `Portafolio P&D` | Proyectos del portafolio con estado, avance y presupuesto |
| `Demanda Estrategica CT` | Requerimientos con tipo, gerencia, estado y avance |
| `Seguimiento Semanal` | Pendientes semanales por proyecto y responsable |
| `Pys Transf Digital` | Proyectos priorizados con avance mensual |

### Archivo de Demanda (.xlsm)
Debe contener la hoja **"Demanda Estratégica"** con dos tablas:
- **Tabla 1** (`Proyectos_DE`): lista general de proyectos con indicador, gerencia y fechas.
- **Tabla 2** (desde fila ~28): detalle de avance con `% Planificado`, `% Completado`, `Fecha Inicio`, `Fecha Fin`, y columnas de meses para el Gantt.
