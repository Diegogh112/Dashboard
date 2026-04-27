import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, FunnelChart, Funnel, Trapezoid
} from 'recharts';
import {
  Upload, FileText, PieChart as PieChartIcon, BarChart2,
  TrendingUp, Calendar, Filter, Download, AlertCircle,
  CheckCircle2, Clock, PlayCircle, StopCircle, ChevronRight,
  Menu, X, Search, LayoutDashboard, Briefcase, Users, Activity, ArrowLeft
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility Functions ---

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const formatPercent = (val) => {
  if (val === undefined || val === null || val === '') return '-';
  if (typeof val === 'string' && val.toLowerCase().includes('no aplica')) return '-';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '-';
  return `${(num * 100).toFixed(0)}%`;
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

// --- Components ---

const InfoBox = ({ label, value, className }) => (
  <div className={cn("bg-white border border-gray-200 rounded overflow-hidden flex flex-col", className)}>
    <div className="bg-corporate-dark text-white text-[10px] uppercase px-2 py-1 font-bold tracking-wider">
      {label}
    </div>
    <div className="px-2 py-2 text-sm font-medium text-gray-800 text-center truncate">
      {value || '-'}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('demand'); // Default to Demand as it's most important
  const [selectedProjectName, setSelectedProjectName] = useState(null);

  // Sidebar Filters
  const [sidebarFilters, setSidebarFilters] = useState({
    management: 'Todas',
    status: 'Todos',
  });

  const [topPortfolio, setTopPortfolio] = useState('Todas');
  const [demandChartType, setDemandChartType] = useState('projects'); // 'projects' or 'childProjects'
  const [demandFilter, setDemandFilter] = useState(null); // { key: 'Estado TI', value: '...' }
  const [selectedOpp, setSelectedOpp] = useState(null); // For expanded OPP view
  const [showStrategicDetail, setShowStrategicDetail] = useState(false);

  const TABS = [
    { id: 'demand', label: 'Demanda Estratégica TI', icon: Activity },
    { id: 'portfolio', label: 'Portafolio P&D', icon: Briefcase },
    { id: 'trend', label: 'Pys Transf Digital', icon: TrendingUp },
    { id: 'weekly', label: 'Seguimiento Semanal', icon: Clock },
  ];

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
              'Estado': ['Estado', 'Estado Proyecto', 'ESTADO', 'Situación'],
              'Cartera': ['Cartera', 'CARTERA', 'Portafolio'],
              'Presupuesto asignado': ['Presupuesto asignado', 'Presupuesto', 'PRESUPUESTO', 'Costo'],
              'Nombre del Proyecto': ['Nombre del Proyecto', 'PROYECTO', 'Nombre', 'Project Name'],
              'Estado TI': ['Estado TI', 'ESTADO TI'],
              'Estado Proyecto TI': ['Estado Proyecto TI', 'ESTADO PROYECTO TI'],
              'OPP': ['Seguimiento OPP', 'OPP', 'SEGUIMIENTO OPP', 'Comentarios OPP'],
              'Tipo': ['Tipo de Requerimiento', 'Tipo', 'TIPO'],
              'Categoría': ['Categoría', 'Categoria', 'CATEGORIA', 'Salud', 'SALUD']
            };

            Object.entries(keyMaps).forEach(([standardKey, variations]) => {
              if (!normalized[standardKey]) {
                const foundKey = Object.keys(item).find(k => 
                  variations.some(v => k.toLowerCase() === v.toLowerCase())
                );
                if (foundKey) normalized[standardKey] = item[foundKey];
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

          const headerSub = rows[headerIdx];     // Contains "2023", "Plani", "Ejec"
          const headerTop = rows[headerIdx - 1]; // Contains Year/Month: e.g. "%ENE 2024"

          const dataRows = rows.slice(headerIdx + 1);
          
          return dataRows.filter(r => r[2]).map(r => {
            const obj = { 'Proyecto': r[2], 'Estado': r[3] };
            let currentHeader = '';
            
            headerSub.forEach((subVal, i) => {
              const topVal = headerTop ? headerTop[i] : null;
              if (topVal) currentHeader = String(topVal).trim();
              
              const sub = subVal ? String(subVal).trim() : '';
              const value = r[i];

              if (sub === '2023') {
                obj['2023 Plan'] = value;
                obj['2023 Exec'] = value;
              } else if (currentHeader && (currentHeader.includes('%') || currentHeader.match(/\d{4}/))) {
                if (sub.toLowerCase().includes('plani') || sub.toLowerCase().includes('plan')) {
                  obj[`${currentHeader} Plan`] = value;
                } else if (sub.toLowerCase().includes('ejec')) {
                  obj[`${currentHeader} Exec`] = value;
                }
              }
            });
            return obj;
          });
        };

        const sheets = {
          portfolio: normalizeData(processSheet(wb.Sheets['Portafolio P&D'] || wb.Sheets[wb.SheetNames[0]])),
          demand: normalizeData(processSheet(wb.Sheets['Demanda Estrategica CT'] || wb.Sheets[wb.SheetNames[1]])),
          weekly: normalizeData(processSheet(wb.Sheets['Seguimiento Semanal'] || wb.Sheets[wb.SheetNames[2]])),
          trend: processTrendSheet(wb.Sheets['Pys Transf Digital'] || wb.Sheets['PYS TRANSF DIGITAL'] || wb.Sheets[wb.SheetNames[3]])
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

  // Filtered Data based on sidebar
  const filteredPortfolio = useMemo(() => {
    if (!data?.portfolio) return [];
    return data.portfolio.filter(item => {
      const matchMgmt = sidebarFilters.management === 'Todas' || item['Gerencia Líder'] === sidebarFilters.management;
      const matchStatus = sidebarFilters.status === 'Todos' || item['Estado'] === sidebarFilters.status;
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;
      return matchMgmt && matchStatus && matchPortfolio;
    });
  }, [data, sidebarFilters, topPortfolio]);

  const filteredDemand = useMemo(() => {
    if (!data?.demand) return [];
    return data.demand.filter(item => {
      const matchMgmt = sidebarFilters.management === 'Todas' || item['Gerencia Líder'] === sidebarFilters.management;
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;
      
      let matchChart = true;
      if (demandFilter) {
        matchChart = String(item[demandFilter.key] || '').includes(demandFilter.value);
      }
      
      return matchMgmt && matchPortfolio && matchChart;
    });
  }, [data, sidebarFilters.management, topPortfolio, demandFilter]);

  const stats = useMemo(() => {
    const total = filteredPortfolio.length;
    const inProgress = filteredPortfolio.filter(p => {
      const s = String(p['Estado'] || '').toLowerCase();
      return s.includes('curso') || s.includes('ejecución');
    }).length;
    const implemented = filteredPortfolio.filter(p => String(p['Estado'] || '').toLowerCase().includes('implementado')).length;
    const notStarted = filteredPortfolio.filter(p => String(p['Estado'] || '').toLowerCase().includes('no iniciado')).length;
    const closed = filteredPortfolio.filter(p => String(p['Estado'] || '').toLowerCase().includes('cerrado')).length;
    const budget = filteredPortfolio.reduce((acc, p) => acc + (Number(p['Presupuesto asignado']) || 0), 0);
    
    // Demand stats
    const totalDemand = filteredDemand.length;
    
    // Debug helper (Check console to see what the actual strings are)
    if (filteredDemand.length > 0) {
      const sampleStates = [...new Set(filteredDemand.map(d => String(d['Estado TI'] || '')))];
      console.log('Estados TI encontrados en Excel:', sampleStates);
    }

    // Map states strictly based on user provided list (Using "Estado Proyecto TI" for these KPIs)
    const demandNoIniciado = filteredDemand.filter(d => {
      const s = String(d['Estado Proyecto TI'] || '').trim();
      return s.startsWith('01') || s.toLowerCase().includes('no iniciado');
    }).length;
    const demandEnEjecucion = filteredDemand.filter(d => {
      const s = String(d['Estado Proyecto TI'] || '').trim();
      return s.startsWith('02') || s.toLowerCase().includes('ejecución');
    }).length;
    const demandImplementado = filteredDemand.filter(d => {
      const s = String(d['Estado Proyecto TI'] || '').trim();
      return s.startsWith('03') || s.toLowerCase().includes('implementado');
    }).length;
    const demandFinalizado = filteredDemand.filter(d => {
      const s = String(d['Estado Proyecto TI'] || '').trim();
      return s.startsWith('04') || s.toLowerCase().includes('finalizado');
    }).length;
    const demandDescartado = filteredDemand.filter(d => {
      const s = String(d['Estado Proyecto TI'] || '').trim();
      return s.startsWith('05') || s.toLowerCase().includes('descartado');
    }).length;

    // Count unique projects (Only rows where Tipo is exactly "Proyecto")
    const uniqueProjects = new Set();
    filteredDemand.forEach(d => {
      const type = String(d['Tipo'] || '').trim();
      if (type === 'Proyecto') {
        uniqueProjects.add(d['Nombre del Proyecto'] || d['PROYECTO']);
      }
    });

    // Averages from Demand sheet as priority
    const avgPlan = filteredDemand.length > 0 
      ? filteredDemand.reduce((acc, d) => acc + (parseFloat(d['% Avance Planificado']) || 0), 0) / filteredDemand.length 
      : 0;
    const avgExec = filteredDemand.length > 0 
      ? filteredDemand.reduce((acc, d) => acc + (parseFloat(d['% Avance ejecutado']) || 0), 0) / filteredDemand.length 
      : 0;

    return { 
      total, inProgress, implemented, notStarted, closed, budget,
      totalDemand, demandNoIniciado, demandEnEjecucion, demandImplementado, demandFinalizado, demandDescartado,
      uniqueProjectCount: uniqueProjects.size,
      avgPlan, avgExec
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
      ? data?.trend?.filter(t => 
          filteredPortfolio.some(p => p['Nombre del Proyecto'] === t['Proyecto']) ||
          filteredDemand.some(d => d['Nombre del Proyecto'] === t['Proyecto'] || d['PROYECTO'] === t['Proyecto'])
        )
      : data?.trend?.filter(t => 
          String(t['Proyecto']).trim().toLowerCase() === String(selectedProjectName).trim().toLowerCase()
        );

    if (!projectsToInclude || projectsToInclude.length === 0) return [];

    const keys = Object.keys(projectsToInclude[0] || {});
    // Improved timepoint detection: Look for patterns like "ENE 2024 Plan" or "2023 Plan"
    const timepoints = [...new Set(keys.filter(k => k.includes(' Plan')).map(k => k.replace(' Plan', '').trim()))];

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
      const planValues = projectsToInclude.map(p => parseVal(p[`${tp} Plan`])).filter(v => v !== null);
      const execValues = projectsToInclude.map(p => parseVal(p[`${tp} Exec`])).filter(v => v !== null);
      
      return {
        month: tp.replace('%', '').trim(),
        plan: planValues.length > 0 ? planValues.reduce((a, b) => a + b, 0) / planValues.length : null,
        exec: execValues.length > 0 ? execValues.reduce((a, b) => a + b, 0) / execValues.length : null
      };
    }).filter(d => d.plan !== null || d.exec !== null);
  }, [selectedProjectName, filteredPortfolio, data?.trend, filteredDemand]);

  const filteredWeekly = useMemo(() => {
    if (!data?.weekly) return [];
    return data.weekly.filter(item => {
      const matchMgmt = sidebarFilters.management === 'Todas' || item['Gerencia Líder'] === sidebarFilters.management;
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;
      const matchProject = !selectedProjectName || item['PROYECTO'] === selectedProjectName || item['Nombre del Proyecto'] === selectedProjectName;
      return matchMgmt && matchPortfolio && matchProject;
    });
  }, [data, sidebarFilters.management, topPortfolio, selectedProjectName]);

  const associatedDemands = useMemo(() => {
    if (!selectedProjectName || !data?.demand) return [];
    return data.demand.filter(d => 
      String(d['Nombre del Proyecto'] || '') === String(selectedProjectName) || 
      String(d['PROYECTO'] || '') === String(selectedProjectName) ||
      String(d['ID'] || '') === String(selectedProjectName)
    );
  }, [data, selectedProjectName]);

  const renderDemandDashboard = () => {
    if (showStrategicDetail && selectedProjectName) {
      const project = data.demand.find(d => (d['Nombre del Proyecto'] || d['PROYECTO']) === selectedProjectName);
      const trendData = projectTrend;
      
      const projectDemands = data.demand.filter(d => (d['Nombre del Proyecto'] || d['PROYECTO']) === selectedProjectName);
      const totalReqs = projectDemands.length;
      const completedReqs = projectDemands.filter(d => (d['Estado TI'] || '').toLowerCase().includes('04') || (d['Estado TI'] || '').toLowerCase().includes('finalizado')).length;
      const progress = totalReqs > 0 ? (completedReqs / totalReqs) * 100 : 0;

      return (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between bg-white p-4 border border-gray-200 rounded shadow-sm">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowStrategicDetail(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-corporate-dark leading-tight">Detalle de Proyecto Estratégico</h2>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{selectedProjectName}</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="bg-blue-50 px-3 py-1 rounded border border-blue-100 text-[10px] font-bold text-blue-700 uppercase">
                ID: {project?.['ID'] || '-'}
              </div>
              <div className="bg-green-50 px-3 py-1 rounded border border-green-100 text-[10px] font-bold text-green-700 uppercase">
                ESTADO: {project?.['Estado TI'] || '-'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <InfoBox label="Líder del Proyecto" value={project?.['Líder del Proyecto'] || project?.['Responsable']} />
            <InfoBox label="Gerencia Líder" value={project?.['Gerencia Líder']} />
            <InfoBox label="Categoría" value={project?.['Categoría']} />
            <InfoBox label="Total Requerimientos" value={totalReqs} />
            <InfoBox label="Reqs. Finalizados" value={completedReqs} />
            <InfoBox label="% Cumplimiento" value={`${progress.toFixed(0)}%`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoBox label="Fecha Inicio- Plan" value={excelDateToJSDate(project?.['Fecha Inicio- Plan'] || project?.['Fecha Inicio'])} />
            <InfoBox label="Fecha Fin- Plan" value={excelDateToJSDate(project?.['Fecha Fin- Plan'] || project?.['Fecha Fin'])} />
            <InfoBox label="Fecha Fin Real (CQ)" value={excelDateToJSDate(project?.['Fecha Fin Ral (CQ)'] || project?.['Fecha Fin Real'])} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Avance del Proyecto (Plan vs Real)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={10} unit="%" domain={[0, 100]} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36}/>
                    <Area type="monotone" dataKey="plan" name="Planificado" stroke="#3b82f6" fillOpacity={0.1} fill="#3b82f6" strokeWidth={3} connectNulls />
                    <Area type="monotone" dataKey="exec" name="Ejecutado" stroke="#1e3a5f" fillOpacity={0.1} fill="#1e3a5f" strokeWidth={3} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {trendData.length === 0 && (
                <div className="text-center text-xs text-gray-400 mt-[-40px]">No hay datos de tendencia para este proyecto en la hoja de ejecución.</div>
              )}
            </div>

            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Distribución de Requerimientos por Estado</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={(() => {
                      const counts = {};
                      projectDemands.forEach(d => {
                        const s = d['Estado TI'] || 'Sin Estado';
                        counts[s] = (counts[s] || 0) + 1;
                      });
                      return Object.entries(counts).map(([name, value]) => ({ name, value }));
                    })()}
                    margin={{ bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={9} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: '#666' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
    <div className="space-y-6">
      {/* Filter indicator for cross-filtering */}
      {demandFilter && (
        <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <Filter className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-blue-800">
            Filtrando por {demandFilter.key}: <span className="uppercase">{demandFilter.value}</span>
          </span>
          <button 
            onClick={() => setDemandFilter(null)}
            className="text-blue-500 hover:text-blue-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
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
          <div className="h-64 relative" style={{ perspective: '1200px' }}>
            <div style={{ 
              transform: 'rotateX(45deg)', 
              transformStyle: 'preserve-3d', 
              height: '100%',
              filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.2))'
            }}>
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
                        outerRadius={90}
                        innerRadius={0}
                        paddingAngle={2}
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
                          paddingTop: '20px', 
                          transform: 'rotateX(-45deg)',
                          bottom: '-10px'
                        }} 
                      />
                    </PieChart>
              </ResponsiveContainer>
            </div>
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
                    .sort((a,b) => b.value - a.value);
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
                  cursor={{fill: '#f8fafc'}}
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
                      .sort((a,b) => b.value - a.value)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ));
                  })()}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Requerimientos por Gerencia - Horizontal Bar Chart */}
        <div className="bg-white p-4 border border-gray-200 rounded shadow-sm relative">
          <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
            TOTAL: {filteredDemand.length}
          </div>
          <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest">Requerimientos por Gerencia</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical"
                data={(() => {
                  const mgmtData = {};
                  filteredDemand.forEach(d => {
                    let mgmt = d['Gerencia Líder'] || 'Otras';
                    if (mgmt.includes('Tecnologias de Informacion')) mgmt = 'TI';
                    if (!mgmtData[mgmt]) mgmtData[mgmt] = { name: mgmt, total: 0 };
                    mgmtData[mgmt].total++;
                  });
                  return Object.values(mgmtData).sort((a,b) => b.total - a.total).slice(0, 8);
                })()}
                onClick={(data) => {
                  if (data && data.activePayload) {
                    const val = data.activePayload[0].payload.name;
                    if (demandFilter?.value === val) {
                      setDemandFilter(null);
                    } else {
                      setDemandFilter({ key: 'Gerencia Líder', value: val });
                    }
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" fontSize={9} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  fontSize={8} 
                  width={45}
                  tickFormatter={(value) => value.length > 7 ? `${value.substring(0, 5)}..` : value}
                />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border border-gray-200 shadow-sm rounded text-[10px]">
                          <p className="font-bold">{payload[0].payload.name}</p>
                          <p className="text-red-600">Requerimientos: {payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="total" fill="#ef4444" radius={[0, 4, 4, 0]} className="cursor-pointer" />
              </BarChart>
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
                  })).sort((a,b) => b.value - a.value).slice(0, 10);
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
                  cursor={{fill: '#f8fafc'}}
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
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Detalle de Demanda Estratégica</h3>
          <span className="text-[9px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold">{filteredDemand.length} requerimientos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200">
                <th className="px-6 py-3 w-24">ID</th>
                <th className="px-6 py-3">Nombre del Proyecto</th>
                <th className="px-6 py-3">Gerencia Líder</th>
                <th className="px-6 py-3">Estado TI</th>
                <th className="px-6 py-3">Categoría</th>
                <th className="px-6 py-3 text-center">Avance Planificado/Real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDemand.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors cursor-pointer" 
                  onClick={() => {
                    setSelectedProjectName(d['Nombre del Proyecto'] || d['PROYECTO']);
                    setShowStrategicDetail(true);
                  }}
                >
                  <td className="px-6 py-3 font-mono font-bold text-gray-400">{d['ID'] || '-'}</td>
                  <td className="px-6 py-3">
                    <div className="font-bold text-gray-800 leading-tight">{d['Nombre del Proyecto'] || d['PROYECTO']}</div>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{d['Gerencia Líder']}</td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold uppercase border",
                      (d['Estado TI'] || '').toLowerCase().includes('04') || (d['Estado TI'] || '').toLowerCase().includes('finalizado') ? "bg-green-50 text-green-700 border-green-100" :
                      (d['Estado TI'] || '').toLowerCase().includes('02') || (d['Estado TI'] || '').toLowerCase().includes('desarrollo') ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-600 border-gray-100"
                    )}>{d['Estado TI']}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 italic">{d['Categoría'] || '-'}</td>
                  <td className="px-6 py-3 text-center">
                    <div className="font-bold text-gray-700">{formatPercent(d['% Avance Planificado'])}</div>
                    <div className="text-blue-600 font-bold">{formatPercent(d['% Avance ejecutado'])}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

  const renderPortfolioDashboard = () => (
    <div className="space-y-6">
      {selectedProject ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center bg-white p-4 rounded border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-corporate-dark">{selectedProject['Nombre del Proyecto']}</h2>
            <button 
              onClick={() => setSelectedProjectName(null)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-bold transition-colors"
            >
              CERRAR DETALLE
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <InfoBox label="Líder Proyecto" value={selectedProject['Líder del Proyecto']} />
            <InfoBox label="Gerencia Líder" value={selectedProject['Gerencia Líder']} />
            <InfoBox label="Fecha Inicio" value={excelDateToJSDate(selectedProject['Fecha Inicio'])} />
            <InfoBox label="Fecha Fin" value={excelDateToJSDate(selectedProject['Fecha Fin'])} />
            <InfoBox label="Estado" value={selectedProject['Estado']} />
            <InfoBox label="Presupuesto" value={formatCurrency(selectedProject['Presupuesto asignado'])} />
            <InfoBox label="Avance Plan (Planeamiento)" value={formatPercent(selectedProject['% Avance Planificado'])} />
            <InfoBox label="Avance Real (Planeamiento)" value={formatPercent(selectedProject['% Avance ejecutado'])} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12 bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wider">Seguimiento (Planeamiento y Control de Gestión)</h3>
              </div>
              <div className="p-6 text-sm text-gray-700 leading-relaxed">
                {selectedProject['SEGUIMIENTO (Planeamiento y Control de Gestión)'] || 'Sin comentarios de seguimiento registrados.'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard label="Total Proyectos" value={stats.total} />
            <KPICard label="En Ejecución" value={stats.inProgress} colorClass="text-blue-600" />
            <KPICard label="Implementado" value={stats.implemented} colorClass="text-green-600" />
            <KPICard label="No Iniciado" value={stats.notStarted} colorClass="text-gray-500" />
            <KPICard label="Presupuesto" value={formatCurrency(stats.budget)} colorClass="text-corporate-dark" />
            <KPICard label="Avance Promedio" value={formatPercent(filteredPortfolio.reduce((acc, p) => acc + (parseFloat(p['% Avance ejecutado']) || 0), 0) / (filteredPortfolio.length || 1))} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Proyectos por Gerencia Líder</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={managementData.sort((a,b) => b.value - a.value).slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#a5000d" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
              <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Estado de Planeamiento</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} innerRadius={60} outerRadius={80} dataKey="value" nameKey="name" label>
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
                    <th className="px-6 py-3">Proyecto</th>
                    <th className="px-6 py-3">Gerencia</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3">Avance Real</th>
                    <th className="px-6 py-3 text-center">Salud</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPortfolio.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedProjectName(p['Nombre del Proyecto'])}>
                      <td className="px-6 py-3 font-semibold text-gray-800">{p['Nombre del Proyecto']}</td>
                      <td className="px-6 py-3 text-gray-500">{p['Gerencia Líder']}</td>
                      <td className="px-6 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase">{p['Estado']}</span>
                      </td>
                      <td className="px-6 py-3 font-bold text-corporate-dark">{formatPercent(p['% Avance ejecutado'])}</td>
                      <td className="px-6 py-3">
                        <div className={cn("w-3 h-3 rounded-full mx-auto shadow-sm", getHealthColor(p))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderTrendDashboard = () => (
    <div className="space-y-6">
      <div className="bg-white p-4 border border-gray-200 rounded shadow-sm flex items-center space-x-4">
        <div className="bg-corporate-dark p-2 rounded">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">PROYECTOS PRIORIZADOS (TENDENCIA)</label>
          <select 
            value={selectedProjectName || ''}
            onChange={(e) => setSelectedProjectName(e.target.value || null)}
            className="w-full border-none font-bold text-gray-800 text-lg outline-none cursor-pointer p-0 bg-transparent"
          >
            <option value="">PROMEDIO DE TODOS LOS PROYECTOS PRIORIZADOS</option>
            {[...new Set((data?.trend || []).map(t => t['Proyecto']))].filter(Boolean).sort().map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
        <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest flex items-center">
          Avance Mensual Planificado vs Ejecutado (Barras Apiladas)
        </h3>
        <div className="h-[400px]">
          {projectTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={10} stroke="#999" tick={{fill: '#666'}} />
                <YAxis fontSize={10} stroke="#999" unit="%" domain={[0, 100]} tick={{fill: '#666'}} />
                <Tooltip 
                  cursor={{fill: '#f3f4f6'}} 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="top" height={36} align="right" iconType="circle" />
                <Bar name="Avance Planificado" dataKey="plan" stackId="a" fill="#1e3a5f" radius={[0, 0, 0, 0]} />
                <Bar name="Avance Ejecutado" dataKey="exec" stackId="b" fill="#a5000d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 italic">
              No hay datos de tendencia para la selección actual.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wider">Estado de Proyectos Priorizados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200">
                  <th className="px-6 py-3">Proyecto</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Avance Real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.trend || []).filter(t => !selectedProjectName || t['Proyecto'] === selectedProjectName).map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-semibold text-gray-800">{t['Proyecto']}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase border border-blue-100">
                        {t['Estado'] || 'Priorizado'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-corporate-dark">
                      {(() => {
                        const keys = Object.keys(t || {}).filter(k => k.endsWith(' Exec'));
                        const lastKey = keys[keys.length - 1];
                        return lastKey ? formatPercent((t[lastKey] || 0) / 100) : '0%';
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-6 border border-gray-200 rounded shadow-sm">
          <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Resumen de Avances</h3>
          <div className="space-y-4">
            {projectTrend.slice(-5).reverse().map((tp, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100">
                <div>
                  <div className="text-xs font-bold text-gray-800">{tp.month}</div>
                  <div className="text-[10px] text-gray-500 uppercase">Periodo de Seguimiento</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-corporate-dark">{formatPercent(tp.exec / 100)}</div>
                  <div className="text-[10px] text-gray-400">Avance Real</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderWeeklyDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Proyectos Analizados" value={filteredWeekly.length} />
        <KPICard label="Promedio Avance" value={formatPercent(filteredWeekly.reduce((acc, w) => acc + (parseFloat(w['% Avance ejecutado']) || 0), 0) / (filteredWeekly.length || 1))} colorClass="text-corporate-dark" />
        <KPICard label="Última Actualización" value={new Date().toLocaleDateString('es-CL')} />
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase text-gray-600 tracking-wider">Seguimiento Semanal de Proyectos</h3>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] text-gray-500 font-bold uppercase">Actualizado Semanalmente</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200">
                <th className="px-6 py-3">Proyecto</th>
                <th className="px-6 py-3">Gerencia Líder</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Avance Real</th>
                <th className="px-6 py-3">Seguimiento y Comentarios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredWeekly.map((w, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-gray-800">{w['Nombre del Proyecto'] || w['PROYECTO']}</td>
                  <td className="px-6 py-3 text-gray-500">{w['Gerencia Líder']}</td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                      (w['Estado'] || '').toLowerCase().includes('implementado') ? "bg-green-50 text-green-700 border-green-100" :
                      (w['Estado'] || '').toLowerCase().includes('curso') ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-yellow-50 text-yellow-700 border-yellow-100"
                    )}>{w['Estado']}</span>
                  </td>
                  <td className="px-6 py-3 font-bold text-corporate-dark">{formatPercent(w['% Avance ejecutado'])}</td>
                  <td className="px-6 py-3 text-gray-600 leading-relaxed max-w-md">
                    {w['SEGUIMIENTO (Planeamiento y Control de Gestión)'] || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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
    <div className="min-h-screen bg-[#f4f7f9] flex flex-col font-sans text-gray-800 overflow-hidden h-screen">
      {/* Header */}
      <header className="bg-[#a5000d] text-white p-4 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center space-x-4">
          <div className="bg-white/10 p-2 rounded">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div className="font-bold text-xl tracking-wide uppercase">Monitoreo y Control del Portafolio de Proyectos</div>
        </div>
        <div className="text-xs font-medium flex items-center space-x-4">
          <span className="opacity-70 uppercase tracking-widest">Fecha de Corte: {new Date().toLocaleDateString('es-CL')}</span>
          <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold">V1.2.0</div>
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
        </div>

        <button onClick={() => setData(null)} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-red-600 flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-red-50 transition-all">
          <Upload className="w-3 h-3" />
          <span>Cargar nuevo archivo</span>
        </button>
      </nav>

      {/* Filter Bar (Horizontal) */}
      {!showStrategicDetail && (
        <div className="bg-white border-b border-gray-100 p-4 flex items-center space-x-8 shrink-0 px-10">
          <div className="flex items-center space-x-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Cartera:</span>
            <select 
              value={topPortfolio}
              onChange={(e) => {
                setTopPortfolio(e.target.value);
                setSelectedProjectName(null);
              }}
              className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
            >
              <option value="Todas">-- TODAS LAS CARTERAS --</option>
              {(() => {
                let options = [];
                if (activeTab === 'demand') options = (data?.demand || []).map(d => d['Cartera']);
                else if (activeTab === 'portfolio') options = (data?.portfolio || []).map(p => p['Cartera']);
                else if (activeTab === 'trend') options = (data?.trend || []).map(t => t['Cartera']);
                else if (activeTab === 'weekly') options = (data?.weekly || []).map(w => w['Cartera']);
                
                return [...new Set(options)].filter(Boolean).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ));
              })()}
            </select>
          </div>

          <div className="h-6 w-px bg-gray-200" />

          <div className="flex items-center space-x-3">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Gerencia:</span>
            <select 
              value={sidebarFilters.management}
              onChange={(e) => setSidebarFilters(f => ({...f, management: e.target.value}))}
              className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
            >
              <option value="Todas">-- TODAS LAS GERENCIAS --</option>
              {(() => {
                let options = [];
                if (activeTab === 'demand') options = (data?.demand || []).map(d => d['Gerencia Líder']);
                else if (activeTab === 'portfolio') options = (data?.portfolio || []).map(p => p['Gerencia Líder']);
                else if (activeTab === 'trend') options = (data?.trend || []).map(t => t['Gerencia Líder']);
                else if (activeTab === 'weekly') options = (data?.weekly || []).map(w => w['Gerencia Líder']);
                
                return [...new Set(options)].filter(Boolean).sort().map(m => (
                  <option key={m} value={m}>{m}</option>
                ));
              })()}
            </select>
          </div>
        </div>
      )}

      {/* Main Dashboard Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-[#f4f7f9] custom-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          {activeTab === 'demand' && renderDemandDashboard()}
          {activeTab === 'portfolio' && renderPortfolioDashboard()}
          {activeTab === 'trend' && renderTrendDashboard()}
          {activeTab === 'weekly' && renderWeeklyDashboard()}
        </div>
      </main>
    </div>
  );
}
