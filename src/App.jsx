import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, FunnelChart, Funnel, Trapezoid, Treemap
} from 'recharts';
import {
  Upload, FileText, PieChart as PieChartIcon, BarChart2,
  TrendingUp, Calendar, Filter, Download, AlertCircle,
  CheckCircle2, Clock, PlayCircle, StopCircle, ChevronRight, ChevronDown,
  Menu, X, Search, LayoutDashboard, Briefcase, Users, Activity, ArrowLeft, Star, MessageSquare,
  Layers, ListChecks, FolderOpen, Table as TableIcon
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility Functions ---

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const formatPercent = (val, decimals = 0) => {
  if (val === undefined || val === null || val === '') return '-';
  if (typeof val === 'string' && val.toLowerCase().includes('no aplica')) return '-';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '-';
  return `${(num * 100).toFixed(decimals)}%`;
};

const formatCurrency = (val) => {
  if (val === undefined || val === null) return '$0';
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? '$0' : new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(num);
};

const excelDateToJSDate = (serial) => {
  if (!serial) return '-';
  if (typeof serial === 'string') return serial;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatSeguimiento = (text) => {
  if (!text) return 'Sin comentarios de seguimiento registrados.';
  const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g;
  const parts = String(text).split(datePattern);
  if (parts.length <= 1) return text;
  const formatted = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    if (part.match(datePattern)) {
      if (formatted.length > 0) {
        formatted.push(<br key={`br-${i}`} />);
        formatted.push(<br key={`br2-${i}`} />);
      }
      formatted.push(<strong key={`date-${i}`} className="text-corporate-dark">{part}: </strong>);
    } else {
      formatted.push(<span key={`text-${i}`}>{part}</span>);
    }
  }
  return formatted;
};

const getDeviationColor = (dev) => {
  const d = typeof dev === 'number' ? dev : parseFloat(dev);
  if (isNaN(d)) return 'text-gray-500';
  if (d < -0.1) return 'text-red-600 bg-red-50'; // < -10%
  if (d < 0) return 'text-yellow-600 bg-yellow-50'; // -10% to 0%
  return 'text-green-600 bg-green-50'; // >= 0%
};

const getHealthColor = (project) => {
  const alert = (project?.['ALERTA'] || project?.['Alerta'] || '').toString().toLowerCase();
  if (alert.includes('rojo')) return 'bg-red-500';
  if (alert.includes('amarillo')) return 'bg-yellow-400';
  if (alert.includes('verde')) return 'bg-green-500';

  // Fallback based on deviation
  const dev = parseFloat(project?.['Desv. %'] || project?.['Desviación'] || 0);
  if (dev < -0.1) return 'bg-red-500';
  if (dev < 0) return 'bg-yellow-400';
  return 'bg-green-500';
};

const calculateDemandStats = (demandData) => {
  const projectsOnly = demandData.filter(d => (d['Tipo'] || d['Tipo de Requerimiento'] || '').toLowerCase() === 'proyecto');

  const getValidAvg = (data, key) => {
    const validItems = data.filter(d => {
      const val = d[key];
      return val !== null && val !== undefined && val !== '' && !isNaN(parseFloat(val));
    });
    return validItems.length > 0
      ? validItems.reduce((acc, d) => acc + parseFloat(d[key]), 0) / validItems.length
      : 0;
  };

  const stats = {
    totalDemand: demandData.length,
    uniqueProjectCount: projectsOnly.length,
    demandNoIniciado: demandData.filter(d => (d['Estado Proyecto TI'] || '').toLowerCase().includes('01') || (d['Estado Proyecto TI'] || '').toLowerCase().includes('no iniciado')).length,
    demandEnEjecucion: demandData.filter(d => (d['Estado Proyecto TI'] || '').toLowerCase().includes('02') || (d['Estado Proyecto TI'] || '').toLowerCase().includes('desarrollo') || (d['Estado Proyecto TI'] || '').toLowerCase().includes('ejecución')).length,
    demandImplementado: demandData.filter(d => (d['Estado Proyecto TI'] || '').toLowerCase().includes('03') || (d['Estado Proyecto TI'] || '').toLowerCase().includes('implementado')).length,
    demandFinalizado: demandData.filter(d => (d['Estado Proyecto TI'] || '').toLowerCase().includes('04') || (d['Estado Proyecto TI'] || '').toLowerCase().includes('finalizado')).length,
    demandDescartado: demandData.filter(d => (d['Estado Proyecto TI'] || '').toLowerCase().includes('05') || (d['Estado Proyecto TI'] || '').toLowerCase().includes('descartado')).length,
    avgPlan: getValidAvg(demandData, '% Avance Planificado'),
    avgExec: getValidAvg(demandData, '% Avance ejecutado'),
  };
  return stats;
};

const calculatePortfolioStats = (portfolioData) => {
  const getValidAvg = (data, key) => {
    const validItems = data.filter(d => {
      const val = d[key];
      return val !== null && val !== undefined && val !== '' && !isNaN(parseFloat(val));
    });
    return validItems.length > 0
      ? validItems.reduce((acc, d) => acc + parseFloat(d[key]), 0) / validItems.length
      : 0;
  };

  const getSum = (data, key) => {
    return data.reduce((acc, d) => {
      const val = d[key];
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
  };

  const stats = {
    total: portfolioData.length,
    noIniciado: portfolioData.filter(p => (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('01') || (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('no iniciado')).length,
    enEjecucion: portfolioData.filter(p => (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('02') || (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('curso') || (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('ejecución')).length,
    implementado: portfolioData.filter(p => (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('03') || (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('implementado')).length,
    cerrado: portfolioData.filter(p => (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('04') || (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('cerrado') || (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('finalizado')).length,
    descartado: portfolioData.filter(p => (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('05') || (p['Estado TI'] || p['Estado'] || '').toLowerCase().includes('descartado')).length,
    budget: getSum(portfolioData, 'Presupuesto asignado'),
    avgExec: getValidAvg(portfolioData, '% Avance ejecutado'),
  };
  return stats;
};

const getDemandProjectHealth = (project) => {
  if (!project) return { label: "Excelente", color: "text-green-600", bg: "bg-green-500", emoji: "🟢" };

  const fechaFin = project['Fecha Fin- Plan'] || project['Fecha Fin'];
  const estado = project['Estado TI'] || '';
  const planPercent = parseFloat(project['% Avance Planificado']) || 0;
  const execPercent = parseFloat(project['% Avance ejecutado']) || 0;
  const diff = execPercent - planPercent;

  let label = "Excelente";
  let color = "text-green-600";
  let bg = "bg-green-500";
  let emoji = "🟢";

  if (fechaFin) {
    if (diff < 0 && (estado.includes('01') || estado.includes('02'))) {
      label = "Retraso";
      color = "text-red-600";
      bg = "bg-red-500";
      emoji = "🔴";
    } else if (diff >= -0.1 && (estado.includes('03') || estado.includes('04') || estado.includes('05'))) {
      label = "Excelente";
      color = "text-green-600";
      bg = "bg-green-500";
      emoji = "🟢";
    } else if (diff < 0 && diff >= -0.1) {
      label = "Por vencer";
      color = "text-amber-600";
      bg = "bg-yellow-400";
      emoji = "🟡";
    } else if (diff < -0.1) {
      label = "Retraso";
      color = "text-red-600";
      bg = "bg-red-500";
      emoji = "🔴";
    }
  }

  return { label, color, bg, emoji };
};

// --- Components ---

const InfoBox = ({ label, value, className }) => (
  <div className={cn("bg-white border border-gray-200 rounded overflow-hidden flex flex-col", className)}>
    <div className="bg-[#1e3a5f] text-white text-[10px] uppercase px-2 py-1 font-bold tracking-wider">
      {label}
    </div>
    <div className="px-2 py-2 text-sm font-medium text-gray-800 text-center truncate">
      {value || '-'}
    </div>
  </div>
);

const TimelineProgressBar = ({ label, percent, color, startDate, endDate, showDates = false }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-end">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
      <span className={cn("text-xs font-bold", color.replace('bg-', 'text-'))}>{formatPercent(percent)}</span>
    </div>
    <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
      <div
        className={cn("absolute top-0 left-0 h-full transition-all duration-1000", color)}
        style={{ width: `${Math.min(100, (parseFloat(percent) || 0) * 100)}%` }}
      />
      {!showDates && (
        <div className="absolute inset-0 flex justify-between items-center px-2 pointer-events-none">
          <span className="text-[8px] font-bold text-gray-400">{startDate}</span>
          <span className="text-[8px] font-bold text-gray-400">{endDate}</span>
        </div>
      )}
    </div>
  </div>
);

const KPICard = ({ label, value, colorClass }) => (
  <div className="bg-white border border-gray-200 rounded p-3 flex flex-col items-center justify-center text-center shadow-sm">
    <div className={cn("text-2xl font-bold text-gray-800", colorClass)}>{value}</div>
    <div className="text-[10px] text-gray-500 uppercase font-bold mt-1">{label}</div>
  </div>
);

const COLORS = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// --- Main App ---

export default function App() {
  const [data, setData] = useState(null);
  const [demand2Data, setDemand2Data] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('demand'); // Default to Demand as it's most important
  const [selectedProjectName, setSelectedProjectName] = useState(null);

  // Sidebar Filters
  const [sidebarFilters, setSidebarFilters] = useState({
    management: 'Todas',
    dimension: 'Todas',
    status: 'Todos',
  });

  const [topPortfolio, setTopPortfolio] = useState('Todas');
  const [demandChartType, setDemandChartType] = useState('projects'); // 'projects' or 'childProjects'
  const [demandFilter, setDemandFilter] = useState(null); // { key: 'Estado TI', value: '...' }
  const [portfolioFilter, setPortfolioFilter] = useState(null);
  const [tableSearch, setTableSearch] = useState('');
  const [tableColumnFilters, setTableColumnFilters] = useState({});
  const [portfolioColumnFilters, setPortfolioColumnFilters] = useState({});
  const [activeFilterMenu, setActiveFilterMenu] = useState(null); // { key: string, rect: DOMRect, isPortfolio?: boolean }
  const [selectedOpp, setSelectedOpp] = useState(null); // For expanded OPP view
  const [showStrategicDetail, setShowStrategicDetail] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setActiveFilterMenu(null);
    if (activeFilterMenu) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeFilterMenu]);

  const TABS = [
    { id: 'demand', label: 'Demanda Estratégica TI', icon: Activity },
    { id: 'portfolio', label: 'Portafolio P&D', icon: Briefcase },
    { id: 'trend', label: 'Pys Transf Digital', icon: TrendingUp },
    { id: 'weekly', label: 'Seguimiento Semanal', icon: Clock },
  ];

  const [trendFilter, setTrendFilter] = useState(null); // { month: string }
  const [trendViewMode, setTrendViewMode] = useState('meses'); // 'meses' | 'años'

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const processSheet = (sheet) => {
          if (!sheet) return [];

          // Convert to array of arrays first to find the header row
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

          // Find the row that contains "Nombre del Proyecto" or similar
          let headerRowIndex = rows.findIndex(row =>
            row && row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase().includes('nombre del proyecto'))
          );

          // If not found, assume index 0
          if (headerRowIndex === -1) headerRowIndex = 0;

          // Get the data using the found header row
          const rawData = XLSX.utils.sheet_to_json(sheet, {
            range: headerRowIndex,
            defval: null
          });

          return rawData.filter(row => {
            const values = Object.values(row).filter(v => v !== null && v !== '');
            // A valid row must have some data and a project name
            const hasName = row['Nombre del Proyecto'] || row['PROYECTO'] || row['Nombre'];
            return values.length > 0 && hasName;
          }).map(row => {
            const cleanRow = {};
            Object.keys(row).forEach(key => {
              // Clean key: trim and remove newlines
              const cleanKey = key.replace(/\r?\n|\r/g, " ").trim();
              cleanRow[cleanKey] = row[key];
            });
            return cleanRow;
          });
        };

        const normalizeData = (list) => {
          return list.map(item => {
            const normalized = { ...item };

            // Map common variations to standard keys
            const keyMaps = {
              'Gerencia Líder': ['Gerencia Líder', 'Gerencia Lider', 'Gerencia', 'GERENCIA'],
              'Cartera': ['Cartera', 'CARTERA', 'Portafolio'],
              'Presupuesto asignado': ['Presupuesto asignado', 'Presupuesto', 'PRESUPUESTO', 'Costo'],
              'Nombre del Proyecto': ['Nombre del Proyecto', 'PROYECTO', 'Nombre', 'Project Name'],
              'Estado TI': ['Estado TI', 'ESTADO TI', 'Estado de TI', 'Estado', 'Estado Proyecto', 'ESTADO', 'Situación'],
              'Estado Proyecto TI': ['Estado Proyecto TI', 'ESTADO PROYECTO TI'],
              'OPP': ['Seguimiento OPP', 'OPP', 'SEGUIMIENTO OPP', 'Comentarios OPP'],
              'Tipo': ['Tipo de Requerimiento', 'Tipo', 'TIPO'],
              'Categoría': ['Categoría', 'Categoria', 'CATEGORIA', 'Salud', 'SALUD'],
              'Seguimiento Planeamiento': ['SEGUIMIENTO (Planeamiento y Control de Gestión)', 'SEGUIMIENTO', 'Seguimiento', 'SEGUIMIENTO  \n (Planeamiento y Control de Gestión)']
            };

            Object.entries(keyMaps).forEach(([standardKey, variations]) => {
              if (!normalized[standardKey] || normalized[standardKey] === '') {
                const foundKey = Object.keys(item).find(k => {
                  const cleanK = k.toLowerCase().replace(/\s+/g, ' ').trim();
                  return variations.some(v => {
                    const cleanV = v.toLowerCase().replace(/\s+/g, ' ').trim();
                    return cleanK === cleanV || cleanK.includes(cleanV) || cleanV.includes(cleanK);
                  });
                });
                if (foundKey && item[foundKey] !== null && item[foundKey] !== undefined) {
                  normalized[standardKey] = item[foundKey];
                }
              }
            });

            return normalized;
          });
        };

        const processTrendSheet = (sheet) => {
          if (!sheet) return [];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

          // Find header row (the one with "Proyectos Priorizados")
          const headerIdx = rows.findIndex(r => r && r.some(c => String(c).includes('Proyectos Priorizados')));
          if (headerIdx === -1) return [];

          const headerSub = rows[headerIdx];     // Contains "2023", "Planif", "Ejec"
          const headerTop = rows[headerIdx - 1]; // Contains Year/Month: e.g. "%ENE 2024"

          const dataRows = rows.slice(headerIdx + 1);

          // Find the column index for "Detalle del Estado"
          const estadoIdx = headerSub.findIndex(c => c && String(c).includes('Detalle del Estado'));

          const colIndices = {
            n: headerSub.findIndex(c => c && String(c).toLowerCase().includes('n°')),
            codigo: headerSub.findIndex(c => c && String(c).toLowerCase().includes('código')),
            proyecto: headerSub.findIndex(c => c && String(c).toLowerCase().includes('proyectos priorizados')),
            gerencia: headerSub.findIndex(c => c && String(c).toLowerCase().includes('gerencia')),
            lider: headerSub.findIndex(c => c && String(c).toLowerCase().includes('líder del')),
            presupuesto: headerSub.findIndex(c => c && String(c).toLowerCase().includes('presupuesto')),
            dimension: headerSub.findIndex(c => c && String(c).toLowerCase().includes('dimensión')),
            tipo: headerSub.findIndex(c => c && String(c).toLowerCase().includes('tipo')),
            y2023: headerSub.findIndex(c => c && String(c).includes('2023')),
            estado: headerSub.findIndex(c => c && String(c).toLowerCase().includes('estado de ti')),
            anioInicio: headerSub.findIndex(c => c && String(c).toLowerCase().includes('año inicio')),
            anioFin: headerSub.findIndex(c => c && String(c).toLowerCase().includes('año fin'))
          };

          // Fallbacks if index not found
          const idx = (key, def) => colIndices[key] !== -1 ? colIndices[key] : def;

          return dataRows.filter(r => r[idx('proyecto', 2)]).map(r => {
            const parseMoney = (val) => {
              if (val === null || val === undefined) return 0;
              if (typeof val === 'number') return val;
              const clean = String(val).replace(/[^0-9.-]+/g, "");
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : num;
            };

            const estIdx = idx('estado', -1);
            const obj = {
              'N°': r[idx('n', 0)],
              'Código': r[idx('codigo', 1)],
              'Proyecto': r[idx('proyecto', 2)],
              'Gerencia Líder': r[idx('gerencia', 7)],
              'Líder del Proyecto': r[idx('lider', 8)],
              'Presupuesto': parseMoney(r[idx('presupuesto', 9)]),
              'Dimensión': r[idx('dimension', 10)],
              'Tipo': r[idx('tipo', 11)],
              '2023': r[idx('y2023', 12)],
              'Año Inicio Planificado': r[idx('anioInicio', 5)],
              'Año Fin Planificado': r[idx('anioFin', 6)],
              'Estado': (estIdx !== -1 && r[estIdx]) ? r[estIdx] : 'Priorizado'
            };

            let currentHeader = '';
            headerSub.forEach((subVal, i) => {
              const topVal = headerTop ? headerTop[i] : null;
              if (topVal) currentHeader = String(topVal).trim();

              const sub = subVal ? String(subVal).trim() : '';
              const value = r[i];

              const firstMonthCol = Math.max(8, idx('y2023', 7) + 1);
              if (i >= firstMonthCol && currentHeader && (currentHeader.includes('%') || currentHeader.match(/\d{4}/))) {
                const cleanHeader = currentHeader.replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
                if (sub.toLowerCase().includes('plani') || sub.toLowerCase().includes('plan')) {
                  obj[`${cleanHeader} Plan`] = value;
                } else if (sub.toLowerCase().includes('ejec')) {
                  obj[`${cleanHeader} Exec`] = value;
                }
              }
            });
            return obj;
          });
        };

        const findSheet = (wb, keywords) => {
          return wb.SheetNames.find(name => {
            const cleanName = name.toLowerCase().replace(/\s+/g, '');
            return keywords.every(k => cleanName.includes(k.toLowerCase()));
          });
        };

        const trendSheetName = findSheet(wb, ['pys', 'transf', 'digital']) || findSheet(wb, ['tendencia']) || (wb.SheetNames.length > 3 ? wb.SheetNames[3] : wb.SheetNames[wb.SheetNames.length - 1]);

        const sheets = {
          portfolio: normalizeData(processSheet(wb.Sheets['Portafolio P&D'] || wb.Sheets[wb.SheetNames[0]])),
          demand: normalizeData(processSheet(wb.Sheets['Demanda Estrategica CT'] || wb.Sheets[wb.SheetNames[1]])),
          weekly: normalizeData(processSheet(wb.Sheets['Seguimiento Semanal'] || wb.Sheets[wb.SheetNames[2]])),
          trend: processTrendSheet(wb.Sheets[trendSheetName])
        };

        setData(sheets);
        setSelectedProjectName(null);
        setTopPortfolio('Todas');
      } catch (err) {
        setError('Error al procesar el archivo Excel.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDemand2Upload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        
        let targetSheetName = wb.SheetNames.find(n => n.includes('Demanda Estratégica') || n.includes('Demanda Estrategica'));
        if (!targetSheetName) throw new Error("No se encontró la hoja Demanda Estratégica");
        
        const sheet = wb.Sheets[targetSheetName];
        let rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        let headerRowIndex = rows.findIndex(row => row && row.some(cell => typeof cell === 'string' && cell.trim().toUpperCase().includes('PROYECTO')));
        
        if (headerRowIndex !== -1) {
          const rawData = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
          const normalized = rawData.map(item => {
            let newItem = {};
            const keyMaps = {
              'Gerencia Líder': ['Gerencia Líder', 'Gerencia Lider', 'Gerencia', 'GERENCIA'],
              'Cartera': ['Cartera', 'CARTERA', 'Portafolio'],
              'Presupuesto asignado': ['Presupuesto', 'PRESUPUESTO', 'Costo'],
              'Nombre del Proyecto': ['Nombre del Proyecto', 'PROYECTO', 'Nombre'],
              'Estado Proyecto TI': ['Estado Proyecto TI', 'ESTADO PROYECTO TI'],
              'Tipo': ['Tipo de Requerimiento', 'Tipo'],
            };
            Object.keys(item).forEach(key => {
              if (item[key] === null || item[key] === '') return;
              let newKey = key.trim();
              for (const [standardKey, variations] of Object.entries(keyMaps)) {
                if (variations.some(v => v.toLowerCase() === newKey.toLowerCase())) {
                  newKey = standardKey;
                  break;
                }
              }
              newItem[newKey] = item[key];
            });
            return newItem;
          }).filter(item => item['Nombre del Proyecto']);
          
          setDemand2Data(normalized);
          setLoading(false);
          setActiveTab('demand2');
        } else {
          throw new Error("No se pudo procesar la Demanda Estratégica");
        }
      } catch (err) {
        console.error(err);
        alert('Error procesando el archivo: ' + err.message);
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const getFilterOptions = (field) => {
    let source = [];
    if (activeTab === 'trend') source = data?.trend || [];
    else if (activeTab === 'portfolio') source = data?.portfolio || [];
    else if (activeTab === 'demand') source = data?.demand || [];
    else if (activeTab === 'weekly') source = data?.weekly || [];
    else if (activeTab === 'demand2') source = demand2Data || [];
    return [...new Set(source.map(i => i[field]))].filter(Boolean).sort();
  };

  // Filtered Data based on sidebar
  const filteredPortfolio = useMemo(() => {
    if (!data?.portfolio) return [];

    // Get set of prioritized project names from trend data
    const prioritizedProjectNames = new Set(
      (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
    );

    return data.portfolio.filter(item => {
      const matchStatus = sidebarFilters.status === 'Todos' || item['Estado TI'] === sidebarFilters.status;
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;

      let matchChart = true;
      if (portfolioFilter) {
        matchChart = String(item[portfolioFilter.key] || '').includes(portfolioFilter.value);
      }

      const projectNameStr = String(item['Nombre del Proyecto'] || '').toLowerCase().trim();
      const isPrioritized = prioritizedProjectNames.has(projectNameStr);

      const matchColumnFilters = Object.entries(portfolioColumnFilters).every(([key, value]) => {
        if (!value || value === 'Todos') return true;
        if (key === 'Priorizado') {
          return value === 'Sí' ? isPrioritized : !isPrioritized;
        }
        return String(item[key] || '') === String(value);
      });

      return matchStatus && matchPortfolio && matchChart && matchColumnFilters;
    });
  }, [data, sidebarFilters, topPortfolio, portfolioColumnFilters, portfolioFilter]);

  const filteredDemand = useMemo(() => {
    if (!data?.demand) return [];

    // Get set of prioritized project names from trend data
    const prioritizedProjectNames = new Set(
      (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
    );

    return data.demand.filter(item => {
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;
      const matchStatus = sidebarFilters.status === 'Todos' || item['Estado Proyecto TI'] === sidebarFilters.status;

      let matchChart = true;
      if (demandFilter) {
        matchChart = String(item[demandFilter.key] || '').includes(demandFilter.value);
      }

      // Table Search & Column Filters
      const projectNameStr = String(item['Nombre del Proyecto'] || item['PROYECTO'] || '').toLowerCase().trim();
      const matchSearch = tableSearch === '' || projectNameStr.includes(tableSearch.toLowerCase());

      const isPrioritized = prioritizedProjectNames.has(projectNameStr);

      const matchColumnFilters = Object.entries(tableColumnFilters).every(([key, value]) => {
        if (!value || value === 'Todos') return true;
        if (key === 'Priorizado') {
          return value === 'Sí' ? isPrioritized : !isPrioritized;
        }
        if (key === 'Salud') {
          return getDemandProjectHealth(item).label === value;
        }
        if (key === 'Nombre del Proyecto') {
          const val = item['Nombre del Proyecto'] || item['PROYECTO'] || '';
          return String(val) === String(value);
        }
        return String(item[key] || '') === String(value);
      });

      return matchStatus && matchPortfolio && matchChart && matchSearch && matchColumnFilters;
    });
  }, [data, sidebarFilters.status, topPortfolio, demandFilter, tableSearch, tableColumnFilters]);

  const stats = useMemo(() => {
    const total = filteredPortfolio.length;
    const inProgress = filteredPortfolio.filter(p => {
      const s = String(p['Estado TI'] || p['Estado de TI'] || '').toLowerCase();
      return s.includes('02') || s.includes('curso') || s.includes('ejecución');
    }).length;
    const implemented = filteredPortfolio.filter(p => {
      const s = String(p['Estado TI'] || p['Estado de TI'] || '').toLowerCase();
      return s.includes('03') || s.includes('implementado');
    }).length;
    const notStarted = filteredPortfolio.filter(p => {
      const s = String(p['Estado TI'] || p['Estado de TI'] || '').toLowerCase();
      return s.includes('01') || s.includes('no iniciado');
    }).length;
    const closed = filteredPortfolio.filter(p => {
      const s = String(p['Estado TI'] || p['Estado de TI'] || '').toLowerCase();
      return s.includes('04') || s.includes('cerrado') || s.includes('finalizado');
    }).length;
    const budget = filteredPortfolio.reduce((acc, p) => acc + (Number(p['Presupuesto asignado']) || 0), 0);

    // Use the centralized calculation function for demand stats
    const demandStats = calculateDemandStats(filteredDemand);

    return {
      total, inProgress, implemented, notStarted, closed, budget,
      ...demandStats
    };
  }, [filteredPortfolio, filteredDemand]);

  const managementData = useMemo(() => {
    const counts = {};
    filteredPortfolio.forEach(p => {
      const mgmt = p['Gerencia Líder'] || 'No Definido';
      counts[mgmt] = (counts[mgmt] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredPortfolio]);

  const statusData = useMemo(() => {
    const counts = {};
    filteredPortfolio.forEach(p => {
      const status = p['Estado'] || 'No Definido';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredPortfolio]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectName) return null;
    return data?.portfolio?.find(p => p['Nombre del Proyecto'] === selectedProjectName);
  }, [data, selectedProjectName]);

  const projectTrend = useMemo(() => {
    // If no specific project is selected, we show average of projects that match current sidebar/top filters
    const projectsToInclude = selectedProjectName === null
      ? data?.trend?.filter(t => {
        const matchMgmt = sidebarFilters.management === 'Todas' || t['Gerencia Líder'] === sidebarFilters.management;
        const matchDimension = sidebarFilters.dimension === 'Todas' || t['Dimensión'] === sidebarFilters.dimension;
        const matchPortfolio = topPortfolio === 'Todas' || t['Cartera'] === topPortfolio;
        return matchMgmt && matchDimension && matchPortfolio;
      })
      : data?.trend?.filter(t =>
        String(t['Proyecto']).trim().toLowerCase() === String(selectedProjectName).trim().toLowerCase()
      );

    if (!projectsToInclude || projectsToInclude.length === 0) return [];

    const keys = Object.keys(projectsToInclude[0] || {});
    // Improved timepoint detection: Look for patterns like "ENE 2024 Plan", "2023 Plan" or simply "2023"
    const timepoints = [...new Set(keys.filter(k => k.includes(' Plan') || k === '2023').map(k => k.replace(' Plan', '').trim()))];

    const monthOrder = {
      'ENE': 1, 'FEB': 2, 'MAR': 3, 'ABR': 4, 'MAY': 5, 'JUN': 6,
      'JUL': 7, 'AGO': 8, 'SET': 9, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DIC': 12
    };

    const sortedTimepoints = timepoints.sort((a, b) => {
      if (a === '2023') return -1;
      if (b === '2023') return 1;

      // Match "ENE 2024" or "%ENE 2024"
      const matchA = a.match(/(?:%?\s*)(\w+)\s+(\d{4})/);
      const matchB = b.match(/(?:%?\s*)(\w+)\s+(\d{4})/);

      if (!matchA || !matchB) return 0;

      const yearA = parseInt(matchA[2]);
      const yearB = parseInt(matchB[2]);
      const monthA = matchA[1].substring(0, 3).toUpperCase();
      const monthB = matchB[1].substring(0, 3).toUpperCase();

      if (yearA !== yearB) return yearA - yearB;
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });

    const parseVal = (v) => {
      if (v === null || v === undefined || v === '-' || v === '') return null;
      let s = String(v).replace('%', '').replace(',', '.').trim();
      let n = parseFloat(s);
      if (isNaN(n)) return null;
      // If the value is like 0.85 and it's from a percentage column, it might need * 100
      // But usually Excel reader already handles % as decimals or whole numbers.
      // Based on previous logic, let's keep it consistent.
      return (n <= 1.1 && typeof v === 'number') ? n * 100 : n;
    };

    return sortedTimepoints.map(tp => {
      // For the year 2023, we use the specific '2023' key and assume 100% plan
      const planValues = projectsToInclude.map(p => tp === '2023' ? 100 : parseVal(p[`${tp} Plan`])).filter(v => v !== null);
      const execValues = projectsToInclude.map(p => parseVal(p[tp === '2023' ? '2023' : `${tp} Exec`])).filter(v => v !== null);

      return {
        month: tp.replace('%', '').trim(),
        plan: planValues.length > 0 ? parseFloat((planValues.reduce((a, b) => a + b, 0) / planValues.length).toFixed(2)) : null,
        exec: execValues.length > 0 ? parseFloat((execValues.reduce((a, b) => a + b, 0) / execValues.length).toFixed(2)) : null
      };
    }).filter(d => d.plan !== null || d.exec !== null);
  }, [selectedProjectName, sidebarFilters.management, sidebarFilters.dimension, topPortfolio, data?.trend]);

  const filteredDemand2 = useMemo(() => {
    if (!demand2Data) return [];

    return demand2Data.filter(item => {
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;
      const matchStatus = sidebarFilters.status === 'Todos' || item['Estado Proyecto TI'] === sidebarFilters.status;
      
      let matchChart = true;
      if (demandFilter) {
        matchChart = String(item[demandFilter.key] || '').includes(demandFilter.value);
      }
      
      const projectNameStr = String(item['Nombre del Proyecto'] || item['PROYECTO'] || '').toLowerCase().trim();
      const matchSearch = tableSearch === '' || projectNameStr.includes(tableSearch.toLowerCase());

      const matchColumnFilters = Object.entries(tableColumnFilters).every(([key, value]) => {
        if (!value || value === 'Todos') return true;
        if (key === 'Nombre del Proyecto') {
          const val = item['Nombre del Proyecto'] || item['PROYECTO'] || '';
          return String(val) === String(value);
        }
        return String(item[key] || '') === String(value);
      });
      
      return matchStatus && matchPortfolio && matchChart && matchSearch && matchColumnFilters;
    });
  }, [demand2Data, sidebarFilters.status, topPortfolio, demandFilter, tableSearch, tableColumnFilters]);

  const filteredWeekly = useMemo(() => {
    if (!data?.weekly) return [];
    return data.weekly.filter(item => {
      const matchMgmt = sidebarFilters.management === 'Todas' || item['Gerencia Líder'] === sidebarFilters.management;
      const matchDimension = sidebarFilters.dimension === 'Todas' || item['Dimensión'] === sidebarFilters.dimension;
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;
      const matchProject = !selectedProjectName || item['PROYECTO'] === selectedProjectName || item['Nombre del Proyecto'] === selectedProjectName;
      return matchMgmt && matchDimension && matchPortfolio && matchProject;
    });
  }, [data, sidebarFilters.management, sidebarFilters.dimension, topPortfolio, selectedProjectName]);

  const associatedDemands = useMemo(() => {
    if (!selectedProjectName || !data?.demand) return [];
    return data.demand.filter(d =>
      String(d['Nombre del Proyecto'] || '') === String(selectedProjectName) ||
      String(d['PROYECTO'] || '') === String(selectedProjectName) ||
      String(d['ID'] || '') === String(selectedProjectName)
    );
  }, [data, selectedProjectName]);

  const trendStats = useMemo(() => {
    const counts = {};
    const trendData = data?.trend || [];

    // Apply filters to trend data
    const filteredTrend = trendData.filter(t => {
      const matchMgmt = sidebarFilters.management === 'Todas' || t['Gerencia Líder'] === sidebarFilters.management;
      const matchDimension = sidebarFilters.dimension === 'Todas' || t['Dimensión'] === sidebarFilters.dimension;
      const matchPortfolio = topPortfolio === 'Todas' || t['Cartera'] === topPortfolio;
      if (!matchMgmt || !matchDimension || !matchPortfolio) return false;
      if (selectedProjectName && t['Proyecto'] !== selectedProjectName) return false;
      if (trendFilter && !Object.keys(t).some(k => k.includes(trendFilter.month))) return false;
      return true;
    });

    const total = filteredTrend.length;
    filteredTrend.forEach(t => {
      const s = t['Estado'] || 'Sin Estado';
      counts[s] = (counts[s] || 0) + 1;
    });
    return { total, counts };
  }, [data?.trend, selectedProjectName, trendFilter, sidebarFilters.management, sidebarFilters.dimension, topPortfolio]);

  const trendByYear = useMemo(() => {
    const years = {};
    projectTrend.forEach(pt => {
      const match = pt.month.match(/\d{4}/);
      const year = match ? match[0] : 'Otros';
      if (!years[year]) years[year] = { year, plan: 0, exec: 0, count: 0 };
      years[year].plan += pt.plan || 0;
      years[year].exec += pt.exec || 0;
      years[year].count += 1;
    });
    return Object.values(years).map(y => ({
      name: y.year,
      plan: parseFloat((y.plan / y.count).toFixed(2)),
      exec: parseFloat((y.exec / y.count).toFixed(2))
    }));
  }, [projectTrend]);


  const renderDemandDashboard = () => {
    const stats = calculateDemandStats(filteredDemand);

    const getUniqueValues = (key, isPortfolio = false) => {
      const source = isPortfolio ? data?.portfolio || [] : data?.demand || [];
      const values = source
        .map(item => {
          if (!isPortfolio) {
            if (key === 'Salud') return getDemandProjectHealth(item).label;
            if (key === 'Nombre del Proyecto') return item['Nombre del Proyecto'] || item['PROYECTO'];
          } else {
            if (key === 'Priorizado') {
              const prioritizedProjectNames = new Set(
                (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
              );
              return prioritizedProjectNames.has(String(item['Nombre del Proyecto'] || '').toLowerCase().trim()) ? 'Sí' : 'No';
            }
          }
          return item[key];
        })
        .filter(v => v !== null && v !== undefined && v !== '');
      return Array.from(new Set(values)).sort();
    };

    const handleFilterClick = (key, e, isPortfolio = false) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      if (activeFilterMenu?.key === key && activeFilterMenu?.isPortfolio === isPortfolio) {
        setActiveFilterMenu(null);
      } else {
        setActiveFilterMenu({ key, rect, isPortfolio });
      }
    };

    if (showStrategicDetail && selectedProjectName) {
      const project = data.demand.find(d => (d['Nombre del Proyecto'] || d['PROYECTO']) === selectedProjectName);

      const projectDemands = data.demand.filter(d => (d['Nombre del Proyecto'] || d['PROYECTO']) === selectedProjectName);
      const totalReqs = projectDemands.length;
      const completedReqs = projectDemands.filter(d => (d['Estado TI'] || '').toLowerCase().includes('04') || (d['Estado TI'] || '').toLowerCase().includes('finalizado')).length;
      const progress = totalReqs > 0 ? (completedReqs / totalReqs) * 100 : 0;

      const startDate = excelDateToJSDate(project?.['Fecha Inicio- Plan'] || project?.['Fecha Inicio']);
      const endDate = excelDateToJSDate(project?.['Fecha Fin- Plan'] || project?.['Fecha Fin']);

      const projectHealth = getDemandProjectHealth(project);

      // Associated Requirements (by ID Dependencia)
      const projectId = project?.['ID'];
      const associatedReqs = data.demand.filter(d => String(d['ID Dependencia'] || '') === String(projectId));

      return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
          <div className="flex items-center justify-between bg-white p-4 border border-gray-200 rounded shadow-sm">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowStrategicDetail(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-corporate-dark leading-tight">Detalle de Requerimiento</h2>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{selectedProjectName}</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="bg-blue-50 px-3 py-1 rounded border border-blue-100 text-[10px] font-bold text-blue-700 uppercase">
                ID: {projectId || '-'}
              </div>
              <div className="bg-green-50 px-3 py-1 rounded border border-green-100 text-[10px] font-bold text-green-700 uppercase">
                ESTADO: {project?.['Estado TI'] || '-'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <InfoBox label="Líder del Proyecto" value={project?.['Líder del Proyecto'] || project?.['Responsable']} />
            <InfoBox label="Gerencia Líder" value={project?.['Gerencia Líder']} />
            <InfoBox label="Gestor de TI" value={project?.['Gestor de TI'] || project?.['Gestor TI']} />
            <InfoBox label="Líder Técnico" value={project?.['Líder Técnico'] || project?.['Responsable Técnico']} />
            <InfoBox label="Estado" value={project?.['Estado Proyecto TI']} />
            <InfoBox label="Categoría" value={project?.['Categoría']} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoBox label="Fecha Inicio- Plan" value={startDate} />
            <InfoBox label="Fecha Fin- Plan" value={endDate} />
            <InfoBox label="Fecha Fin Real (CQ)" value={excelDateToJSDate(project?.['Fecha Fin Ral (CQ)'] || project?.['Fecha Fin Real'])} />
          </div>

          {/* New Relevant Data Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoBox label="Cartera" value={project?.['Cartera']} />
            <InfoBox label="Prioridad" value={project?.['Prioridad'] || 'Media'} />
            <InfoBox
              label="Salud del Proyecto"
              value={
                <div className="flex items-center justify-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", projectHealth.bg)} />
                  <span className={projectHealth.color}>{projectHealth.label}</span>
                </div>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Avance del Proyecto (Plan vs Real)</h3>
              <div className="flex justify-between items-center mb-1 px-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">{startDate}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">{endDate}</span>
              </div>
              <div className="space-y-8 py-4 border-t border-gray-100">
                <TimelineProgressBar
                  label="% Planificado"
                  percent={project?.['% Avance Planificado']}
                  color="bg-green-500"
                  startDate={startDate}
                  endDate={endDate}
                  showDates={true}
                />
                <TimelineProgressBar
                  label="% Ejecutado"
                  percent={project?.['% Avance ejecutado']}
                  color="bg-amber-500"
                  startDate={startDate}
                  endDate={endDate}
                  showDates={true}
                />
              </div>
            </div>

            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Requerimientos Asociados</h3>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">
                  {associatedReqs.length} TOTAL
                </span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 min-h-[250px] max-h-[320px] custom-scrollbar">
                {associatedReqs.length > 0 ? (
                  <div className="space-y-2">
                    {associatedReqs.map((req, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded hover:border-blue-200 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[9px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            ID: {req['ID']}
                          </span>
                          <span className={cn(
                            "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border",
                            (req['Estado TI'] || '').toLowerCase().includes('04') ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-100 text-gray-600 border-gray-200"
                          )}>
                            {req['Estado TI']}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-800 line-clamp-1">{req['Nombre del Proyecto'] || req['PROYECTO']}</p>
                        <div className="flex justify-between items-center mt-2">
                          <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden mr-4">
                            <div
                              className="h-full bg-blue-600"
                              style={{ width: `${(parseFloat(req['% Avance ejecutado']) || 0) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-gray-500">{formatPercent(req['% Avance ejecutado'])}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                    <Activity className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[10px] uppercase font-bold tracking-tighter text-center">No hay requerimientos asociados<br />(ID Dependencia: {projectId})</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 mt-6">
            <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wider">Seguimiento (Planeamiento y Control de Gestión)</h3>
                <MessageSquare className="w-4 h-4 text-gray-400" />
              </div>
              <div className="p-6 text-sm text-gray-700 leading-relaxed overflow-y-auto max-h-[320px] custom-scrollbar">
                {formatSeguimiento(
                  project['Seguimiento Planeamiento'] ||
                  project['SEGUIMIENTO (Planeamiento y Control de Gestión)'] ||
                  project['SEGUIMIENTO']
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Filter indicator for cross-filtering and table filters */}
        {(demandFilter || Object.keys(tableColumnFilters).length > 0) && (
          <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <Filter className="w-4 h-4 text-blue-600 shrink-0" />

            {demandFilter && (
              <div className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                <span className="text-blue-400 mr-1 uppercase">{demandFilter.key}:</span>
                <span className="uppercase">{demandFilter.value}</span>
                <button onClick={() => setDemandFilter(null)} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {tableSearch && (
              <div className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                <span className="text-blue-400 mr-1 uppercase">Búsqueda:</span>
                <span className="uppercase">{tableSearch}</span>
                <button onClick={() => setTableSearch('')} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {Object.entries(tableColumnFilters).map(([key, value]) => {
              if (!value || value === 'Todos') return null;
              return (
                <div key={key} className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                  <span className="text-blue-400 mr-1 uppercase">{key === 'Priorizado' ? 'Prioridad' : key}:</span>
                  <span className="uppercase">{value}</span>
                  <button
                    onClick={() => setTableColumnFilters(prev => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {(demandFilter || tableSearch || Object.values(tableColumnFilters).some(v => v && v !== 'Todos')) && (
              <button
                onClick={() => {
                  setDemandFilter(null);
                  setTableSearch('');
                  setTableColumnFilters({});
                }}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline ml-2"
              >
                Limpiar todo
              </button>
            )}
          </div>
        )}

        {/* KPIs Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2">
          <KPICard label="Nº Requerimientos" value={stats.totalDemand} />
          <KPICard label="Nº Proyectos" value={stats.uniqueProjectCount} colorClass="text-corporate-dark" />
          <KPICard label="01. No Iniciado" value={stats.demandNoIniciado} colorClass="text-gray-600" />
          <KPICard label="02. En Ejecución" value={stats.demandEnEjecucion} colorClass="text-blue-600" />
          <KPICard label="03. Implementado" value={stats.demandImplementado} colorClass="text-green-600" />
          <KPICard label="04. Finalizado" value={stats.demandFinalizado} colorClass="text-corporate-dark" />
          <KPICard label="05. Descartado" value={stats.demandDescartado} colorClass="text-gray-400" />
          <KPICard label="Avance Plan" value={formatPercent(stats.avgPlan)} colorClass="text-blue-700" />
          <KPICard label="Avance Real" value={formatPercent(stats.avgExec)} colorClass="text-blue-900" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Categorías por Requerimiento - Pie Chart */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
              TOTAL: {filteredDemand.length}
            </div>
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">Categorías por Requerimiento</h3>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(() => {
                      const counts = {};
                      filteredDemand.forEach(d => {
                        let s = d['Categoría'] || 'Sin Categoría';
                        if (s instanceof Date || !isNaN(parseFloat(s)) && isFinite(s) || (typeof s === 'string' && s.match(/^\d{2}\/\d{2}\/\d{4}$/))) {
                          s = 'Otros';
                        }
                        counts[s] = (counts[s] || 0) + 1;
                      });
                      return Object.entries(counts).map(([name, value]) => ({ name, value }));
                    })()}
                    outerRadius={80}
                    innerRadius={0}
                    dataKey="value"
                    labelLine={true}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    stroke="#fff"
                    strokeWidth={2}
                    onClick={(data) => {
                      if (demandFilter?.value === data.name) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Categoría', value: data.name });
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {COLORS.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{
                      fontSize: '9px',
                      paddingTop: '20px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Requerimientos por Estado TI - Horizontal Bar Chart (Replaced Funnel) */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
              TOTAL: {filteredDemand.length}
            </div>
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">Requerimientos por Estado TI</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  data={(() => {
                    const counts = {};
                    filteredDemand.forEach(d => {
                      const s = d['Estado TI'] || 'Sin Estado';
                      counts[s] = (counts[s] || 0) + 1;
                    });
                    return Object.entries(counts)
                      .map(([name, value]) => ({ name, value }))
                      .sort((a, b) => b.value - a.value);
                  })()}
                  onClick={(data) => {
                    if (data && data.activePayload) {
                      const val = data.activePayload[0].payload.name;
                      if (demandFilter?.value === val) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Estado TI', value: val });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" fontSize={9} hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    fontSize={8}
                    width={110}
                    tick={{ fill: '#4b5563', fontWeight: 'bold' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-200 shadow-lg rounded text-[10px]">
                            <p className="font-bold text-corporate-dark">{payload[0].payload.name}</p>
                            <p className="text-blue-600 font-bold">Total: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} className="cursor-pointer">
                    {(() => {
                      const counts = {};
                      filteredDemand.forEach(d => {
                        const s = d['Estado TI'] || 'Sin Estado';
                        counts[s] = (counts[s] || 0) + 1;
                      });
                      return Object.entries(counts)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ));
                    })()}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Requerimientos por Gerencia - Treemap Chart */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
              TOTAL: {filteredDemand.length}
            </div>
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">Requerimientos por Gerencia</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={(() => {
                    const mgmtData = {};
                    filteredDemand.forEach(d => {
                      let mgmt = d['Gerencia Líder'] || 'Otras';
                      if (mgmt.includes('Tecnologias de Informacion')) mgmt = 'TI';
                      if (!mgmtData[mgmt]) mgmtData[mgmt] = { name: mgmt, size: 0 };
                      mgmtData[mgmt].size++;
                    });
                    return Object.values(mgmtData).sort((a, b) => b.size - a.size);
                  })()}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  fill="#8884d8"
                  content={(props) => {
                    const { x, y, width, height, index, name, size } = props;
                    if (!name) return null;

                    // Logic to truncate text if it doesn't fit
                    const maxChars = Math.floor(width / 6);
                    const displayName = name.length > maxChars ? name.substring(0, Math.max(0, maxChars - 3)) + '...' : name;

                    return (
                      <g>
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          style={{
                            fill: COLORS[index % COLORS.length],
                            stroke: '#fff',
                            strokeWidth: 1,
                          }}
                        />
                        {width > 25 && height > 20 && (
                          <>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 - 2}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={9}
                            >
                              {displayName}
                            </text>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 + 10}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={8}
                            >
                              {size}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  }}
                  onClick={(data) => {
                    if (data && data.name) {
                      if (demandFilter?.value === data.name) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Gerencia Líder', value: data.name });
                      }
                    }
                  }}
                >
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-200 shadow-lg rounded text-[10px]">
                            <p className="font-bold text-corporate-dark">{payload[0].payload.name}</p>
                            <p className="text-blue-600 font-bold">Total: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Proyectos vs Proyectos-Hijo by Gerencia */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                Distribución por Gerencia
              </h3>
              <div className="flex items-center space-x-4">
                <div className="bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
                  TOTAL: {(() => {
                    const uniqueItems = new Set();
                    filteredDemand.forEach(d => {
                      const type = String(d['Tipo'] || '').trim();
                      if (demandChartType === 'childProjects') {
                        if (type === 'Proyecto-Hijo') uniqueItems.add(d['ID'] || d['Nombre del Proyecto']);
                      } else {
                        if (type === 'Proyecto') uniqueItems.add(d['Nombre del Proyecto'] || d['PROYECTO']);
                      }
                    });
                    return uniqueItems.size;
                  })()}
                </div>
                <div className="flex bg-gray-100 p-1 rounded">
                  <button
                    onClick={() => setDemandChartType('projects')}
                    className={cn("px-3 py-1 text-[9px] font-bold rounded", demandChartType === 'projects' ? "bg-white shadow-sm text-corporate-dark" : "text-gray-500")}
                  >
                    Proyecto
                  </button>
                  <button
                    onClick={() => setDemandChartType('childProjects')}
                    className={cn("px-3 py-1 text-[9px] font-bold rounded", demandChartType === 'childProjects' ? "bg-white shadow-sm text-corporate-dark" : "text-gray-500")}
                  >
                    Proyecto-Hijo
                  </button>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(() => {
                    const counts = {};
                    filteredDemand.forEach(d => {
                      const mgmt = d['Gerencia Líder'] || 'Otras';
                      const type = String(d['Tipo'] || '').trim();

                      if (demandChartType === 'childProjects') {
                        if (type === 'Proyecto-Hijo') {
                          counts[mgmt] = (counts[mgmt] || 0) + 1;
                        }
                      } else {
                        if (type === 'Proyecto') {
                          const projectId = d['Nombre del Proyecto'] || d['PROYECTO'];
                          if (!counts[mgmt]) counts[mgmt] = new Set();
                          counts[mgmt].add(projectId);
                        }
                      }
                    });
                    return Object.entries(counts).map(([name, val]) => ({
                      name,
                      value: demandChartType === 'projects' ? val.size : val
                    })).sort((a, b) => b.value - a.value).slice(0, 10);
                  })()}
                  onClick={(data) => {
                    if (data && data.activeLabel) {
                      if (demandFilter?.value === data.activeLabel) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Gerencia Líder', value: data.activeLabel });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    height={70}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 12)}..` : value}
                  />
                  <YAxis fontSize={9} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-200 shadow-sm rounded text-[10px]">
                            <p className="font-bold">{payload[0].payload.name}</p>
                            <p className="text-blue-900">Total: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seguimiento OPP - Comments List (Latest Only) */}
          <div className="bg-white border border-gray-200 rounded shadow-sm flex flex-col h-[330px] relative">
            {selectedOpp && (
              <div className="absolute inset-0 bg-white z-10 p-6 flex flex-col animate-in fade-in duration-200">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h4 className="text-[10px] font-bold uppercase text-corporate-dark truncate flex-1 pr-4">{selectedOpp.name}</h4>
                  <button onClick={() => setSelectedOpp(null)} className="p-1 hover:bg-gray-100 rounded-full">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  <div className="text-[10px] bg-corporate-dark text-white px-2 py-1 rounded inline-block mb-3 font-mono">
                    {selectedOpp.date}
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-inner italic">
                    "{selectedOpp.lastComment}"
                  </div>
                  <div className="mt-4 text-[9px] text-gray-400 uppercase font-bold">
                    Solo se muestra el seguimiento más reciente
                  </div>
                </div>
              </div>
            )}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h3 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Seguimiento OPP (Último Comentario)</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(() => {
                // Group by project and find the latest comment
                const projectMap = new Map();

                filteredDemand.forEach(d => {
                  const oppText = d['OPP'];
                  if (oppText && oppText !== 'Sin OPP') {
                    const projectId = d['Nombre del Proyecto'] || d['PROYECTO'];

                    // Assuming the string starts with the latest date like "DD/MM/YYYY: ..."
                    // We split by any date pattern DD/MM/YYYY:
                    const parts = oppText.split(/(\d{2}\/\d{2}\/\d{4}:?)/);
                    let lastComment = oppText;
                    let lastDate = 'Sin fecha';

                    if (parts.length >= 3) {
                      // parts[0] might be empty if it starts with a date
                      // parts[1] is the date
                      // parts[2] is the comment text after that date
                      lastDate = parts[1].replace(':', '').trim();
                      lastComment = parts[2].trim();
                    } else {
                      const dateMatch = oppText.match(/\d{2}\/\d{2}\/\d{4}/);
                      if (dateMatch) lastDate = dateMatch[0];
                    }

                    if (!projectMap.has(projectId)) {
                      projectMap.set(projectId, {
                        name: projectId,
                        date: lastDate,
                        lastComment: lastComment
                      });
                    }
                  }
                });

                return Array.from(projectMap.values()).map((c, i) => (
                  <div
                    key={i}
                    className="bg-white p-3 rounded border border-gray-100 border-l-4 border-corporate-dark cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedOpp(c)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-[10px] font-bold text-corporate-dark uppercase truncate flex-1">
                        {c.name}
                      </div>
                      <div className="text-[9px] bg-corporate-dark text-white px-1.5 py-0.5 rounded font-mono ml-2">
                        {c.date}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-600 italic leading-relaxed line-clamp-2">
                      "{c.lastComment}"
                    </div>
                  </div>
                ));
              })()}
              {filteredDemand.filter(d => d['OPP'] && d['OPP'] !== 'Sin OPP').length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-10">
                  No hay comentarios de seguimiento registrados.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Detalle de Demanda Estratégica</h3>
              <span className="text-[9px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold w-fit">{filteredDemand.length} requerimientos</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar proyecto..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>

              <select
                className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={tableColumnFilters['Priorizado'] || 'Todos'}
                onChange={(e) => setTableColumnFilters(prev => ({ ...prev, 'Priorizado': e.target.value }))}
              >
                <option value="Todos">Todos</option>
                <option value="Sí">Priorizados</option>
                <option value="No">No Priorizados</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-[11px] table-fixed">
              <thead>
                <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200">
                  <th className="px-4 py-3 w-16 group relative">
                    <div className="flex items-center justify-between">
                      <span>ID</span>
                      <button onClick={(e) => handleFilterClick('ID', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['ID'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-56 group relative">
                    <div className="flex items-center justify-between">
                      <span>Proyecto</span>
                      <button onClick={(e) => handleFilterClick('Nombre del Proyecto', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Nombre del Proyecto'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-40 group relative">
                    <div className="flex items-center justify-between">
                      <span>Gerencia Líder</span>
                      <button onClick={(e) => handleFilterClick('Gerencia Líder', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Gerencia Líder'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-32 group relative">
                    <div className="flex items-center justify-between">
                      <span>Estado TI</span>
                      <button onClick={(e) => handleFilterClick('Estado TI', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Estado TI'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-28 group relative">
                    <div className="flex items-center justify-between">
                      <span>Salud</span>
                      <button onClick={(e) => handleFilterClick('Salud', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Salud'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-32 text-center">Avance P/R</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const prioritizedProjectNames = new Set(
                    (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
                  );

                  return filteredDemand.map((d, i) => {
                    const isPrioritized = prioritizedProjectNames.has(String(d['Nombre del Proyecto'] || d['PROYECTO'] || '').toLowerCase().trim());

                    const projectHealth = getDemandProjectHealth(d);

                    return (
                      <tr key={i} className={cn(
                        "hover:bg-gray-50 transition-colors cursor-pointer border-l-4",
                        isPrioritized ? "bg-amber-50/70 border-l-amber-400" : "border-l-transparent"
                      )}
                        onClick={() => {
                          setSelectedProjectName(d['Nombre del Proyecto'] || d['PROYECTO']);
                          setShowStrategicDetail(true);
                        }}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-gray-400 truncate">{d['ID'] || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isPrioritized && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
                            <div className={cn(
                              "font-bold leading-tight line-clamp-2",
                              isPrioritized ? "text-amber-900" : "text-gray-800"
                            )}>
                              {d['Nombre del Proyecto'] || d['PROYECTO']}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 truncate">{d['Gerencia Líder']}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-fit">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border block truncate",
                              (d['Estado TI'] || '').toLowerCase().includes('04') || (d['Estado TI'] || '').toLowerCase().includes('finalizado') ? "bg-green-50 text-green-700 border-green-100" :
                                (d['Estado TI'] || '').toLowerCase().includes('02') || (d['Estado TI'] || '').toLowerCase().includes('desarrollo') ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-600 border-gray-100"
                            )} title={d['Estado TI']}>{d['Estado TI']}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn(
                            "font-bold text-[9px]",
                            projectHealth.color
                          )}>{projectHealth.emoji} {projectHealth.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="font-bold text-gray-700">{formatPercent(d['% Avance Planificado'])}</div>
                          <div className="text-blue-600 font-bold">{formatPercent(d['% Avance ejecutado'])}</div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filter Dropdown Menu */}
        {activeFilterMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded shadow-xl min-w-[160px] max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: activeFilterMenu.rect.bottom + 5,
              left: Math.min(window.innerWidth - 180, activeFilterMenu.rect.left)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-[9px] font-bold uppercase text-gray-500">Filtrar {activeFilterMenu.key}</span>
              <button onClick={() => {
                setTableColumnFilters(prev => {
                  const next = { ...prev };
                  delete next[activeFilterMenu.key];
                  return next;
                });
                setActiveFilterMenu(null);
              }} className="text-[9px] text-blue-600 hover:underline">Limpiar</button>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  if (activeFilterMenu.isPortfolio) {
                    setPortfolioColumnFilters(prev => {
                      const next = { ...prev };
                      delete next[activeFilterMenu.key];
                      return next;
                    });
                  } else {
                    setTableColumnFilters(prev => {
                      const next = { ...prev };
                      delete next[activeFilterMenu.key];
                      return next;
                    });
                  }
                  setActiveFilterMenu(null);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors flex items-center justify-between",
                  activeFilterMenu.isPortfolio
                    ? (!portfolioColumnFilters[activeFilterMenu.key] || portfolioColumnFilters[activeFilterMenu.key] === 'Todos')
                    : (!tableColumnFilters[activeFilterMenu.key] || tableColumnFilters[activeFilterMenu.key] === 'Todos')
                      ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"
                )}
              >
                <span>(Todos)</span>
              </button>
              {getUniqueValues(activeFilterMenu.key, activeFilterMenu.isPortfolio).map((val, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (activeFilterMenu.isPortfolio) {
                      setPortfolioColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                    } else {
                      setTableColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                    }
                    setActiveFilterMenu(null);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors flex items-center justify-between",
                    (activeFilterMenu.isPortfolio ? portfolioColumnFilters[activeFilterMenu.key] : tableColumnFilters[activeFilterMenu.key]) === val ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"
                  )}
                >
                  <span className="truncate">{val}</span>
                  {(activeFilterMenu.isPortfolio ? portfolioColumnFilters[activeFilterMenu.key] : tableColumnFilters[activeFilterMenu.key]) === val && <CheckCircle2 className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDemand2Dashboard = () => {
    const stats = calculateDemandStats(filteredDemand2);

    const getUniqueValues = (key, isPortfolio = false) => {
      const source = isPortfolio ? data?.portfolio || [] : demand2Data || [];
      const values = source
        .map(item => {
          if (!isPortfolio) {
            if (key === 'Salud') return getDemandProjectHealth(item).label;
            if (key === 'Nombre del Proyecto') return item['Nombre del Proyecto'] || item['PROYECTO'];
          } else {
            if (key === 'Priorizado') {
              const prioritizedProjectNames = new Set(
                (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
              );
              return prioritizedProjectNames.has(String(item['Nombre del Proyecto'] || '').toLowerCase().trim()) ? 'Sí' : 'No';
            }
          }
          return item[key];
        })
        .filter(v => v !== null && v !== undefined && v !== '');
      return Array.from(new Set(values)).sort();
    };

    const handleFilterClick = (key, e, isPortfolio = false) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      if (activeFilterMenu?.key === key && activeFilterMenu?.isPortfolio === isPortfolio) {
        setActiveFilterMenu(null);
      } else {
        setActiveFilterMenu({ key, rect, isPortfolio });
      }
    };

    if (showStrategicDetail && selectedProjectName) {
      const project = demand2Data.find(d => (d['Nombre del Proyecto'] || d['PROYECTO']) === selectedProjectName);

      const projectDemands = demand2Data.filter(d => (d['Nombre del Proyecto'] || d['PROYECTO']) === selectedProjectName);
      const totalReqs = projectDemands.length;
      const completedReqs = projectDemands.filter(d => (d['Estado TI'] || '').toLowerCase().includes('04') || (d['Estado TI'] || '').toLowerCase().includes('finalizado')).length;
      const progress = totalReqs > 0 ? (completedReqs / totalReqs) * 100 : 0;

      const startDate = excelDateToJSDate(project?.['Fecha Inicio- Plan'] || project?.['Fecha Inicio']);
      const endDate = excelDateToJSDate(project?.['Fecha Fin- Plan'] || project?.['Fecha Fin']);

      const projectHealth = getDemandProjectHealth(project);

      // Associated Requirements (by ID Dependencia)
      const projectId = project?.['ID'];
      const associatedReqs = demand2Data.filter(d => String(d['ID Dependencia'] || '') === String(projectId));

      return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
          <div className="flex items-center justify-between bg-white p-4 border border-gray-200 rounded shadow-sm">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowStrategicDetail(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-corporate-dark leading-tight">Detalle de Requerimiento</h2>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{selectedProjectName}</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="bg-blue-50 px-3 py-1 rounded border border-blue-100 text-[10px] font-bold text-blue-700 uppercase">
                ID: {projectId || '-'}
              </div>
              <div className="bg-green-50 px-3 py-1 rounded border border-green-100 text-[10px] font-bold text-green-700 uppercase">
                ESTADO: {project?.['Estado TI'] || '-'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <InfoBox label="Líder del Proyecto" value={project?.['Líder del Proyecto'] || project?.['Responsable']} />
            <InfoBox label="Gerencia Líder" value={project?.['Gerencia Líder']} />
            <InfoBox label="Gestor de TI" value={project?.['Gestor de TI'] || project?.['Gestor TI']} />
            <InfoBox label="Líder Técnico" value={project?.['Líder Técnico'] || project?.['Responsable Técnico']} />
            <InfoBox label="Estado" value={project?.['Estado Proyecto TI']} />
            <InfoBox label="Categoría" value={project?.['Categoría']} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoBox label="Fecha Inicio- Plan" value={startDate} />
            <InfoBox label="Fecha Fin- Plan" value={endDate} />
            <InfoBox label="Fecha Fin Real (CQ)" value={excelDateToJSDate(project?.['Fecha Fin Ral (CQ)'] || project?.['Fecha Fin Real'])} />
          </div>

          {/* New Relevant Data Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoBox label="Cartera" value={project?.['Cartera']} />
            <InfoBox label="Prioridad" value={project?.['Prioridad'] || 'Media'} />
            <InfoBox
              label="Salud del Proyecto"
              value={
                <div className="flex items-center justify-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", projectHealth.bg)} />
                  <span className={projectHealth.color}>{projectHealth.label}</span>
                </div>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Avance del Proyecto (Plan vs Real)</h3>
              <div className="flex justify-between items-center mb-1 px-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">{startDate}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">{endDate}</span>
              </div>
              <div className="space-y-8 py-4 border-t border-gray-100">
                <TimelineProgressBar
                  label="% Planificado"
                  percent={project?.['% Avance Planificado']}
                  color="bg-green-500"
                  startDate={startDate}
                  endDate={endDate}
                  showDates={true}
                />
                <TimelineProgressBar
                  label="% Ejecutado"
                  percent={project?.['% Avance ejecutado']}
                  color="bg-amber-500"
                  startDate={startDate}
                  endDate={endDate}
                  showDates={true}
                />
              </div>
            </div>

            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Requerimientos Asociados</h3>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">
                  {associatedReqs.length} TOTAL
                </span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 min-h-[250px] max-h-[320px] custom-scrollbar">
                {associatedReqs.length > 0 ? (
                  <div className="space-y-2">
                    {associatedReqs.map((req, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded hover:border-blue-200 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[9px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            ID: {req['ID']}
                          </span>
                          <span className={cn(
                            "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border",
                            (req['Estado TI'] || '').toLowerCase().includes('04') ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-100 text-gray-600 border-gray-200"
                          )}>
                            {req['Estado TI']}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-800 line-clamp-1">{req['Nombre del Proyecto'] || req['PROYECTO']}</p>
                        <div className="flex justify-between items-center mt-2">
                          <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden mr-4">
                            <div
                              className="h-full bg-blue-600"
                              style={{ width: `${(parseFloat(req['% Avance ejecutado']) || 0) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-gray-500">{formatPercent(req['% Avance ejecutado'])}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                    <Activity className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[10px] uppercase font-bold tracking-tighter text-center">No hay requerimientos asociados<br />(ID Dependencia: {projectId})</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 mt-6">
            <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wider">Seguimiento (Planeamiento y Control de Gestión)</h3>
                <MessageSquare className="w-4 h-4 text-gray-400" />
              </div>
              <div className="p-6 text-sm text-gray-700 leading-relaxed overflow-y-auto max-h-[320px] custom-scrollbar">
                {formatSeguimiento(
                  project['Seguimiento Planeamiento'] ||
                  project['SEGUIMIENTO (Planeamiento y Control de Gestión)'] ||
                  project['SEGUIMIENTO']
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Filter indicator for cross-filtering and table filters */}
        {(demandFilter || Object.keys(tableColumnFilters).length > 0) && (
          <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <Filter className="w-4 h-4 text-blue-600 shrink-0" />

            {demandFilter && (
              <div className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                <span className="text-blue-400 mr-1 uppercase">{demandFilter.key}:</span>
                <span className="uppercase">{demandFilter.value}</span>
                <button onClick={() => setDemandFilter(null)} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {tableSearch && (
              <div className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                <span className="text-blue-400 mr-1 uppercase">Búsqueda:</span>
                <span className="uppercase">{tableSearch}</span>
                <button onClick={() => setTableSearch('')} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {Object.entries(tableColumnFilters).map(([key, value]) => {
              if (!value || value === 'Todos') return null;
              return (
                <div key={key} className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                  <span className="text-blue-400 mr-1 uppercase">{key === 'Priorizado' ? 'Prioridad' : key}:</span>
                  <span className="uppercase">{value}</span>
                  <button
                    onClick={() => setTableColumnFilters(prev => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {(demandFilter || tableSearch || Object.values(tableColumnFilters).some(v => v && v !== 'Todos')) && (
              <button
                onClick={() => {
                  setDemandFilter(null);
                  setTableSearch('');
                  setTableColumnFilters({});
                }}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline ml-2"
              >
                Limpiar todo
              </button>
            )}
          </div>
        )}

        {/* KPIs Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2">
          <KPICard label="Nº Requerimientos" value={stats.totalDemand} />
          <KPICard label="Nº Proyectos" value={stats.uniqueProjectCount} colorClass="text-corporate-dark" />
          <KPICard label="01. No Iniciado" value={stats.demandNoIniciado} colorClass="text-gray-600" />
          <KPICard label="02. En Ejecución" value={stats.demandEnEjecucion} colorClass="text-blue-600" />
          <KPICard label="03. Implementado" value={stats.demandImplementado} colorClass="text-green-600" />
          <KPICard label="04. Finalizado" value={stats.demandFinalizado} colorClass="text-corporate-dark" />
          <KPICard label="05. Descartado" value={stats.demandDescartado} colorClass="text-gray-400" />
          <KPICard label="Avance Plan" value={formatPercent(stats.avgPlan)} colorClass="text-blue-700" />
          <KPICard label="Avance Real" value={formatPercent(stats.avgExec)} colorClass="text-blue-900" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Categorías por Requerimiento - Pie Chart */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
              TOTAL: {filteredDemand2.length}
            </div>
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">Categorías por Requerimiento</h3>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(() => {
                      const counts = {};
                      filteredDemand2.forEach(d => {
                        let s = d['Categoría'] || 'Sin Categoría';
                        if (s instanceof Date || !isNaN(parseFloat(s)) && isFinite(s) || (typeof s === 'string' && s.match(/^\d{2}\/\d{2}\/\d{4}$/))) {
                          s = 'Otros';
                        }
                        counts[s] = (counts[s] || 0) + 1;
                      });
                      return Object.entries(counts).map(([name, value]) => ({ name, value }));
                    })()}
                    outerRadius={80}
                    innerRadius={0}
                    dataKey="value"
                    labelLine={true}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    stroke="#fff"
                    strokeWidth={2}
                    onClick={(data) => {
                      if (demandFilter?.value === data.name) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Categoría', value: data.name });
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {COLORS.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{
                      fontSize: '9px',
                      paddingTop: '20px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Requerimientos por Estado TI - Horizontal Bar Chart (Replaced Funnel) */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
              TOTAL: {filteredDemand2.length}
            </div>
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">Requerimientos por Estado TI</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  data={(() => {
                    const counts = {};
                    filteredDemand2.forEach(d => {
                      const s = d['Estado TI'] || 'Sin Estado';
                      counts[s] = (counts[s] || 0) + 1;
                    });
                    return Object.entries(counts)
                      .map(([name, value]) => ({ name, value }))
                      .sort((a, b) => b.value - a.value);
                  })()}
                  onClick={(data) => {
                    if (data && data.activePayload) {
                      const val = data.activePayload[0].payload.name;
                      if (demandFilter?.value === val) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Estado TI', value: val });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" fontSize={9} hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    fontSize={8}
                    width={110}
                    tick={{ fill: '#4b5563', fontWeight: 'bold' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-200 shadow-lg rounded text-[10px]">
                            <p className="font-bold text-corporate-dark">{payload[0].payload.name}</p>
                            <p className="text-blue-600 font-bold">Total: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} className="cursor-pointer">
                    {(() => {
                      const counts = {};
                      filteredDemand2.forEach(d => {
                        const s = d['Estado TI'] || 'Sin Estado';
                        counts[s] = (counts[s] || 0) + 1;
                      });
                      return Object.entries(counts)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ));
                    })()}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Requerimientos por Gerencia - Treemap Chart */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
              TOTAL: {filteredDemand2.length}
            </div>
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">Requerimientos por Gerencia</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={(() => {
                    const mgmtData = {};
                    filteredDemand2.forEach(d => {
                      let mgmt = d['Gerencia Líder'] || 'Otras';
                      if (mgmt.includes('Tecnologias de Informacion')) mgmt = 'TI';
                      if (!mgmtData[mgmt]) mgmtData[mgmt] = { name: mgmt, size: 0 };
                      mgmtData[mgmt].size++;
                    });
                    return Object.values(mgmtData).sort((a, b) => b.size - a.size);
                  })()}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  fill="#8884d8"
                  content={(props) => {
                    const { x, y, width, height, index, name, size } = props;
                    if (!name) return null;

                    // Logic to truncate text if it doesn't fit
                    const maxChars = Math.floor(width / 6);
                    const displayName = name.length > maxChars ? name.substring(0, Math.max(0, maxChars - 3)) + '...' : name;

                    return (
                      <g>
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          style={{
                            fill: COLORS[index % COLORS.length],
                            stroke: '#fff',
                            strokeWidth: 1,
                          }}
                        />
                        {width > 25 && height > 20 && (
                          <>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 - 2}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={9}
                            >
                              {displayName}
                            </text>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 + 10}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={8}
                            >
                              {size}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  }}
                  onClick={(data) => {
                    if (data && data.name) {
                      if (demandFilter?.value === data.name) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Gerencia Líder', value: data.name });
                      }
                    }
                  }}
                >
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-200 shadow-lg rounded text-[10px]">
                            <p className="font-bold text-corporate-dark">{payload[0].payload.name}</p>
                            <p className="text-blue-600 font-bold">Total: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Proyectos vs Proyectos-Hijo by Gerencia */}
          <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                Distribución por Gerencia
              </h3>
              <div className="flex items-center space-x-4">
                <div className="bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
                  TOTAL: {(() => {
                    const uniqueItems = new Set();
                    filteredDemand2.forEach(d => {
                      const type = String(d['Tipo'] || '').trim();
                      if (demandChartType === 'childProjects') {
                        if (type === 'Proyecto-Hijo') uniqueItems.add(d['ID'] || d['Nombre del Proyecto']);
                      } else {
                        if (type === 'Proyecto') uniqueItems.add(d['Nombre del Proyecto'] || d['PROYECTO']);
                      }
                    });
                    return uniqueItems.size;
                  })()}
                </div>
                <div className="flex bg-gray-100 p-1 rounded">
                  <button
                    onClick={() => setDemandChartType('projects')}
                    className={cn("px-3 py-1 text-[9px] font-bold rounded", demandChartType === 'projects' ? "bg-white shadow-sm text-corporate-dark" : "text-gray-500")}
                  >
                    Proyecto
                  </button>
                  <button
                    onClick={() => setDemandChartType('childProjects')}
                    className={cn("px-3 py-1 text-[9px] font-bold rounded", demandChartType === 'childProjects' ? "bg-white shadow-sm text-corporate-dark" : "text-gray-500")}
                  >
                    Proyecto-Hijo
                  </button>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(() => {
                    const counts = {};
                    filteredDemand2.forEach(d => {
                      const mgmt = d['Gerencia Líder'] || 'Otras';
                      const type = String(d['Tipo'] || '').trim();

                      if (demandChartType === 'childProjects') {
                        if (type === 'Proyecto-Hijo') {
                          counts[mgmt] = (counts[mgmt] || 0) + 1;
                        }
                      } else {
                        if (type === 'Proyecto') {
                          const projectId = d['Nombre del Proyecto'] || d['PROYECTO'];
                          if (!counts[mgmt]) counts[mgmt] = new Set();
                          counts[mgmt].add(projectId);
                        }
                      }
                    });
                    return Object.entries(counts).map(([name, val]) => ({
                      name,
                      value: demandChartType === 'projects' ? val.size : val
                    })).sort((a, b) => b.value - a.value).slice(0, 10);
                  })()}
                  onClick={(data) => {
                    if (data && data.activeLabel) {
                      if (demandFilter?.value === data.activeLabel) {
                        setDemandFilter(null);
                      } else {
                        setDemandFilter({ key: 'Gerencia Líder', value: data.activeLabel });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    height={70}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 12)}..` : value}
                  />
                  <YAxis fontSize={9} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-200 shadow-sm rounded text-[10px]">
                            <p className="font-bold">{payload[0].payload.name}</p>
                            <p className="text-blue-900">Total: {payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Seguimiento OPP - Comments List (Latest Only) */}
          <div className="bg-white border border-gray-200 rounded shadow-sm flex flex-col h-[330px] relative">
            {selectedOpp && (
              <div className="absolute inset-0 bg-white z-10 p-6 flex flex-col animate-in fade-in duration-200">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h4 className="text-[10px] font-bold uppercase text-corporate-dark truncate flex-1 pr-4">{selectedOpp.name}</h4>
                  <button onClick={() => setSelectedOpp(null)} className="p-1 hover:bg-gray-100 rounded-full">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  <div className="text-[10px] bg-corporate-dark text-white px-2 py-1 rounded inline-block mb-3 font-mono">
                    {selectedOpp.date}
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-inner italic">
                    "{selectedOpp.lastComment}"
                  </div>
                  <div className="mt-4 text-[9px] text-gray-400 uppercase font-bold">
                    Solo se muestra el seguimiento más reciente
                  </div>
                </div>
              </div>
            )}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h3 className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Seguimiento OPP (Último Comentario)</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(() => {
                // Group by project and find the latest comment
                const projectMap = new Map();

                filteredDemand2.forEach(d => {
                  const oppText = d['OPP'];
                  if (oppText && oppText !== 'Sin OPP') {
                    const projectId = d['Nombre del Proyecto'] || d['PROYECTO'];

                    // Assuming the string starts with the latest date like "DD/MM/YYYY: ..."
                    // We split by any date pattern DD/MM/YYYY:
                    const parts = oppText.split(/(\d{2}\/\d{2}\/\d{4}:?)/);
                    let lastComment = oppText;
                    let lastDate = 'Sin fecha';

                    if (parts.length >= 3) {
                      // parts[0] might be empty if it starts with a date
                      // parts[1] is the date
                      // parts[2] is the comment text after that date
                      lastDate = parts[1].replace(':', '').trim();
                      lastComment = parts[2].trim();
                    } else {
                      const dateMatch = oppText.match(/\d{2}\/\d{2}\/\d{4}/);
                      if (dateMatch) lastDate = dateMatch[0];
                    }

                    if (!projectMap.has(projectId)) {
                      projectMap.set(projectId, {
                        name: projectId,
                        date: lastDate,
                        lastComment: lastComment
                      });
                    }
                  }
                });

                return Array.from(projectMap.values()).map((c, i) => (
                  <div
                    key={i}
                    className="bg-white p-3 rounded border border-gray-100 border-l-4 border-corporate-dark cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setSelectedOpp(c)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-[10px] font-bold text-corporate-dark uppercase truncate flex-1">
                        {c.name}
                      </div>
                      <div className="text-[9px] bg-corporate-dark text-white px-1.5 py-0.5 rounded font-mono ml-2">
                        {c.date}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-600 italic leading-relaxed line-clamp-2">
                      "{c.lastComment}"
                    </div>
                  </div>
                ));
              })()}
              {filteredDemand2.filter(d => d['OPP'] && d['OPP'] !== 'Sin OPP').length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-10">
                  No hay comentarios de seguimiento registrados.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Detalle de Demanda Estratégica</h3>
              <span className="text-[9px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold w-fit">{filteredDemand2.length} requerimientos</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar proyecto..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>

              <select
                className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={tableColumnFilters['Priorizado'] || 'Todos'}
                onChange={(e) => setTableColumnFilters(prev => ({ ...prev, 'Priorizado': e.target.value }))}
              >
                <option value="Todos">Todos</option>
                <option value="Sí">Priorizados</option>
                <option value="No">No Priorizados</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-[11px] table-fixed">
              <thead>
                <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200">
                  <th className="px-4 py-3 w-16 group relative">
                    <div className="flex items-center justify-between">
                      <span>ID</span>
                      <button onClick={(e) => handleFilterClick('ID', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['ID'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-56 group relative">
                    <div className="flex items-center justify-between">
                      <span>Proyecto</span>
                      <button onClick={(e) => handleFilterClick('Nombre del Proyecto', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Nombre del Proyecto'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-40 group relative">
                    <div className="flex items-center justify-between">
                      <span>Gerencia Líder</span>
                      <button onClick={(e) => handleFilterClick('Gerencia Líder', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Gerencia Líder'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-32 group relative">
                    <div className="flex items-center justify-between">
                      <span>Estado TI</span>
                      <button onClick={(e) => handleFilterClick('Estado TI', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Estado TI'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-28 group relative">
                    <div className="flex items-center justify-between">
                      <span>Salud</span>
                      <button onClick={(e) => handleFilterClick('Salud', e)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        tableColumnFilters['Salud'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 w-32 text-center">Avance P/R</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const prioritizedProjectNames = new Set(
                    (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
                  );

                  return filteredDemand2.map((d, i) => {
                    const isPrioritized = prioritizedProjectNames.has(String(d['Nombre del Proyecto'] || d['PROYECTO'] || '').toLowerCase().trim());

                    const projectHealth = getDemandProjectHealth(d);

                    return (
                      <tr key={i} className={cn(
                        "hover:bg-gray-50 transition-colors cursor-pointer border-l-4",
                        isPrioritized ? "bg-amber-50/70 border-l-amber-400" : "border-l-transparent"
                      )}
                        onClick={() => {
                          setSelectedProjectName(d['Nombre del Proyecto'] || d['PROYECTO']);
                          setShowStrategicDetail(true);
                        }}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-gray-400 truncate">{d['ID'] || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isPrioritized && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
                            <div className={cn(
                              "font-bold leading-tight line-clamp-2",
                              isPrioritized ? "text-amber-900" : "text-gray-800"
                            )}>
                              {d['Nombre del Proyecto'] || d['PROYECTO']}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 truncate">{d['Gerencia Líder']}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-fit">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border block truncate",
                              (d['Estado TI'] || '').toLowerCase().includes('04') || (d['Estado TI'] || '').toLowerCase().includes('finalizado') ? "bg-green-50 text-green-700 border-green-100" :
                                (d['Estado TI'] || '').toLowerCase().includes('02') || (d['Estado TI'] || '').toLowerCase().includes('desarrollo') ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-600 border-gray-100"
                            )} title={d['Estado TI']}>{d['Estado TI']}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn(
                            "font-bold text-[9px]",
                            projectHealth.color
                          )}>{projectHealth.emoji} {projectHealth.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="font-bold text-gray-700">{formatPercent(d['% Avance Planificado'])}</div>
                          <div className="text-blue-600 font-bold">{formatPercent(d['% Avance ejecutado'])}</div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filter Dropdown Menu */}
        {activeFilterMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded shadow-xl min-w-[160px] max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: activeFilterMenu.rect.bottom + 5,
              left: Math.min(window.innerWidth - 180, activeFilterMenu.rect.left)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-[9px] font-bold uppercase text-gray-500">Filtrar {activeFilterMenu.key}</span>
              <button onClick={() => {
                setTableColumnFilters(prev => {
                  const next = { ...prev };
                  delete next[activeFilterMenu.key];
                  return next;
                });
                setActiveFilterMenu(null);
              }} className="text-[9px] text-blue-600 hover:underline">Limpiar</button>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  if (activeFilterMenu.isPortfolio) {
                    setPortfolioColumnFilters(prev => {
                      const next = { ...prev };
                      delete next[activeFilterMenu.key];
                      return next;
                    });
                  } else {
                    setTableColumnFilters(prev => {
                      const next = { ...prev };
                      delete next[activeFilterMenu.key];
                      return next;
                    });
                  }
                  setActiveFilterMenu(null);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors flex items-center justify-between",
                  activeFilterMenu.isPortfolio
                    ? (!portfolioColumnFilters[activeFilterMenu.key] || portfolioColumnFilters[activeFilterMenu.key] === 'Todos')
                    : (!tableColumnFilters[activeFilterMenu.key] || tableColumnFilters[activeFilterMenu.key] === 'Todos')
                      ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"
                )}
              >
                <span>(Todos)</span>
              </button>
              {getUniqueValues(activeFilterMenu.key, activeFilterMenu.isPortfolio).map((val, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (activeFilterMenu.isPortfolio) {
                      setPortfolioColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                    } else {
                      setTableColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                    }
                    setActiveFilterMenu(null);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors flex items-center justify-between",
                    (activeFilterMenu.isPortfolio ? portfolioColumnFilters[activeFilterMenu.key] : tableColumnFilters[activeFilterMenu.key]) === val ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"
                  )}
                >
                  <span className="truncate">{val}</span>
                  {(activeFilterMenu.isPortfolio ? portfolioColumnFilters[activeFilterMenu.key] : tableColumnFilters[activeFilterMenu.key]) === val && <CheckCircle2 className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  
const renderPortfolioDashboard = () => {
    const stats = calculatePortfolioStats(filteredPortfolio);

    // Get unique values for charts
    const managementData = Array.from(new Set(filteredPortfolio.map(p => p['Gerencia Líder'])))
      .map(mgmt => ({
        name: mgmt,
        value: filteredPortfolio.filter(p => p['Gerencia Líder'] === mgmt).length
      }));

    const statusData = Array.from(new Set(filteredPortfolio.map(p => p['Estado TI'] || 'Sin Estado')))
      .map(status => ({
        name: status,
        value: filteredPortfolio.filter(p => (p['Estado TI'] || 'Sin Estado') === status).length
      }));

    return (
      <div className="space-y-6">
        {selectedProject ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            <div className="flex items-center justify-between bg-white p-4 border border-gray-200 rounded shadow-sm">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSelectedProjectName(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-corporate-dark leading-tight">Detalle de Proyecto P&D</h2>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{selectedProject['Nombre del Proyecto']}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <div className="bg-blue-50 px-3 py-1 rounded border border-blue-100 text-[10px] font-bold text-blue-700 uppercase">
                  CARTERA: {selectedProject['Cartera'] || '-'}
                </div>
                <div className="bg-green-50 px-3 py-1 rounded border border-green-100 text-[10px] font-bold text-green-700 uppercase">
                  ESTADO TI: {selectedProject['Estado TI'] || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <InfoBox label="Líder Proyecto" value={selectedProject['Líder del Proyecto']} />
              <InfoBox label="Gerencia Líder" value={selectedProject['Gerencia Líder']} />
              <InfoBox label="Fecha Inicio" value={excelDateToJSDate(selectedProject['Fecha Inicio'])} />
              <InfoBox label="Fecha Fin" value={excelDateToJSDate(selectedProject['Fecha Fin'])} />
              <InfoBox label="Estado TI" value={selectedProject['Estado TI']} />
              <InfoBox label="Presupuesto" value={formatCurrency(selectedProject['Presupuesto asignado'])} />
              <InfoBox label="Cartera" value={selectedProject['Cartera']} />
              <InfoBox
                label="Salud del Proyecto"
                value={
                  <div className="flex items-center justify-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", getHealthColor(selectedProject))} />
                    <span className="font-bold uppercase text-[10px]">{getHealthColor(selectedProject).includes('bg-green') ? 'Saludable' : getHealthColor(selectedProject).includes('bg-yellow') ? 'En Riesgo' : 'Crítico'}</span>
                  </div>
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Avance del Proyecto (Plan vs Real)</h3>
                  <div className="flex gap-10 text-[10px] font-bold text-gray-400 uppercase">
                    <span>{excelDateToJSDate(selectedProject['Fecha Inicio'])}</span>
                    <span>{excelDateToJSDate(selectedProject['Fecha Fin'])}</span>
                  </div>
                </div>
                <div className="space-y-8 py-4">
                  <TimelineProgressBar
                    label="% PLANIFICADO"
                    percent={selectedProject['% Avance Planificado']}
                    color="bg-green-500"
                    showDates={true}
                  />
                  <TimelineProgressBar
                    label="% EJECUTADO"
                    percent={selectedProject['% Avance ejecutado']}
                    color="bg-orange-500"
                    showDates={true}
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Seguimiento (Planeamiento y Control de Gestión)</h3>
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                </div>
                <div className="p-6 text-sm text-gray-700 leading-relaxed overflow-y-auto max-h-[300px] custom-scrollbar">
                  {formatSeguimiento(
                    selectedProject['Seguimiento Planeamiento'] ||
                    selectedProject['SEGUIMIENTO (Planeamiento y Control de Gestión)'] ||
                    selectedProject['SEGUIMIENTO']
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {portfolioFilter && (
              <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 md:col-span-full mb-4">
                <Filter className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                  <span className="text-blue-400 mr-1 uppercase">{portfolioFilter.key}:</span>
                  <span className="uppercase">{portfolioFilter.value}</span>
                  <button onClick={() => setPortfolioFilter(null)} className="ml-1 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <button
                  onClick={() => setPortfolioFilter(null)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline ml-2"
                >
                  Limpiar filtro
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICard label="Total Proyectos" value={stats.total} />
              <KPICard label="En Curso" value={stats.enEjecucion} colorClass="text-blue-600" />
              <KPICard label="Implementado" value={stats.implementado} colorClass="text-green-600" />
              <KPICard label="No Iniciado" value={stats.noIniciado} colorClass="text-gray-500" />
              <KPICard label="Presupuesto" value={formatCurrency(stats.budget)} colorClass="text-corporate-dark" />
              <KPICard label="Avance Promedio" value={formatPercent(stats.avgExec)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 border border-gray-200 rounded shadow-sm relative">
                <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
                  TOTAL: {managementData.length}
                </div>
                <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Proyectos por Gerencia Líder</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={managementData.sort((a, b) => b.value - a.value).slice(0, 8)}
                      onClick={(data) => {
                        if (data && data.activeLabel) {
                          if (portfolioFilter?.value === data.activeLabel) {
                            setPortfolioFilter(null);
                          } else {
                            setPortfolioFilter({ key: 'Gerencia Líder', value: data.activeLabel });
                          }
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="value" fill="#a5000d" radius={[0, 4, 4, 0]} className="cursor-pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 border border-gray-200 rounded shadow-sm relative">
                <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
                  TOTAL: {filteredPortfolio.length}
                </div>
                <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Estado de TI</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                        nameKey="name"
                        label
                        onClick={(data) => {
                          if (portfolioFilter?.value === data.name) {
                            setPortfolioFilter(null);
                          } else {
                            setPortfolioFilter({ key: 'Estado TI', value: data.name });
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wider">Portafolio P&D - Vista Planeamiento</h3>
                <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold">{filteredPortfolio.length} proyectos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200">
                      <th className="px-6 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span>Proyecto</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => handleFilterClick('Priorizado', e, true)}
                              className={cn(
                                "p-1 hover:bg-gray-200 rounded transition-colors",
                                portfolioColumnFilters['Priorizado'] ? "text-blue-600" : "text-gray-400"
                              )}
                              title="Filtrar por Priorizado"
                            >
                              <Star className={cn("w-3 h-3", portfolioColumnFilters['Priorizado'] ? "fill-blue-600" : "")} />
                            </button>
                            <button
                              onClick={(e) => handleFilterClick('Nombre del Proyecto', e, true)}
                              className={cn(
                                "p-1 hover:bg-gray-200 rounded transition-colors",
                                portfolioColumnFilters['Nombre del Proyecto'] ? "text-blue-600" : "text-gray-400"
                              )}
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </th>
                      <th className="px-6 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span>Gerencia</span>
                          <button
                            onClick={(e) => handleFilterClick('Gerencia Líder', e, true)}
                            className={cn(
                              "p-1 hover:bg-gray-200 rounded transition-colors",
                              portfolioColumnFilters['Gerencia Líder'] ? "text-blue-600" : "text-gray-400"
                            )}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-6 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span>Estado TI</span>
                          <button
                            onClick={(e) => handleFilterClick('Estado TI', e, true)}
                            className={cn(
                              "p-1 hover:bg-gray-200 rounded transition-colors",
                              portfolioColumnFilters['Estado TI'] ? "text-blue-600" : "text-gray-400"
                            )}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-6 py-3">Avance Real</th>
                      <th className="px-6 py-3 text-center">Salud</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const prioritizedProjectNames = new Set(
                        (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
                      );

                      return filteredPortfolio.map((p, i) => {
                        const isPrioritized = prioritizedProjectNames.has(String(p['Nombre del Proyecto'] || '').toLowerCase().trim());

                        return (
                          <tr key={i} className={cn(
                            "hover:bg-gray-50 cursor-pointer transition-colors",
                            isPrioritized ? "bg-amber-50/50" : ""
                          )} onClick={() => setSelectedProjectName(p['Nombre del Proyecto'])}>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                {isPrioritized && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
                                <span className={cn(
                                  "font-semibold",
                                  isPrioritized ? "text-amber-900" : "text-gray-800"
                                )}>{p['Nombre del Proyecto']}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 text-gray-500">{p['Gerencia Líder']}</td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase">{p['Estado TI'] || p['Estado de TI'] || 'Sin Estado'}</span>
                            </td>
                            <td className="px-6 py-3 font-bold text-corporate-dark">{formatPercent(p['% Avance ejecutado'])}</td>
                            <td className="px-6 py-3">
                              <div className={cn("w-3 h-3 rounded-full mx-auto shadow-sm", getHealthColor(p))} />
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderTrendDashboard = () => {
    return (
      <div className="space-y-6">
        {/* Filters indicator */}
        {(selectedProjectName || trendFilter) && (
          <div className="flex flex-wrap gap-2 items-center bg-corporate-dark/5 p-3 rounded-lg border border-corporate-dark/10">
            <span className="text-[10px] font-bold text-corporate-dark uppercase tracking-widest mr-2">Filtros Activos:</span>
            {selectedProjectName && (
              <div className="flex items-center gap-2 bg-corporate-dark text-white px-3 py-1 rounded-full text-xs font-bold">
                <span>Proyecto: {selectedProjectName}</span>
                <button onClick={() => setSelectedProjectName(null)} className="hover:text-red-300"><X className="w-3 h-3" /></button>
              </div>
            )}
            {trendFilter && (
              <div className="flex items-center gap-2 bg-corporate-dark text-white px-3 py-1 rounded-full text-xs font-bold">
                <span>Mes: {trendFilter.month}</span>
                <button onClick={() => setTrendFilter(null)} className="hover:text-red-300"><X className="w-3 h-3" /></button>
              </div>
            )}
            <button
              onClick={() => { setSelectedProjectName(null); setTrendFilter(null); }}
              className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase underline ml-auto"
            >
              Limpiar Todo
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard label="Total Proyectos Priorizados" value={trendStats.total} icon={<Star className="w-4 h-4" />} />
          {selectedProjectName ? (() => {
            const matchedProj = data.portfolio?.find(p => p['Nombre del Proyecto'] === selectedProjectName) || data.demand?.find(d => (d['Nombre del Proyecto'] || d['PROYECTO']) === selectedProjectName);
            const tProj = data.trend?.find(t => t['Proyecto'] === selectedProjectName);
            return (
              <>
                <KPICard label="Fecha Inicio" value={matchedProj ? excelDateToJSDate(matchedProj['Fecha Inicio']) : (tProj?.['Año Inicio Planificado'] || '-')} colorClass="text-blue-600" />
                <KPICard label="Fecha Fin" value={matchedProj ? excelDateToJSDate(matchedProj['Fecha Fin']) : (tProj?.['Año Fin Planificado'] || '-')} colorClass="text-green-600" />
                <KPICard label="Líder del Proyecto" value={tProj?.['Líder del Proyecto'] || matchedProj?.['Líder del Proyecto'] || '-'} colorClass="text-gray-600" />
              </>
            );
          })() : Object.entries(trendStats.counts).slice(0, 3).map(([status, count], i) => (
            <KPICard key={i} label={status} value={count} colorClass="text-corporate-dark" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 border border-gray-200 rounded shadow-sm">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest flex items-center">
              Avance Mensual Planificado vs Ejecutado (Barras Agrupadas)
            </h3>
            <div className="h-[400px]">
              {projectTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectTrend} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      fontSize={10}
                      stroke="#999"
                      tick={{ fill: '#666' }}
                      angle={-90}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis fontSize={10} stroke="#999" unit="%" domain={[0, 100]} tick={{ fill: '#666' }} />
                    <Tooltip
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value) => [`${value}%`]}
                    />
                    <Legend verticalAlign="top" height={36} align="right" iconType="circle" />
                    <Bar
                      name="Avance Planificado"
                      dataKey="plan"
                      fill="#1e3a5f"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      name="Avance Ejecutado"
                      dataKey="exec"
                      fill="#a5000d"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 italic">
                  No hay datos de tendencia para la selección actual.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest flex items-center">
              Proyectos por Estado de TI
            </h3>
            <div className="h-[400px]">
              {Object.keys(trendStats.counts).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(trendStats.counts).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.keys(trendStats.counts).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 italic">
                  No hay datos para mostrar.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wider">Estado de Proyectos Priorizados</h3>
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200 sticky top-0 z-10">
                    <th className="px-6 py-3">Proyecto</th>
                    <th className="px-6 py-3">Dimensión</th>
                    <th className="px-6 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.trend || [])
                    .filter(t => {
                      const matchMgmt = sidebarFilters.management === 'Todas' || t['Gerencia Líder'] === sidebarFilters.management;
                      const matchDimension = sidebarFilters.dimension === 'Todas' || t['Dimensión'] === sidebarFilters.dimension;
                      const matchPortfolio = topPortfolio === 'Todas' || t['Cartera'] === topPortfolio;
                      if (!matchMgmt || !matchDimension || !matchPortfolio) return false;
                      if (selectedProjectName && t['Proyecto'] !== selectedProjectName) return false;
                      if (trendFilter && !Object.keys(t).some(k => k.includes(trendFilter.month))) return false;
                      return true;
                    })
                    .map((t, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "hover:bg-gray-50 transition-colors cursor-pointer",
                          selectedProjectName === t['Proyecto'] ? "bg-blue-50" : ""
                        )}
                        onClick={() => {
                          if (selectedProjectName === t['Proyecto']) {
                            setSelectedProjectName(null);
                          } else {
                            setSelectedProjectName(t['Proyecto']);
                          }
                        }}
                      >
                        <td className="px-6 py-3 font-semibold text-gray-800">{t['Proyecto']}</td>
                        <td className="px-6 py-3 text-gray-500">{t['Dimensión'] || '-'}</td>
                        <td className="px-6 py-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                            (t['Estado'] || '').toLowerCase().includes('curso') ? "bg-blue-50 text-blue-700 border-blue-100" :
                              (t['Estado'] || '').toLowerCase().includes('espera') ? "bg-amber-50 text-amber-700 border-amber-100" :
                                (t['Estado'] || '').toLowerCase().includes('final') ? "bg-green-50 text-green-700 border-green-100" :
                                  "bg-gray-50 text-gray-600 border-gray-100"
                          )}>
                            {t['Estado'] || 'Priorizado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Resumen de Avances Mensuales</h3>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setTrendViewMode('meses')}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                    trendViewMode === 'meses' ? "bg-white text-corporate-dark shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  MESES
                </button>
                <button
                  onClick={() => setTrendViewMode('años')}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                    trendViewMode === 'años' ? "bg-white text-corporate-dark shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  AÑOS
                </button>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendViewMode === 'meses' ? projectTrend : trendByYear}>
                  <defs>
                    <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a5000d" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#a5000d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey={trendViewMode === 'meses' ? "month" : "name"}
                    fontSize={10}
                    stroke="#999"
                    tick={{ fill: '#666' }}
                    angle={trendViewMode === 'meses' ? -45 : 0}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis fontSize={10} stroke="#999" unit="%" domain={[0, 100]} tick={{ fill: '#666' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`${value}%`]}
                  />
                  <Area type="monotone" name="Planificado" dataKey="plan" stroke="#1e3a5f" fillOpacity={1} fill="url(#colorPlan)" strokeWidth={2} />
                  <Area type="monotone" name="Ejecutado" dataKey="exec" stroke="#a5000d" fillOpacity={1} fill="url(#colorExec)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {(trendViewMode === 'meses' ? projectTrend : trendByYear).slice().reverse().map((tp, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100 text-[10px]">
                  <span className="font-bold text-gray-700">{tp.month || tp.name}</span>
                  <div className="flex gap-4">
                    <span className="text-gray-500">Plan: <span className="font-bold">{tp.plan}%</span></span>
                    <span className="text-corporate-dark">Real: <span className="font-bold">{tp.exec}%</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWeeklyDashboard = () => {
    if (!filteredWeekly || filteredWeekly.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center p-20 bg-white rounded-xl shadow-sm border border-gray-100 mt-20">
           <FolderOpen className="w-16 h-16 text-gray-200 mb-4" />
           <p className="text-gray-400 text-lg font-medium">No hay datos en Seguimiento Semanal con los filtros actuales.</p>
         </div>
      );
    }
  
    const totalPendientes = filteredWeekly.filter(w => (w['Estado'] || '').toLowerCase().includes('pendiente') || (w['Estado'] || '').toLowerCase().includes('proceso')).length;
    const totalProyectos = new Set(filteredWeekly.map(w => w['PROYECTO']).filter(Boolean)).size;
    const totalResponsables = new Set(filteredWeekly.map(w => w['Responsable'] || w['LÍDER TÉCNICO']).filter(Boolean)).size;
    const cerrados = filteredWeekly.filter(w => (w['Estado'] || '').toLowerCase().includes('cerrado')).length;

    const proyectosData = Array.from(new Set(filteredWeekly.map(w => w['PROYECTO']).filter(Boolean)))
      .map(name => ({
        name: String(name).substring(0, 25) + (String(name).length > 25 ? '...' : ''),
        value: filteredWeekly.filter(w => w['PROYECTO'] === name).length
      })).sort((a,b) => b.value - a.value).slice(0, 10);
    
    const estadosRawData = filteredWeekly.map(w => {
      const raw = (w['Estado'] || '').toLowerCase();
      if (raw.includes('proceso') || raw.includes('curso')) return 'En Proceso';
      if (raw.includes('finalizado') || raw.includes('cerrado') || raw.includes('implementado') || raw.includes('terminado')) return 'Finalizado';
      if (raw.includes('observado') || raw.includes('subsanar') || raw.includes('observación')) return 'Observado';
      if (raw.includes('pendiente') || raw.includes('atrasado') || raw.includes('iniciar')) return 'Pendiente';
      return 'Otros';
    });
    
    const estadosMap = estadosRawData.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});
    const estadoData = Object.entries(estadosMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    const COLORS_MAP = {
      'En Proceso': '#2563eb', // Blue
      'Finalizado': '#16a34a', // Green
      'Observado': '#e11d48',  // Red
      'Pendiente': '#f59e0b',  // Amber
      'Otros': '#9ca3af'       // Gray
    };

    return (
      <div className="space-y-6 animate-in fade-in ease-out duration-500">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500">
            Seguimiento Semanal Integrado
          </h2>
          <div className="text-sm text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm font-medium border border-gray-100 flex items-center space-x-2">
             <Layers className="w-4 h-4 text-[#a5000d]" />
             <span>Visualización de Pendientes</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ListChecks className="w-16 h-16" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Tareas/Items</p>
            <p className="text-4xl font-black text-gray-800">{filteredWeekly.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-blue-500">
              <FolderOpen className="w-16 h-16" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Proyectos Afectados</p>
            <p className="text-4xl font-black text-blue-600">{totalProyectos}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-orange-500">
              <AlertCircle className="w-16 h-16" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pendientes Totales</p>
            <p className="text-4xl font-black text-orange-500">{totalPendientes}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-green-500">
              <Users className="w-16 h-16" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Involucrados / Técnicos</p>
            <p className="text-4xl font-black text-green-600">{totalResponsables}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest flex items-center gap-2">
                 <BarChart2 className="w-4 h-4 text-corporate-dark" />
                 Top 10 Proyectos por Tareas Asignadas
              </h3>
              <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={proyectosData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                     <XAxis type="number" stroke="#9CA3AF" fontSize={11} fontWeight={600} />
                     <YAxis dataKey="name" type="category" width={140} stroke="#4B5563" fontSize={10} fontWeight={600} />
                     <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                       cursor={{ fill: '#F3F4F6' }}
                     />
                     <Bar dataKey="value" fill="#a5000d" radius={[0, 4, 4, 0]} barSize={20} />
                   </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative">
             <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest flex items-center gap-2">
                 <PieChartIcon className="w-4 h-4 text-blue-600" />
                 Distribución de Estados
             </h3>
             <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={estadoData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {estadoData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS_MAP[entry.name] || '#9ca3af'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                        itemStyle={{ color: '#1f2937' }}
                      />
                      <Legend 
                         wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} 
                         layout="vertical" verticalAlign="middle" align="right" 
                      />
                    </PieChart>
                 </ResponsiveContainer>
             </div>
           </div>
        </div>

        {/* Detail Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
             <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
               <TableIcon className="w-4 h-4 text-corporate-dark" />
               Listado General de Seguimiento
             </h3>
             <div className="text-xs font-semibold text-gray-400 bg-white px-3 py-1 rounded-md border border-gray-200">
               {filteredWeekly.length} registros
             </div>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-xs mb-0">
                <thead className="bg-gray-50/80 text-gray-500 uppercase font-black tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Proyecto</th>
                    <th className="px-6 py-4">Cód. Plant</th>
                    <th className="px-6 py-4">Pendiente</th>
                    <th className="px-6 py-4">Responsable / Líder</th>
                    <th className="px-6 py-4">F. Compromiso</th>
                    <th className="px-6 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredWeekly.map((w, i) => {
                    const excelDate = w['FECHA COMPROMISO'] || w['Fecha Compromiso2'];
                    let dateStr = 'N/A';
                    if (excelDate && typeof excelDate === 'number') {
                       dateStr = new Date((excelDate - 25569) * 86400 * 1000).toLocaleDateString('es-CL');
                    }
                    const estado = (w['Estado'] || 'Sin estado');
                    const isClosed = estado.toLowerCase().includes('cerrado');
                    return (
                      <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-bold text-corporate-dark line-clamp-2 max-w-[200px]">{w['PROYECTO']}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-400 text-[10px]">{w['CÓDIGO DE PLANEAMIENTO'] || '-'}</td>
                        <td className="px-6 py-4">
                           <div className="text-gray-600 line-clamp-2 max-w-[300px]" title={w['Pendientes']}>{w['Pendientes'] || '-'}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">{w['Responsable'] || w['LÍDER TÉCNICO'] || w['LIDER DEL PROYECTO'] || 'Sin asignar'}</td>
                        <td className="px-6 py-4 text-gray-500 font-semibold">{dateStr}</td>
                        <td className="px-6 py-4">
                           <span className={cn(
                             "px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap",
                             isClosed ? "bg-green-50 text-green-700 border-green-200" 
                                      : estado.toLowerCase().includes('pendiente') ? "bg-orange-50 text-orange-700 border-orange-200" :
                                        "bg-blue-50 text-blue-700 border-blue-200"
                           )}>
                             {estado}
                           </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
           </div>
        </div>

      </div>
    );
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f4f7f9] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-2xl border border-gray-100 text-center">
          <div className="bg-corporate-dark/5 p-4 rounded-full inline-block mb-4">
            <Briefcase className="w-12 h-12 text-corporate-dark" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Monitor de Portafolio</h1>
          <p className="text-gray-500 text-sm mb-6">Cargue el reporte Excel para iniciar la visualización estratégica.</p>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-corporate-dark file:text-white hover:file:bg-corporate-light cursor-pointer"
          />
          {loading && <p className="mt-4 text-corporate-dark animate-pulse">Cargando...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f9] flex flex-col font-sans text-gray-800 overflow-hidden h-screen relative">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-100 flex flex-col items-center">
            <Activity className="w-12 h-12 text-corporate-dark animate-spin mb-4" />
            <p className="text-corporate-dark font-bold animate-pulse">Procesando información...</p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-[#a5000d] text-white p-4 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center space-x-4">
          <div className="bg-white/10 p-2 rounded">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div className="font-bold text-xl tracking-wide uppercase">Monitoreo y Control del Portafolio de Proyectos</div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-xs font-medium flex flex-col items-end">
            <span className="opacity-70 uppercase tracking-widest">Fecha de Corte: {new Date().toLocaleDateString('es-CL')}</span>
            <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold mt-1">V1.2.0</div>
          </div>
          <div className="flex gap-2">
            <label className="bg-white text-[#a5000d] hover:bg-gray-100 px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
              <Upload className="w-4 h-4" />
              <span>SUBIR ORIGINAL</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
            <label className="bg-[#a5000d] border border-white hover:bg-white hover:text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
              <Upload className="w-4 h-4" />
              <span>SUBIR DEMANDA TI</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleDemand2Upload} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center space-x-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedProjectName(null);
                setTopPortfolio('Todas');
                setSidebarFilters({ management: 'Todas', dimension: 'Todas', status: 'Todos' });
                setShowStrategicDetail(false);
              }}
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center space-x-2",
                activeTab === tab.id
                  ? "text-corporate-dark border-b-2 border-corporate-dark bg-gray-50"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-corporate-dark" : "text-gray-400")} />
              <span>{tab.label}</span>
            </button>
          ))}
          {demand2Data && (
            <button
              onClick={() => {
                setActiveTab('demand2');
                setSelectedProjectName(null);
                setTopPortfolio('Todas');
                setSidebarFilters({ management: 'Todas', dimension: 'Todas', status: 'Todos' });
                setShowStrategicDetail(false);
              }}
              className={cn(
                "px-6 py-4 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center space-x-2",
                activeTab === 'demand2'
                  ? "text-corporate-dark border-b-2 border-corporate-dark bg-gray-50"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              )}
            >
              <TrendingUp className={cn("w-4 h-4", activeTab === 'demand2' ? "text-corporate-dark" : "text-gray-400")} />
              <span>Demanda Estratégica (2)</span>
            </button>
          )}
        </div>

        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-corporate-dark flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all cursor-pointer">
          <Upload className="w-3 h-3" />
          <span>Cargar nuevo archivo</span>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </nav>

      {/* Filter Bar (Horizontal) */}
      {!showStrategicDetail && (
        <div className="bg-white border-b border-gray-100 p-4 flex flex-wrap gap-4 items-center shrink-0 px-10">
          {(activeTab === 'trend' || activeTab === 'weekly') ? (
            <>
              <div className="flex items-center space-x-3">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Gerencia Líder:</span>
                <select
                  value={sidebarFilters.management}
                  onChange={(e) => setSidebarFilters(f => ({ ...f, management: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
                >
                  <option value="Todas">-- TODAS LAS GERENCIAS --</option>
                  {getFilterOptions('Gerencia Líder').map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              <div className="flex items-center space-x-3">
                <LayoutDashboard className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Dimensión:</span>
                <select
                  value={sidebarFilters.dimension}
                  onChange={(e) => setSidebarFilters(f => ({ ...f, dimension: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
                >
                  <option value="Todas">-- TODAS LAS DIMENSIONES --</option>
                  {getFilterOptions('Dimensión').map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-3">
                <LayoutDashboard className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Cartera:</span>
                <select
                  value={topPortfolio}
                  onChange={(e) => setTopPortfolio(e.target.value)}
                  className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
                >
                  <option value="Todas">-- TODAS LAS CARTERAS --</option>
                  {getFilterOptions('Cartera').map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              <div className="flex items-center space-x-3">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Estado:</span>
                <select
                  value={sidebarFilters.status}
                  onChange={(e) => setSidebarFilters(f => ({ ...f, status: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
                >
                  <option value="Todos">-- TODOS LOS ESTADOS --</option>
                  {getFilterOptions(activeTab === 'portfolio' ? 'Estado TI' : 'Estado Proyecto TI').map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Dashboard Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-[#f4f7f9] custom-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          {activeTab === 'demand' && renderDemandDashboard()}
          {activeTab === 'portfolio' && renderPortfolioDashboard()}
          {activeTab === 'trend' && renderTrendDashboard()}
          {activeTab === 'weekly' && renderWeeklyDashboard()}
          {activeTab === 'demand2' && renderDemand2Dashboard()}
        </div>
      </main>
    </div>
  );
}
