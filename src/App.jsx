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
      label = "En Riesgo";
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

// ── GanttTable: collapsible Gantt with project → etapa → actividad hierarchy ──
function GanttTable({ schedule, allGanttCols, yearGroups, MONTH_ABBR, ganttColor, pctStr, indicadorInfo }) {
  const [expanded, setExpanded] = React.useState(() => {
    const s = new Set();
    schedule.forEach((_, i) => s.add(i));
    return s;
  });
  const [expandedEtapas, setExpandedEtapas] = React.useState(() => {
    const s = new Set();
    schedule.forEach((p, pi) => p.etapas.forEach((_, ei) => s.add(`${pi}-${ei}`)));
    return s;
  });

  const toggleProject = (pi) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(pi) ? next.delete(pi) : next.add(pi);
      return next;
    });
  };

  const toggleEtapa = (key) => {
    setExpandedEtapas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const COL_W = 34; // px per month column
  const hasGantt = allGanttCols.length > 0;

  const minDate = hasGantt ? new Date(allGanttCols[0].year, allGanttCols[0].month, 1) : null;
  const maxDate = hasGantt ? new Date(allGanttCols[allGanttCols.length - 1].year, allGanttCols[allGanttCols.length - 1].month + 1, 0) : null;
  const totalMs = hasGantt ? (maxDate.getTime() - minDate.getTime()) : 1;

  const toNum = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const renderBar = (row, height) => {
    if (!row.fechaInicio || !row.fechaFin || !minDate) return null;
    const start = new Date(row.fechaInicio);
    const end = new Date(row.fechaFin);
    if (isNaN(start) || isNaN(end) || end < start) return null;

    const leftPct = ((start.getTime() - minDate.getTime()) / totalMs) * 100;
    const widthPct = ((end.getTime() - start.getTime()) / totalMs) * 100;

    if (leftPct > 100 || leftPct + widthPct < 0) return null;
    const l = Math.max(0, leftPct);
    const r = Math.min(100, leftPct + widthPct);
    const w = r - l;

    const plan = toNum(row.planPct);
    const exec = toNum(row.execPct);
    const planF = plan !== null ? (plan <= 1.01 ? plan : plan / 100) : 0;
    const execF = exec !== null ? (exec <= 1.01 ? exec : exec / 100) : 0;

    const minW = w < 0.5 ? 0.5 : w; // ensure min width for very short tasks

    return (
      <div style={{ position: 'absolute', left: `${l}%`, width: `${minW}%`, minWidth: '4px', height: '100%', top: 0, display: 'flex', alignItems: 'center', zIndex: 5 }}>

        {row.fechaInicioStr !== row.fechaFinStr && (
          <span style={{ position: 'absolute', right: '100%', marginRight: '6px', fontSize: '9px', color: '#4b5563', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {row.fechaInicioStr}
          </span>
        )}

        <div style={{ position: 'relative', height: '14px', width: '100%', backgroundColor: '#d1d5db', borderRadius: '4px', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, planF * 100)}%`, backgroundColor: '#86efac', zIndex: 1 }} />
          <div style={{ position: 'absolute', left: 0, top: '25%', height: '50%', width: `${Math.min(100, execF * 100)}%`, backgroundColor: '#16a34a', zIndex: 2, borderRadius: '0 4px 4px 0' }} />
        </div>

        <span style={{ position: 'absolute', left: '100%', marginLeft: '6px', fontSize: '9px', color: '#4b5563', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {row.fechaFinStr}
        </span>

      </div>
    );
  };

  const LEFT_COLS = [
    { label: 'Indicador', w: 90, left: 210 },
    { label: 'Gerencia', w: 110, left: 300 },
    { label: '% Plan', w: 56, left: 410 },
    { label: '% Real', w: 56, left: 466 },
    { label: 'F. Inicio', w: 78, left: 522 },
    { label: 'F. Fin', w: 78, left: 600 },
  ];
  const NAME_W = 210;
  const totalW = NAME_W + LEFT_COLS.reduce((a, c) => a + c.w, 0) + allGanttCols.length * COL_W;

  const thStyle = (w) => ({
    minWidth: w, width: w, padding: '6px 6px', textAlign: 'center',
    borderRight: '1px solid #2d4f7a', fontSize: '10px', fontWeight: 700,
    whiteSpace: 'nowrap', overflow: 'hidden',
  });
  const tdStyle = (w, extra = {}) => ({
    minWidth: w, width: w, padding: '4px 6px', borderRight: '1px solid #e5e7eb',
    fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    ...extra,
  });

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: totalW, tableLayout: 'fixed' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
          {Object.keys(yearGroups).length > 0 && (
            <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
              <th style={{ ...thStyle(NAME_W), textAlign: 'left', position: 'sticky', left: 0, zIndex: 30, backgroundColor: '#1e3a5f' }}>
                Proyecto / Etapa / Actividad
              </th>
              {LEFT_COLS.map((c, i) => (
                <th key={i} style={{ ...thStyle(c.w), position: 'sticky', left: c.left, zIndex: 30, backgroundColor: '#1e3a5f' }}>{c.label}</th>
              ))}
              {Object.entries(yearGroups).map(([year, cols]) => (
                <th key={year} colSpan={cols.length} style={{ ...thStyle(cols.length * COL_W), borderRight: '2px solid #2d4f7a' }}>
                  {year}
                </th>
              ))}
            </tr>
          )}
          <tr style={{ backgroundColor: '#2d4f7a', color: 'white' }}>
            <th style={{ ...thStyle(NAME_W), textAlign: 'left', position: 'sticky', left: 0, zIndex: 30, backgroundColor: '#2d4f7a' }} />
            {LEFT_COLS.map((c, i) => <th key={i} style={{ ...thStyle(c.w), position: 'sticky', left: c.left, zIndex: 30, backgroundColor: '#2d4f7a' }} />)}
            {allGanttCols.map((col, i) => (
              <th key={i} style={{ ...thStyle(COL_W), fontSize: '8px', padding: '4px 2px', borderRight: '1px solid #475569' }}>
                {MONTH_ABBR[col.month] || col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ backgroundColor: '#ffffff' }}>
          {schedule.map((project, pi) => {
            const ic = indicadorInfo(project.indicador);
            const isExpanded = expanded.has(pi);
            const hasChildren = project.etapas.length > 0;
            const rowBg = '#f8fafc';

            return (
              <React.Fragment key={pi}>
                <tr
                  style={{ cursor: hasChildren ? 'pointer' : 'default', height: 48 }}
                  onClick={() => hasChildren && toggleProject(pi)}
                >
                  <td style={{ ...tdStyle(NAME_W), position: 'sticky', left: 0, zIndex: 10, backgroundColor: rowBg, fontWeight: 700, color: '#1e3a5f', borderBottom: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {hasChildren && (
                        <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0, width: 12 }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project.nombre}>
                        {project.nombre}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle(LEFT_COLS[0].w), textAlign: 'center', position: 'sticky', left: LEFT_COLS[0].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #cbd5e1' }}>
                    <span className={cn('px-1.5 py-0.5 rounded border font-bold', ic.badge)} style={{ fontSize: 8, whiteSpace: 'nowrap' }}>
                      {ic.label}
                    </span>
                  </td>
                  <td style={{ ...tdStyle(LEFT_COLS[1].w), color: '#4b5563', position: 'sticky', left: LEFT_COLS[1].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #cbd5e1' }} title={project.gerencia}>{project.gerencia || '-'}</td>
                  <td style={{ ...tdStyle(LEFT_COLS[2].w), textAlign: 'center', fontWeight: 700, color: '#1e3a5f', position: 'sticky', left: LEFT_COLS[2].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #cbd5e1' }}>{pctStr(project.planPct)}</td>
                  <td style={{ ...tdStyle(LEFT_COLS[3].w), textAlign: 'center', fontWeight: 700, color: '#15803d', position: 'sticky', left: LEFT_COLS[3].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #cbd5e1' }}>{pctStr(project.execPct)}</td>
                  <td style={{ ...tdStyle(LEFT_COLS[4].w), textAlign: 'center', color: '#6b7280', fontSize: 9, position: 'sticky', left: LEFT_COLS[4].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #cbd5e1' }}>{project.fechaInicioStr || '-'}</td>
                  <td style={{ ...tdStyle(LEFT_COLS[5].w), textAlign: 'center', color: '#6b7280', fontSize: 9, position: 'sticky', left: LEFT_COLS[5].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #cbd5e1' }}>{project.fechaFinStr || '-'}</td>

                  {hasGantt && (
                    <td colSpan={allGanttCols.length} style={{ position: 'relative', padding: 0, minWidth: allGanttCols.length * COL_W, width: allGanttCols.length * COL_W, backgroundColor: 'transparent', borderBottom: '1px solid #cbd5e1' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none' }}>
                        {allGanttCols.map((_, i) => (
                          <div key={i} style={{ width: COL_W, minWidth: COL_W, borderRight: '1px dashed #cbd5e1', opacity: 0.5 }} />
                        ))}
                      </div>
                      {renderBar(project, 48)}
                    </td>
                  )}
                </tr>

                {isExpanded && project.etapas.map((etapa, ei) => {
                  const etapaKey = `${pi}-${ei}`;
                  const etapaExpanded = expandedEtapas.has(etapaKey);
                  const hasActs = etapa.actividades && etapa.actividades.length > 0;
                  const showEtapaRow = !!etapa.nombre;
                  const rowBg = '#ffffff';

                  return (
                    <React.Fragment key={etapaKey}>
                      {showEtapaRow && (
                        <tr
                          style={{ cursor: hasActs ? 'pointer' : 'default', height: 44 }}
                          onClick={() => hasActs && toggleEtapa(etapaKey)}
                        >
                          <td style={{ ...tdStyle(NAME_W), position: 'sticky', left: 0, zIndex: 10, backgroundColor: rowBg, paddingLeft: 24, borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {hasActs && (
                                <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0, width: 10 }}>
                                  {etapaExpanded ? '▼' : '▶'}
                                </span>
                              )}
                              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#64748b', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151', fontWeight: 600 }} title={etapa.nombre}>
                                {etapa.nombre}
                              </span>
                            </div>
                          </td>
                          <td style={{ ...tdStyle(LEFT_COLS[0].w), position: 'sticky', left: LEFT_COLS[0].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0' }} />
                          <td style={{ ...tdStyle(LEFT_COLS[1].w), position: 'sticky', left: LEFT_COLS[1].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0' }} />
                          <td style={{ ...tdStyle(LEFT_COLS[2].w), textAlign: 'center', fontWeight: 600, color: '#1e3a5f', fontSize: 9, position: 'sticky', left: LEFT_COLS[2].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0' }}>{pctStr(etapa.planPct)}</td>
                          <td style={{ ...tdStyle(LEFT_COLS[3].w), textAlign: 'center', fontWeight: 600, color: '#15803d', fontSize: 9, position: 'sticky', left: LEFT_COLS[3].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0' }}>{pctStr(etapa.execPct)}</td>
                          <td style={{ ...tdStyle(LEFT_COLS[4].w), textAlign: 'center', color: '#9ca3af', fontSize: 9, position: 'sticky', left: LEFT_COLS[4].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0' }}>{etapa.fechaInicioStr || '-'}</td>
                          <td style={{ ...tdStyle(LEFT_COLS[5].w), textAlign: 'center', color: '#9ca3af', fontSize: 9, position: 'sticky', left: LEFT_COLS[5].left, zIndex: 10, backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0' }}>{etapa.fechaFinStr || '-'}</td>

                          {hasGantt && (
                            <td colSpan={allGanttCols.length} style={{ position: 'relative', padding: 0, minWidth: allGanttCols.length * COL_W, width: allGanttCols.length * COL_W, backgroundColor: 'transparent', borderBottom: '1px solid #e2e8f0' }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none' }}>
                                {allGanttCols.map((_, i) => (
                                  <div key={i} style={{ width: COL_W, minWidth: COL_W, borderRight: '1px dashed #cbd5e1', opacity: 0.5 }} />
                                ))}
                              </div>
                              {renderBar(etapa, 44)}
                            </td>
                          )}
                        </tr>
                      )}

                      {(etapaExpanded || !showEtapaRow) && hasActs && etapa.actividades.map((act, ai) => {
                        const actBg = '#ffffff';
                        return (
                          <tr key={`${etapaKey}-${ai}`} style={{ height: 40 }}>
                            <td style={{ ...tdStyle(NAME_W), position: 'sticky', left: 0, zIndex: 10, backgroundColor: actBg, paddingLeft: showEtapaRow ? 44 : 28, borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#cbd5e1', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280', fontSize: 9 }} title={act.nombre}>
                                  {act.nombre}
                                </span>
                              </div>
                            </td>
                            <td style={{ ...tdStyle(LEFT_COLS[0].w), position: 'sticky', left: LEFT_COLS[0].left, zIndex: 10, backgroundColor: actBg, borderBottom: '1px solid #f1f5f9' }} />
                            <td style={{ ...tdStyle(LEFT_COLS[1].w), position: 'sticky', left: LEFT_COLS[1].left, zIndex: 10, backgroundColor: actBg, borderBottom: '1px solid #f1f5f9' }} />
                            <td style={{ ...tdStyle(LEFT_COLS[2].w), textAlign: 'center', color: '#1e3a5f', fontSize: 9, position: 'sticky', left: LEFT_COLS[2].left, zIndex: 10, backgroundColor: actBg, borderBottom: '1px solid #f1f5f9' }}>{pctStr(act.planPct)}</td>
                            <td style={{ ...tdStyle(LEFT_COLS[3].w), textAlign: 'center', color: '#15803d', fontSize: 9, position: 'sticky', left: LEFT_COLS[3].left, zIndex: 10, backgroundColor: actBg, borderBottom: '1px solid #f1f5f9' }}>{pctStr(act.execPct)}</td>
                            <td style={{ ...tdStyle(LEFT_COLS[4].w), textAlign: 'center', color: '#9ca3af', fontSize: 9, position: 'sticky', left: LEFT_COLS[4].left, zIndex: 10, backgroundColor: actBg, borderBottom: '1px solid #f1f5f9' }}>{act.fechaInicioStr || '-'}</td>
                            <td style={{ ...tdStyle(LEFT_COLS[5].w), textAlign: 'center', color: '#9ca3af', fontSize: 9, position: 'sticky', left: LEFT_COLS[5].left, zIndex: 10, backgroundColor: actBg, borderBottom: '1px solid #f1f5f9' }}>{act.fechaFinStr || '-'}</td>

                            {hasGantt && (
                              <td colSpan={allGanttCols.length} style={{ position: 'relative', padding: 0, minWidth: allGanttCols.length * COL_W, width: allGanttCols.length * COL_W, backgroundColor: 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none' }}>
                                  {allGanttCols.map((_, i) => (
                                    <div key={i} style={{ width: COL_W, minWidth: COL_W, borderRight: '1px dashed #cbd5e1', opacity: 0.5 }} />
                                  ))}
                                </div>
                                {renderBar(act, 40)}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [tableColumnFilters, setTableColumnFilters] = useState({});
  const [portfolioColumnFilters, setPortfolioColumnFilters] = useState({});
  const [activeFilterMenu, setActiveFilterMenu] = useState(null); // { key: string, rect: DOMRect, isPortfolio?: boolean, isTrend?: boolean, isWeekly?: boolean }
  const [weeklyColumnFilters, setWeeklyColumnFilters] = useState({});
  const [weeklyChartFilter, setWeeklyChartFilter] = useState(null); // { key: string, value: string }
  const [selectedOpp, setSelectedOpp] = useState(null); // For expanded OPP view
  const [showStrategicDetail, setShowStrategicDetail] = useState(false);
  const [demand2GerenciaFilter, setDemand2GerenciaFilter] = useState(null);
  const [demand2IndicadorFilter, setDemand2IndicadorFilter] = useState(null);
  const [demand2GestorFilter, setDemand2GestorFilter] = useState(null);

  const getUniqueValues = (key, isPortfolio = false, isTrend = false, isWeekly = false) => {
    let source = [];
    if (isPortfolio) {
      source = data?.portfolio || [];
    } else if (isTrend) {
      source = data?.trend || [];
    } else if (isWeekly) {
      source = data?.weekly || [];
    } else if (activeTab === 'demand2') {
      source = demand2Data?.schedule || [];
    } else if (activeTab === 'trend') {
      source = data?.trend || [];
    } else if (activeTab === 'demand') {
      source = data?.demand || [];
    } else if (activeTab === 'weekly') {
      source = data?.weekly || [];
    }

    const values = source
      .map(item => {
        if (isPortfolio) {
          if (key === 'Priorizado') {
            const prioritizedProjectNames = new Set(
              (data?.trend || []).map(t => String(t['Proyecto'] || '').toLowerCase().trim())
            );
            return prioritizedProjectNames.has(String(item['Nombre del Proyecto'] || '').toLowerCase().trim()) ? 'Sí' : 'No';
          }
          if (key === 'Salud') return getHealthColor(item).includes('bg-green') ? 'Excelente' : getHealthColor(item).includes('bg-yellow') ? 'En Riesgo' : 'Retraso';
          if (key === 'Nombre del Proyecto') return item['Nombre del Proyecto'];
        } else if (isTrend || activeTab === 'trend') {
          if (key === 'Proyecto') return item['Proyecto'];
          if (key === 'Tipo de Proyecto') {
            let type = item['Tipo de Proyecto'];
            if (type === "0" || type === 0) {
              type = "Otros (0)";
            } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
              type = "Por asignar";
            } else {
              type = String(type).trim();
            }
            return type;
          }
        } else if (activeTab === 'demand' || activeTab === 'demand2') {
          if (key === 'Salud') return getDemandProjectHealth(item).label;
          if (key === 'Nombre del Proyecto') return item['Nombre del Proyecto'] || item['PROYECTO'];
        }

        // For weekly Responsable: split "Juan / Pedro" into individual names
        if (isWeekly && key === 'Responsable') {
          const raw = cleanString(item['Responsable'] || item['LÍDER TÉCNICO'] || item['LIDER DEL PROYECTO'] || '');
          const names = raw.split('/').map(n => n.trim()).filter(n => n && n !== '-');
          return names.length > 0 ? names : ['Sin asignar'];
        }

        // For weekly Estado: normalize to predefined categories
        if (isWeekly && key === 'Estado') {
          return normalizeEstado(item[key]);
        }

        // For weekly date columns: group by month-year (or just month if same year), text keywords, or "Otros"
        if (isWeekly && (key === 'Fecha Compromiso2' || key === 'FECHA COMPROMISO' || key.includes('Fecha Compromiso') || key.includes('FECHA'))) {
          const raw = item['Fecha Compromiso2'] || item['FECHA COMPROMISO'] || item[key];
          const s = cleanString(String(raw || '')).toLowerCase();
          // Empty or N/A
          if (!raw || s === '' || s === '-' || s === 'n/a' || s === 'na') return null; // Will become "Otros" below
          // Text-based categories
          if (s.includes('por definir') || s.includes('por confirmar') || s.includes('pendiente fecha') || s.includes('sin definir')) return 'Por Definir';
          if (s.includes('finalizado') || s.includes('cerrado') || s.includes('terminado') || s.includes('completado')) return 'Finalizado';
          // Try to parse as date
          const d = parseDateString(raw);
          if (!d) return null;
          return { type: 'date', date: d, month: MONTH_NAMES_SHORT[d.getMonth()], year: d.getFullYear(), monthNum: d.getMonth() };
        }

        const val = item[key];
        // For Gerencia Líder: clean numbers/dates → show as 'Otros' in filter options
        if (key === 'Gerencia Líder') {
          const g = cleanGerencia(val);
          return g || 'Otros';
        }
        const strVal = String(val || '').trim();
        if (strVal === '' || strVal === '-' || strVal === '0') {
          return 'Otros';
        }
        return val;
      })
      .flat()
      .filter(v => v !== null && v !== undefined && v !== '');

    // Deduplicate weekly values using normalization
    if (activeTab === 'weekly' || isWeekly) {
      // Check if this is a date column (contains date objects)
      const dateItems = values.filter(v => typeof v === 'object' && v !== null && v.type === 'date');
      if (dateItems.length > 0 && (key === 'Fecha Compromiso2' || key === 'FECHA COMPROMISO' || key.includes('Fecha Compromiso') || key.includes('FECHA'))) {
        // Determine format: month only if same year, else "Mes-Año"
        const years = new Set(dateItems.map(d => d.year));
        const useYear = years.size > 1;
        // Group by the label
        const dateGroups = new Map();
        dateItems.forEach(d => {
          const label = useYear ? `${d.month}-${d.year}` : d.month;
          const sortKey = d.year * 12 + d.monthNum;
          if (!dateGroups.has(label)) {
            dateGroups.set(label, { label, sortKey });
          }
        });
        const dateLabels = [...dateGroups.values()].sort((a, b) => a.sortKey - b.sortKey).map(d => d.label);

        // Deduplicate non-date values
        const nonDateValues = values.filter(v => typeof v !== 'object' || v.type !== 'date');
        const nonDateGrouped = new Map();
        nonDateValues.forEach(v => {
          const normalized = normalizeForGrouping(v);
          if (!nonDateGrouped.has(normalized)) {
            nonDateGrouped.set(normalized, v);
          }
        });

        // Add "Otros" if there were null/empty/N/A values or unrecognized text
        const hasEmpties = source.some(item => {
          const raw = item['Fecha Compromiso2'] || item['FECHA COMPROMISO'] || item[key];
          if (!raw) return true;
          const s = cleanString(String(raw)).toLowerCase();
          if (s === '' || s === '-' || s === 'n/a' || s === 'na') return true;
          // Not a date, not a known category → goes to "Otros"
          if (!s.includes('por definir') && !s.includes('por confirmar') && !s.includes('pendiente fecha') && !s.includes('sin definir') && !s.includes('finalizado') && !s.includes('cerrado') && !s.includes('terminado') && !s.includes('completado')) {
            const d = parseDateString(raw);
            if (!d) return true;
          }
          return false;
        });

        // Sort: dates first (chronological), then text categories, then "Otros" last
        const textValues = [...nonDateGrouped.values()].filter(v => v !== 'Otros').sort((a, b) => {
          const order = { 'Por Definir': 0, 'Finalizado': 1 };
          return (order[a] ?? 99) - (order[b] ?? 99);
        });

        const result = [...dateLabels, ...textValues];
        if (hasEmpties) result.push('Otros');
        return result;
      }

      const grouped = new Map();
      values.forEach(v => {
        const normalized = normalizeForGrouping(v);
        if (!grouped.has(normalized)) {
          grouped.set(normalized, v);
        }
      });
      return [...grouped.values()].sort((a, b) => {
        const aSpecial = a === 'Sin fecha' || a === 'Otros' || a === 'Sin asignar';
        const bSpecial = b === 'Sin fecha' || b === 'Otros' || b === 'Sin asignar';
        if (aSpecial && !bSpecial) return 1;
        if (!aSpecial && bSpecial) return -1;
        return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
      });
    }

    return Array.from(new Set(values)).sort();
  };

  const handleFilterClick = (key, e, isPortfolio = false, isTrend = false, isWeekly = false) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (activeFilterMenu?.key === key && activeFilterMenu?.isPortfolio === isPortfolio && activeFilterMenu?.isTrend === isTrend && activeFilterMenu?.isWeekly === isWeekly) {
      setActiveFilterMenu(null);
    } else {
      setActiveFilterMenu({ key, rect, isPortfolio, isTrend, isWeekly });
    }
  };

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
  const [trendTypeFilter, setTrendTypeFilter] = useState(null); // { type: string }
  const [trendSearch, setTrendSearch] = useState('');
  const [trendColumnFilters, setTrendColumnFilters] = useState({});

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

          // Find header row (the one with "Proyectos Priorizados" or "Tipo de Proyecto")
          const headerIdx = rows.findIndex(r => r && r.some(c => {
            const s = String(c).toLowerCase();
            return s.includes('proyectos priorizados') || s.includes('tipo de proyecto');
          }));
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
            gerencia: headerSub.findIndex(c => c && (String(c).toLowerCase().includes('gerencia') || String(c).toLowerCase().includes('líder'))),
            lider: headerSub.findIndex(c => c && (String(c).toLowerCase().includes('líder del') || String(c).toLowerCase().includes('lider'))),
            presupuesto: headerSub.findIndex(c => c && (String(c).toLowerCase().includes('presupuesto') || String(c).toLowerCase().includes('costo'))),
            dimension: headerSub.findIndex(c => c && (String(c).toLowerCase().includes('dimensión') || String(c).toLowerCase().includes('dimension'))),
            tipo: headerSub.findIndex(c => {
              if (!c) return false;
              const val = String(c).toLowerCase();
              return val.includes('tipo de proyecto') || val.includes('tipo de proy') || val.includes('tipo proyecto') || val === 'tipo';
            }),
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
              'Tipo de Proyecto': r[idx('tipo', 11)],
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

        const trendSheetName =
          wb.SheetNames.find(n => n.toLowerCase().includes('pys transf digital')) ||
          findSheet(wb, ['pys', 'transf', 'digital']) ||
          findSheet(wb, ['tendencia']) ||
          (wb.SheetNames.length > 3 ? wb.SheetNames[3] : wb.SheetNames[wb.SheetNames.length - 1]);

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
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });

        // Find the sheet — guard against non-string sheet names
        let sheetName = wb.SheetNames.find(n =>
          typeof n === 'string' && n.toLowerCase().includes('demanda estrat')
        );
        if (!sheetName) sheetName = wb.SheetNames[0];

        const sheet = wb.Sheets[sheetName];
        if (!sheet) throw new Error(`No se pudo leer la hoja: ${sheetName}`);

        // Get raw rows as arrays
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        // ── Helpers ──────────────────────────────────────────────────────────
        const toDate = (v) => {
          if (!v) return null;
          if (v instanceof Date) return v;
          if (typeof v === 'number' && v > 1000) return new Date((v - 25569) * 86400 * 1000);
          if (typeof v === 'string') {
            const d = new Date(v);
            return isNaN(d.getTime()) ? null : d;
          }
          return null;
        };
        const toDateStr = (v) => {
          const d = toDate(v);
          if (!d) return null;
          return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        const toNum = (v) => {
          if (v === null || v === undefined) return null;
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
          return isNaN(n) ? null : n;
        };
        const cellStr = (v) => (v !== null && v !== undefined ? String(v).trim() : '');

        const MONTH_MAP = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };

        // ── Step 1: Find the second table (avances + cronograma) ──────────────
        // Strategy: scan ALL rows, find the one that has the most "useful" columns
        // (has a project name column + % columns + date columns)
        // The second table typically starts around row 27-30 (0-indexed)

        // First, find any row that has BOTH a date-like column AND a % column
        // AND a text column that looks like a project name
        let table2HeaderIdx = -1;

        for (let r = 5; r < Math.min(allRows.length, 60); r++) {
          const row = allRows[r];
          if (!row) continue;
          const cells = row.map(c => cellStr(c).toLowerCase());
          const hasPct = cells.some(c => c === '%' || c.includes('planificado') || c.includes('avance'));
          const hasFecha = cells.some(c => c.includes('fecha') || c.includes('inicio') || c.includes('fin'));
          const hasProj = cells.some(c => c.includes('proyecto') || c === 'proyecto');
          if (hasPct && hasFecha && hasProj) {
            table2HeaderIdx = r;
            break;
          }
        }

        // Fallback: find row with "%" and "Fecha"
        if (table2HeaderIdx === -1) {
          for (let r = 5; r < Math.min(allRows.length, 60); r++) {
            const row = allRows[r];
            if (!row) continue;
            const cells = row.map(c => cellStr(c).toLowerCase());
            if (cells.some(c => c === '%' || c.includes('planificado')) && cells.some(c => c.includes('fecha'))) {
              table2HeaderIdx = r;
              break;
            }
          }
        }

        if (table2HeaderIdx === -1) {
          // Last resort: use row 27 (common position in these files)
          table2HeaderIdx = Math.min(27, allRows.length - 2);
        }

        // ── Step 2: Detect Gantt month columns ────────────────────────────────
        // Look in rows ABOVE table2HeaderIdx for month/year headers
        // The Excel typically has: yearRow (merged) then monthRow then dataHeader
        let ganttCols = [];

        const tryBuildGanttCols = (monthRowIdx, yearRowIdx) => {
          if (monthRowIdx < 0 || monthRowIdx >= allRows.length) return [];
          const monthRow = allRows[monthRowIdx] || [];
          const yearRow = yearRowIdx >= 0 && yearRowIdx < allRows.length ? (allRows[yearRowIdx] || []) : [];
          const cols = [];
          let curYear = null;

          for (let c = 0; c < monthRow.length; c++) {
            // Pick up year from year row (carry forward for merged cells)
            const yrCell = yearRow[c];
            if (yrCell !== null && yrCell !== undefined) {
              const yr = parseInt(String(yrCell));
              if (!isNaN(yr) && yr >= 2020 && yr <= 2040) curYear = yr;
            }
            const mCell = monthRow[c];
            if (!mCell) continue;
            const mStr = cellStr(mCell).toLowerCase();
            // Handle "Ene-26", "Ene 2026", "ENE", "enero", etc.
            const yearSuffix = mStr.match(/[^a-z](\d{2,4})$/);
            if (yearSuffix) {
              const yr2 = parseInt(yearSuffix[1]);
              if (!isNaN(yr2)) curYear = yr2 < 100 ? 2000 + yr2 : yr2;
            }
            const mk = mStr.replace(/[^a-z]/g, '').substring(0, 3);
            if (MONTH_MAP[mk] !== undefined && curYear) {
              cols.push({ colIdx: c, year: curYear, month: MONTH_MAP[mk], label: cellStr(mCell) });
            }
          }
          return cols;
        };

        // Try combinations: month row at offset -1, -2, -3 from header; year row one above that
        for (let mOff = 1; mOff <= 4 && ganttCols.length === 0; mOff++) {
          const mRow = table2HeaderIdx - mOff;
          ganttCols = tryBuildGanttCols(mRow, mRow - 1);
          if (ganttCols.length === 0) ganttCols = tryBuildGanttCols(mRow, -1);
        }

        // ── Step 3: Parse table2 header row ──────────────────────────────────
        const h2raw = allRows[table2HeaderIdx] || [];
        const h2 = h2raw.map(c => cellStr(c));

        const findCol = (...kws) => h2.findIndex(h =>
          typeof h === 'string' && kws.some(k => h.toLowerCase().replace(/[\s\-_]/g, '').includes(k.toLowerCase().replace(/[\s\-_]/g, '')))
        );

        const colN = findCol('N°', 'Nro', 'Num');
        const colIndicador = findCol('Indicador');
        const colProyecto = findCol('PROYECTO', 'NombreProyecto', 'Proyecto');
        const colGerencia = findCol('Gerencia', 'GerenciaL');
        const colGestor = findCol('Gestor', 'Responsable');
        const colPlan = findCol('Planificado', '%Plan', 'AvancePlan');
        // Exec column: "%" alone, or right after plan col
        const colExec = (() => {
          const idx = h2.findIndex((h, i) => {
            if (typeof h !== 'string') return false;
            const s = h.toLowerCase().replace(/[\s\-_]/g, '');
            return i !== colPlan && (s === '%' || s.includes('ejecutado') || s.includes('completado') || s.includes('avanceejec') || s.includes('avancecomp'));
          });
          if (idx !== -1) return idx;
          // fallback: column right after plan
          return colPlan !== -1 ? colPlan + 1 : -1;
        })();
        const colInicio = findCol('FechaInicio', 'Inicio', 'FInicio');
        const colFin = findCol('FechaFin', 'Fin', 'FFin');

        // ── Step 4: Parse data rows ───────────────────────────────────────────
        const ETAPA_RE = /^(etapa|fase|mvp|sprint|release|hito|milestone)/i;
        const ACTIVITY_RE = /^(desarrollo|calidad|producci[oó]n|testing|qa|deploy|implementaci[oó]n|uat|certificaci[oó]n)/i;
        // Entregables and similar are always flat leaves — never parents of other rows
        const LEAF_RE = /^(entregable|deliverable|componente|m[oó]dulo)/i;
        const INDICATOR_RE = /^(en curso|en riesgo|atrasado|finalizado|no iniciado|completado)/i;

        const schedule = [];
        let curProject = null;
        let curEtapa = null;

        const getCell = (row, idx) => (idx >= 0 && idx < row.length) ? row[idx] : null;

        for (let r = table2HeaderIdx + 1; r < allRows.length; r++) {
          const row = allRows[r];
          if (!row) continue;
          const nonNull = row.filter(c => c !== null && c !== undefined && c !== '');
          if (nonNull.length === 0) continue;

          const rawName = getCell(row, colProyecto);
          const rawIndicador = getCell(row, colIndicador);
          const rawN = getCell(row, colN);
          const rawPlan = getCell(row, colPlan);
          const rawExec = getCell(row, colExec);
          const rawInicio = getCell(row, colInicio);
          const rawFin = getCell(row, colFin);
          const rawGerencia = getCell(row, colGerencia);
          const rawGestor = getCell(row, colGestor);

          const name = rawName ? cellStr(rawName) : null;
          const indicador = rawIndicador ? cellStr(rawIndicador) : null;

          if (!name) continue;

          const planPct = toNum(rawPlan);
          const execPct = toNum(rawExec);
          const fechaInicio = toDate(rawInicio);
          const fechaFin = toDate(rawFin);

          const rowBase = {
            nombre: name,
            planPct, execPct,
            fechaInicio, fechaFin,
            fechaInicioStr: toDateStr(rawInicio),
            fechaFinStr: toDateStr(rawFin),
          };

          const hasIndicator = indicador && INDICATOR_RE.test(indicador);
          const hasN = rawN !== null && rawN !== undefined && !isNaN(parseInt(String(rawN)));
          const isLeaf = LEAF_RE.test(name) || ACTIVITY_RE.test(name);
          const isEtapa = !isLeaf && ETAPA_RE.test(name);

          if (hasIndicator || hasN) {
            // PROJECT ROW
            curProject = {
              ...rowBase,
              indicador: indicador || '',
              gerencia: rawGerencia ? cellStr(rawGerencia) : '',
              gestor: rawGestor ? cellStr(rawGestor) : '',
              etapas: [],
            };
            curEtapa = null;
            schedule.push(curProject);
          } else if (isEtapa && curProject) {
            // ETAPA ROW — can have children
            curEtapa = { ...rowBase, actividades: [] };
            curProject.etapas.push(curEtapa);
          } else if (isLeaf && curProject) {
            // LEAF ROW (entregable, actividad) — always flat, never a parent
            // Attach to current etapa if one exists, otherwise directly to project
            if (curEtapa) {
              curEtapa.actividades.push({ ...rowBase });
            } else {
              if (!curProject._direct) curProject._direct = [];
              curProject._direct.push({ ...rowBase });
            }
          } else if (curProject) {
            // Unknown sub-row: treat as etapa only if no curEtapa yet AND it looks
            // like it could be a section header (short name). Otherwise treat as leaf.
            const looksLikeSection = name.length <= 40 && !name.includes(' - ');
            if (!curEtapa && looksLikeSection) {
              curEtapa = { ...rowBase, actividades: [] };
              curProject.etapas.push(curEtapa);
            } else {
              // Treat as a flat leaf under current etapa or project
              if (curEtapa) {
                curEtapa.actividades.push({ ...rowBase });
              } else {
                if (!curProject._direct) curProject._direct = [];
                curProject._direct.push({ ...rowBase });
              }
            }
          }
        }

        // Promote _direct activities into a synthetic etapa
        schedule.forEach(p => {
          if (p._direct && p._direct.length > 0) {
            p.etapas.unshift({
              nombre: '', planPct: null, execPct: null,
              fechaInicio: null, fechaFin: null, fechaInicioStr: null, fechaFinStr: null,
              actividades: p._direct,
            });
            delete p._direct;
          }
        });

        // ── Step 5: Ensure ganttCols cover the full date range of all rows ────
        // Collect every fechaInicio and fechaFin across all projects, etapas, children
        const allDates = [];
        const collectDates = (row) => {
          if (row.fechaInicio) allDates.push(row.fechaInicio);
          if (row.fechaFin) allDates.push(row.fechaFin);
        };
        schedule.forEach(p => {
          collectDates(p);
          p.etapas.forEach(e => {
            collectDates(e);
            (e.actividades || e.children || []).forEach(a => collectDates(a));
          });
        });

        if (allDates.length > 0) {
          const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

          // Start from the earliest date (no buffer — exact coverage)
          const rangeStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
          const rangeEnd = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

          // Check if existing ganttCols already cover the range
          const firstCol = ganttCols.length > 0 ? new Date(ganttCols[0].year, ganttCols[0].month, 1) : null;
          const lastCol = ganttCols.length > 0 ? new Date(ganttCols[ganttCols.length - 1].year, ganttCols[ganttCols.length - 1].month, 1) : null;

          const needsExpansion = ganttCols.length === 0 || firstCol > rangeStart || lastCol < rangeEnd;

          if (needsExpansion) {
            // Rebuild from scratch covering the full range
            ganttCols = [];
            let cur = new Date(rangeStart);
            let idx = 0;
            while (cur <= rangeEnd) {
              ganttCols.push({
                colIdx: idx,
                year: cur.getFullYear(),
                month: cur.getMonth(),
                label: MONTH_NAMES[cur.getMonth()],
              });
              cur.setMonth(cur.getMonth() + 1);
              idx++;
            }
          }
        }

        setDemand2Data({ schedule, ganttCols });
        setLoading(false);
        setActiveTab('demand2');
      } catch (err) {
        console.error(err);
        alert('Error procesando el archivo: ' + err.message);
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };
  const normalizeForGrouping = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '') // Remove zero-width and non-breaking spaces
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents/tilde
      .replace(/[\u{1F7E0}-\u{1F7FF}\u{26AA}-\u{26AB}\u{1F534}-\u{1F535}\u{25CF}\u{2B24}]/gu, '') // Remove circle emoji
      .replace(/[🔴🟡🟢🟠⚫⚪🔵]/g, '') // Remove common circle emojis
      .replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F]/g, "'") // Normalize quotes
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const ESTADO_CATEGORIES = ['En Proceso', 'Pendiente', 'Finalizado', 'Por Definir', 'Observado', 'Otros'];

  const normalizeEstado = (raw) => {
    if (!raw) return 'Sin estado';
    const s = String(raw).trim().toLowerCase();
    if (s.startsWith('finalizado') || s.startsWith('cerrado') || s.startsWith('terminado') || s.startsWith('implementado')) return 'Finalizado';
    if (s.startsWith('en proceso') || s.startsWith('en curso')) return 'En Proceso';
    if (s.startsWith('pendiente')) return 'Pendiente';
    if (s.startsWith('observado') || s.startsWith('subsanar')) return 'Observado';
    if (s.startsWith('por definir')) return 'Por Definir';
    if (s.startsWith('bloqueado')) return 'Otros';
    if (s.startsWith('cancelado') || s.startsWith('descartado')) return 'Otros';
    const cut = String(raw).split(/\s*[-–—:()]\s*/)[0].trim();
    return cut.length <= 25 ? (cut.charAt(0).toUpperCase() + cut.slice(1)) : 'Otros';
  };

  const cleanString = (str) => {
    return String(str || '')
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Returns a clean gerencia string, or '' if the value is a number, date serial, or garbage
  const cleanGerencia = (val) => {
    if (val === null || val === undefined) return '';
    // Numbers (including Excel date serials) → empty
    if (typeof val === 'number') return '';
    const s = cleanString(String(val));
    // Looks like a date (DD/MM/YYYY, YYYY-MM-DD, etc.) → empty
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s)) return '';
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(s)) return '';
    // Pure number string → empty
    if (/^\d+$/.test(s)) return '';
    return s;
  };

  const parseDateString = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') {
      const d = new Date((v - 25569) * 86400 * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    const s = cleanString(String(v));
    if (!s || s === '-' || s === 'N/A' || s === 'n/a') return null;
    // DD/MM/YYYY or DD-MM-YYYY
    let m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
      const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY-MM-DD or YYYY/MM/DD
    m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m) {
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      if (!isNaN(d.getTime())) return d;
    }
    // DD/MM/YY or DD-MM-YY
    m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/);
    if (m) {
      const yr = parseInt(m[3]) >= 50 ? 1900 + parseInt(m[3]) : 2000 + parseInt(m[3]);
      const d = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]));
      if (!isNaN(d.getTime())) return d;
    }
    // Fallback: try native Date
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];


  const getFilterOptions = (field) => {
    let source = [];
    if (activeTab === 'trend') source = data?.trend || [];
    else if (activeTab === 'portfolio') source = data?.portfolio || [];
    else if (activeTab === 'demand') source = data?.demand || [];
    else if (activeTab === 'weekly') source = data?.weekly || [];
    else if (activeTab === 'demand2') source = demand2Data?.schedule || [];

    if (activeTab === 'demand2' && (field === 'indicador' || field === 'gestor')) {
      const grouped = new Map();
      source.forEach(i => {
        const raw = i[field];
        if (!raw) return;
        const normalized = normalizeForGrouping(raw);
        if (!grouped.has(normalized)) {
          grouped.set(normalized, raw); // Keep the first occurrence as the display value
        }
      });
      return [...grouped.values()].sort();
    }

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
        if (portfolioFilter.key === 'Gerencia Líder' && portfolioFilter.value === 'Otros') {
          // "Otros" means blank, null, number, or date in Gerencia Líder
          matchChart = !cleanGerencia(item['Gerencia Líder']);
        } else {
          matchChart = String(item[portfolioFilter.key] || '').includes(portfolioFilter.value);
        }
      }

      const projectNameStr = String(item['Nombre del Proyecto'] || '').toLowerCase().trim();
      const matchSearch = portfolioSearch === '' || projectNameStr.includes(portfolioSearch.toLowerCase());
      const isPrioritized = prioritizedProjectNames.has(projectNameStr);

      const matchColumnFilters = Object.entries(portfolioColumnFilters).every(([key, value]) => {
        if (!value || value === 'Todos') return true;
        if (key === 'Priorizado') {
          return value === 'Sí' ? isPrioritized : !isPrioritized;
        }
        if (key === 'Salud') {
          const healthLabel = getHealthColor(item).includes('bg-green') ? 'Excelente' : getHealthColor(item).includes('bg-yellow') ? 'En Riesgo' : 'Retraso';
          return healthLabel === value;
        }
        if (key === 'Nombre del Proyecto') {
          return String(item['Nombre del Proyecto'] || '').toLowerCase().includes(String(value).toLowerCase());
        }
        if (key === 'Gerencia Líder') {
          const g = cleanGerencia(item['Gerencia Líder']);
          if (value === 'Otros') return !g;
          return g === value;
        }
        return String(item[key] || '') === String(value);
      });

      return matchStatus && matchPortfolio && matchChart && matchSearch && matchColumnFilters;
    });
  }, [data, sidebarFilters, topPortfolio, portfolioColumnFilters, portfolioFilter, portfolioSearch]);

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
        if (demandFilter.key === 'Gerencia Líder' && demandFilter.value === 'Otras') {
          matchChart = !cleanGerencia(item['Gerencia Líder']);
        } else if (demandFilter.key === 'Gerencia Líder') {
          matchChart = cleanGerencia(item['Gerencia Líder']) === demandFilter.value;
        } else {
          matchChart = String(item[demandFilter.key] || '').includes(demandFilter.value);
        }
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
        if (key === 'Gerencia Líder') {
          const g = cleanGerencia(item['Gerencia Líder']);
          if (value === 'Otros') return !g;
          return g === value;
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
        if (!matchMgmt || !matchDimension || !matchPortfolio) return false;

        if (trendTypeFilter) {
          let type = t['Tipo de Proyecto'];
          if (type === "0" || type === 0) {
            type = "Otros (0)";
          } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
            type = "Por asignar";
          } else {
            type = String(type).trim();
          }
          if (type !== trendTypeFilter.type) return false;
        }

        if (trendSearch) {
          const projectNameStr = String(t['Proyecto'] || '').toLowerCase().trim();
          if (!projectNameStr.includes(trendSearch.toLowerCase().trim())) return false;
        }

        const matchTrendColumnFilters = Object.entries(trendColumnFilters).every(([key, value]) => {
          if (!value || value === 'Todos') return true;
          if (key === 'Tipo de Proyecto') {
            let type = t['Tipo de Proyecto'];
            if (type === "0" || type === 0) {
              type = "Otros (0)";
            } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
              type = "Por asignar";
            } else {
              type = String(type).trim();
            }
            return type === value;
          }

          if (value === 'Otros') {
            const strVal = String(t[key] || '').trim();
            return strVal === '' || strVal === '-' || strVal === '0';
          }

          return String(t[key] || '') === String(value);
        });

        if (!matchTrendColumnFilters) return false;

        return true;
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
      // For the year 2023, we use the specific '2023' key if it has valid data
      const planValues = projectsToInclude.map(p => tp === '2023' ? parseVal(p['2023']) : parseVal(p[`${tp} Plan`])).filter(v => v !== null);
      const execValues = projectsToInclude.map(p => parseVal(p[tp === '2023' ? '2023' : `${tp} Exec`])).filter(v => v !== null);

      return {
        month: tp.replace('%', '').trim(),
        plan: planValues.length > 0 ? parseFloat((planValues.reduce((a, b) => a + b, 0) / planValues.length).toFixed(2)) : null,
        exec: execValues.length > 0 ? parseFloat((execValues.reduce((a, b) => a + b, 0) / execValues.length).toFixed(2)) : null
      };
    }).filter(d => d.plan !== null || d.exec !== null);
  }, [selectedProjectName, sidebarFilters.management, sidebarFilters.dimension, topPortfolio, data?.trend, trendTypeFilter, trendSearch, trendColumnFilters]);

  const filteredDemand2 = useMemo(() => {
    // demand2Data is now { projects, schedule } - return schedule for the new dashboard
    return demand2Data?.schedule || [];
  }, [demand2Data]);

  const filteredWeekly = useMemo(() => {
    if (!data?.weekly) return [];
    return data.weekly.filter(item => {
      const matchMgmt = sidebarFilters.management === 'Todas' || item['Gerencia Líder'] === sidebarFilters.management;
      const matchDimension = sidebarFilters.dimension === 'Todas' || item['Dimensión'] === sidebarFilters.dimension;
      const matchPortfolio = topPortfolio === 'Todas' || item['Cartera'] === topPortfolio;
      const matchProject = !selectedProjectName || item['PROYECTO'] === selectedProjectName || item['Nombre del Proyecto'] === selectedProjectName;

      let matchChart = true;
      if (weeklyChartFilter) {
        if (weeklyChartFilter.key === 'Proyecto') {
          matchChart = String(item['PROYECTO'] || item['Nombre del Proyecto'] || '').includes(weeklyChartFilter.value);
        } else if (weeklyChartFilter.key === 'Estado') {
          // Match using same normalization as the chart
          const raw = item['Estado'] || '';
          const s = raw.trim().toLowerCase();
          let normalized;
          if (s.startsWith('finalizado') || s.startsWith('cerrado') || s.startsWith('terminado') || s.startsWith('implementado')) normalized = 'Finalizado';
          else if (s.startsWith('en proceso') || s.startsWith('en curso')) normalized = 'En Proceso';
          else if (s.startsWith('pendiente')) normalized = 'Pendiente';
          else if (s.startsWith('observado')) normalized = 'Observado';
          else if (s.startsWith('por definir')) normalized = 'Por Definir';
          else if (s.startsWith('bloqueado')) normalized = 'Bloqueado';
          else if (s.startsWith('cancelado') || s.startsWith('descartado')) normalized = 'Cancelado';
          else { const cut = raw.split(/\s*[-–—:()]\s*/)[0].trim(); normalized = cut.length <= 25 ? (cut.charAt(0).toUpperCase() + cut.slice(1)) : 'Otros'; }
          // When filter is 'Otros', match anything that normalized to 'Otros'
          matchChart = normalized === weeklyChartFilter.value;
        }
      }

      const matchWeeklyColumnFilters = Object.entries(weeklyColumnFilters).every(([key, value]) => {
        if (!value || value === 'Todos') return true;
        // Estado: normalize to category
        if (key === 'Estado') {
          return normalizeEstado(item[key]) === value;
        }
        // Responsable can be "Juan / Pedro" — match if any individual name matches
        if (key === 'Responsable') {
          const raw = cleanString(item['Responsable'] || item['LÍDER TÉCNICO'] || item['LIDER DEL PROYECTO'] || '');
          const names = raw.split('/').map(n => n.trim()).filter(Boolean);
          return names.some(n => normalizeForGrouping(n) === normalizeForGrouping(value));
        }
        // Date columns: match by month-year (or just month), text keywords, or "Otros"
        if (key === 'Fecha Compromiso2' || key === 'FECHA COMPROMISO' || key.includes('Fecha Compromiso') || key.includes('FECHA')) {
          const raw = item['Fecha Compromiso2'] || item['FECHA COMPROMISO'] || item[key];
          const s = cleanString(String(raw || '')).toLowerCase();
          // Text-based categories
          if (value === 'Por Definir') {
            return s.includes('por definir') || s.includes('por confirmar') || s.includes('pendiente fecha') || s.includes('sin definir');
          }
          if (value === 'Finalizado') {
            return s.includes('finalizado') || s.includes('cerrado') || s.includes('terminado') || s.includes('completado');
          }
          if (value === 'Otros') {
            if (!raw || s === '' || s === '-' || s === 'n/a' || s === 'na') return true;
            // Not a recognized category and not a parseable date
            if (!s.includes('por definir') && !s.includes('por confirmar') && !s.includes('pendiente fecha') && !s.includes('sin definir') && !s.includes('finalizado') && !s.includes('cerrado') && !s.includes('terminado') && !s.includes('completado')) {
              const d = parseDateString(raw);
              return d === null;
            }
            return false;
          }
          // Month-Year or Month-only match: e.g. "Sep-2025" or "Sep"
          const d = parseDateString(raw);
          if (!d) return false;
          // Parse the filter value
          const monthMatch = value.match(/^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)(?:-(\d{4}))?$/);
          if (!monthMatch) return false;
          const targetMonth = MONTH_NAMES_SHORT.indexOf(monthMatch[1]);
          const targetYear = monthMatch[2] ? parseInt(monthMatch[2]) : null;
          const itemMonth = d.getMonth();
          const itemYear = d.getFullYear();
          return itemMonth === targetMonth && (targetYear === null || itemYear === targetYear);
        }
        const strVal = String(item[key] || '').trim();
        if (value === 'Otros') {
          return strVal === '' || strVal === '-' || strVal === '0';
        }
        return normalizeForGrouping(strVal) === normalizeForGrouping(String(value));
      });

      return matchMgmt && matchDimension && matchPortfolio && matchProject && matchChart && matchWeeklyColumnFilters;
    });
  }, [data, sidebarFilters.management, sidebarFilters.dimension, topPortfolio, selectedProjectName, weeklyChartFilter, weeklyColumnFilters]);

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

      if (trendTypeFilter) {
        let type = t['Tipo de Proyecto'];
        if (type === "0" || type === 0) {
          type = "Otros (0)";
        } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
          type = "Por asignar";
        } else {
          type = String(type).trim();
        }
        if (type !== trendTypeFilter.type) return false;
      }

      if (trendSearch) {
        const projectNameStr = String(t['Proyecto'] || '').toLowerCase().trim();
        if (!projectNameStr.includes(trendSearch.toLowerCase().trim())) return false;
      }

      const matchTrendColumnFilters = Object.entries(trendColumnFilters).every(([key, value]) => {
        if (!value || value === 'Todos') return true;
        if (key === 'Tipo de Proyecto') {
          let type = t['Tipo de Proyecto'];
          if (type === "0" || type === 0) {
            type = "Otros (0)";
          } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
            type = "Por asignar";
          } else {
            type = String(type).trim();
          }
          return type === value;
        }

        if (value === 'Otros') {
          const strVal = String(t[key] || '').trim();
          return strVal === '' || strVal === '-' || strVal === '0';
        }

        return String(t[key] || '') === String(value);
      });

      if (!matchTrendColumnFilters) return false;

      return true;
    });

    const total = filteredTrend.length;
    const typeCounts = {};

    // Initialize counts for specific statuses to ensure they always show
    const statusLabels = ['01. No Iniciado', '02. En Curso', '03. Implementado', '04. Cerrado', '05. Descartado'];
    statusLabels.forEach(label => counts[label] = 0);

    filteredTrend.forEach(t => {
      let s = t['Estado'] || 'Sin Estado';
      // Normalize status to match specific labels
      if (s.toLowerCase().includes('no iniciado') || s.toLowerCase().includes('01')) {
        s = '01. No Iniciado';
      } else if (s.toLowerCase().includes('en curso') || s.toLowerCase().includes('02') || s.toLowerCase().includes('ejecución')) {
        s = '02. En Curso';
      } else if (s.toLowerCase().includes('implementado') || s.toLowerCase().includes('03')) {
        s = '03. Implementado';
      } else if (s.toLowerCase().includes('cerrado') || s.toLowerCase().includes('04') || s.toLowerCase().includes('finalizado')) {
        s = '04. Cerrado';
      } else if (s.toLowerCase().includes('descartado') || s.toLowerCase().includes('05')) {
        s = '05. Descartado';
      }

      counts[s] = (counts[s] || 0) + 1;

      let type = t['Tipo de Proyecto'];
      // Normalize type according to user requirements and image
      if (type === "0" || type === 0) {
        type = "Otros (0)"; // As requested: "Los que tienen como tipo de proyecto '0', consideralo como 'Otros'"
      } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
        type = "Por asignar"; // As seen in image for unassigned/empty
      } else {
        type = String(type).trim();
      }
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    return { total, counts, typeCounts };
  }, [data?.trend, selectedProjectName, trendFilter, trendTypeFilter, sidebarFilters.management, sidebarFilters.dimension, topPortfolio, trendSearch, trendColumnFilters]);

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
        {(demandFilter || tableSearch || Object.values(tableColumnFilters).some(v => v && v !== 'Todos')) && (
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
                      let mgmt = cleanGerencia(d['Gerencia Líder']) || 'Otras';
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
                Tipo de Requerimiento por Gerencia
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
                      const mgmt = cleanGerencia(d['Gerencia Líder']) || 'Otras';
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
                        <td className="px-4 py-3 text-gray-600 truncate">{cleanGerencia(d['Gerencia Líder'])}</td>
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
      </div>
    );
  };

  const renderDemand2Dashboard = () => {
    const indicadorInfo = (ind) => {
      const s = String(ind || '').toLowerCase();
      if (s.includes('riesgo')) return { dot: '#f97316', badge: 'bg-orange-100 text-orange-700 border-orange-300', label: 'EN RIESGO' };
      if (s.includes('atrasado') || s.includes('atraso')) return { dot: '#ef4444', badge: 'bg-red-100 text-red-700 border-red-300', label: 'ATRASADO' };
      if (s.includes('finalizado') || s.includes('completado')) return { dot: '#3b82f6', badge: 'bg-blue-100 text-blue-700 border-blue-300', label: 'FINALIZADO' };
      if (s.includes('no iniciado')) return { dot: '#9ca3af', badge: 'bg-gray-100 text-gray-600 border-gray-300', label: 'NO INICIADO' };
      return { dot: '#22c55e', badge: 'bg-green-100 text-green-700 border-green-300', label: 'EN CURSO' };
    };

    const fullSchedule = demand2Data?.schedule || [];
    const schedule = fullSchedule.filter(p => {
      const matchGerencia = demand2GerenciaFilter ? (p.gerencia || 'Sin Gerencia') === demand2GerenciaFilter : true;
      const matchGestor = demand2GestorFilter ? normalizeForGrouping(p.gestor || 'Sin Gestor') === normalizeForGrouping(demand2GestorFilter) : true;
      const matchIndicador = demand2IndicadorFilter ? normalizeForGrouping(p.indicador) === normalizeForGrouping(demand2IndicadorFilter) : true;
      return matchGerencia && matchGestor && matchIndicador;
    });

    const ganttColsRaw = demand2Data?.ganttCols || [];

    // Derive gantt cols from schedule if not stored separately
    const allGanttCols = (() => {
      if (ganttColsRaw.length > 0) return ganttColsRaw;
      const cols = [];
      const seen = new Set();
      // Try to get from first project's ganttData (legacy)
      schedule.forEach(p => {
        (p.ganttData || []).forEach(g => {
          const key = `${g.year}-${g.month}`;
          if (!seen.has(key)) { seen.add(key); cols.push({ year: g.year, month: g.month, label: g.label }); }
        });
      });
      return cols.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    })();

    // REPLACE_MARKER_END

    if (!schedule.length) {
      return (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-xl shadow-sm border border-gray-100 mt-10">
          <FolderOpen className="w-16 h-16 text-gray-200 mb-4" />
          <p className="text-gray-400 text-lg font-medium">No hay datos en Demanda Estrat&#233;gica.</p>
          <p className="text-gray-300 text-sm mt-1">Sube el archivo .xlsm con la hoja "Demanda Estrat&#233;gica".</p>
        </div>
      );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const toNum = (v) => {
      if (v === null || v === undefined) return null;
      const n = typeof v === 'number' ? v : parseFloat(v);
      return isNaN(n) ? null : n;
    };

    const pctStr = (v) => {
      const n = toNum(v);
      if (n === null) return '-';
      const pct = n <= 1.01 ? n * 100 : n;
      return `${pct.toFixed(0)}%`;
    };

    // ── Gantt color logic ─────────────────────────────────────────────────────
    // For a given row (project/etapa/actividad) and a month column,
    // return the background color:
    //   - transparent: outside date range
    //   - gray (#d1d5db): within range, not yet reached by plan
    //   - light green (#86efac): within range, reached by plan %
    //   - dark green (#15803d): within range, reached by exec %
    const ganttColor = (row, colYear, colMonth) => {
      const { fechaInicio, fechaFin, planPct, execPct } = row;
      if (!fechaInicio || !fechaFin) return null;

      // Use the 1st of the month for start comparison, last day for end
      const colStart = new Date(colYear, colMonth, 1);
      const colEnd = new Date(colYear, colMonth + 1, 0); // last day of month

      const start = new Date(fechaInicio);
      const end = new Date(fechaFin);

      // No overlap
      if (colEnd < start || colStart > end) return null;

      // Within range: compute what fraction of the total timeline this month's midpoint represents
      const mid = new Date(colYear, colMonth, 15);
      const totalMs = end.getTime() - start.getTime();
      const elapsedMs = mid.getTime() - start.getTime();
      const frac = totalMs > 0 ? Math.max(0, Math.min(1, elapsedMs / totalMs)) : 0;

      const plan = toNum(planPct);
      const exec = toNum(execPct);
      const planF = plan !== null ? (plan <= 1.01 ? plan : plan / 100) : null;
      const execF = exec !== null ? (exec <= 1.01 ? exec : exec / 100) : null;

      // Dark green: execution has covered up to this point
      if (execF !== null && frac <= execF) return '#15803d';
      // Light green: plan has covered up to this point
      if (planF !== null && frac <= planF) return '#86efac';
      // Gray: within range but not yet reached
      return '#d1d5db';
    };

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalProjects = schedule.length;
    const enCurso = schedule.filter(p => /en curso/i.test(p.indicador)).length;
    const enRiesgo = schedule.filter(p => /en riesgo/i.test(p.indicador)).length;
    const atrasado = schedule.filter(p => /atrasado/i.test(p.indicador)).length;
    const finalizado = schedule.filter(p => /finalizado/i.test(p.indicador)).length;

    const validPlan = schedule.filter(p => toNum(p.planPct) !== null);
    const validExec = schedule.filter(p => toNum(p.execPct) !== null);
    const avgPlan = validPlan.length
      ? validPlan.reduce((a, p) => { const n = toNum(p.planPct); return a + (n <= 1.01 ? n * 100 : n); }, 0) / validPlan.length
      : 0;
    const avgExec = validExec.length
      ? validExec.reduce((a, p) => { const n = toNum(p.execPct); return a + (n <= 1.01 ? n * 100 : n); }, 0) / validExec.length
      : 0;

    // ── Chart data ────────────────────────────────────────────────────────────
    const avanceData = schedule.map(p => {
      const plan = toNum(p.planPct);
      const exec = toNum(p.execPct);
      return {
        name: p.nombre.length > 24 ? p.nombre.substring(0, 22) + '\u2026' : p.nombre,
        fullName: p.nombre,
        planificado: plan !== null ? (plan <= 1.01 ? Math.round(plan * 100) : Math.round(plan)) : 0,
        completado: exec !== null ? (exec <= 1.01 ? Math.round(exec * 100) : Math.round(exec)) : 0,
        indicador: p.indicador,
      };
    });

    const gerMap = {};
    // The chart MUST be filtered so it reflects the click.
    schedule.forEach(p => {
      const g = p.gerencia || 'Sin Gerencia';
      if (!gerMap[g]) gerMap[g] = { plan: [], exec: [] };
      const plan = toNum(p.planPct); const exec = toNum(p.execPct);
      if (plan !== null) gerMap[g].plan.push(plan <= 1.01 ? plan * 100 : plan);
      if (exec !== null) gerMap[g].exec.push(exec <= 1.01 ? exec * 100 : exec);
    });
    const gerData = Object.entries(gerMap).map(([name, v]) => ({
      name: name.length > 20 ? name.substring(0, 18) + '\u2026' : name,
      fullName: name,
      planificado: v.plan.length ? Math.round(v.plan.reduce((a, b) => a + b, 0) / v.plan.length) : 0,
      completado: v.exec.length ? Math.round(v.exec.reduce((a, b) => a + b, 0) / v.exec.length) : 0,
    }));

    // ── Gantt month groups by year ────────────────────────────────────────────
    const yearGroups = {};
    allGanttCols.forEach(col => {
      if (!yearGroups[col.year]) yearGroups[col.year] = [];
      yearGroups[col.year].push(col);
    });
    const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // ── Expand/collapse state (per project index) ─────────────────────────────
    // We use a local state via useRef trick — but since we're inside render,
    // we'll use the existing expandedProjects state if available, else manage via useState
    // We'll use a simple approach: store in component state via a ref-based set
    // Actually we need to use React state — we'll add it as a local variable using
    // the existing pattern. We'll use expandedDE state (added below).

    const clearFilters = () => {
      setDemand2GerenciaFilter(null);
      setDemand2IndicadorFilter(null);
      setDemand2GestorFilter(null);
    };

    return (
      <div className="space-y-5 pb-10">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Demanda Estrat&#233;gica</h2>
            <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-widest">Cronograma y Avance de Proyectos</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-3 rounded" style={{ backgroundColor: '#d1d5db' }} />
              <span className="text-gray-500">Rango planificado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-3 rounded" style={{ backgroundColor: '#86efac' }} />
              <span className="text-gray-500">% Avance planificado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-3 rounded" style={{ backgroundColor: '#15803d' }} />
              <span className="text-gray-500">% Avance completado</span>
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Proyectos', value: totalProjects, color: '#1e3a5f', bg: '#f8fafc' },
            { label: 'En Curso', value: enCurso, color: '#15803d', bg: '#f0fdf4' },
            { label: 'En Riesgo', value: enRiesgo, color: '#c2410c', bg: '#fff7ed' },
            { label: 'Atrasado', value: atrasado, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Finalizado', value: finalizado, color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'Plan Prom.', value: `${avgPlan.toFixed(0)}%`, color: '#1e3a5f', bg: '#f8fafc' },
            { label: 'Real Prom.', value: `${avgExec.toFixed(0)}%`, color: '#15803d', bg: '#f0fdf4' },
          ].map((k, i) => (
            <div key={i} className="rounded-xl p-3 text-center shadow-sm border border-gray-200" style={{ backgroundColor: k.bg }}>
              <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[9px] uppercase font-bold mt-1" style={{ color: '#6b7280' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest flex items-center gap-2">
              <BarChart2 className="w-4 h-4" style={{ color: '#1e3a5f' }} />
              % Avance por Proyecto
            </h3>
            <div style={{ height: Math.max(180, avanceData.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={avanceData} margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={9} />
                  <YAxis dataKey="name" type="category" width={150} fontSize={9} fontWeight={600} tick={{ fill: '#374151' }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const ic = indicadorInfo(d.indicador);
                      const dev = d.completado - d.planificado;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs">
                          <p className="font-bold text-gray-800 mb-1 leading-tight">{d.fullName}</p>
                          <span className={cn("inline-block px-2 py-0.5 rounded text-[9px] font-bold border mb-2", ic.badge)}>{ic.label}</span>
                          <div className="space-y-0.5">
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Planificado:</span><span className="font-bold" style={{ color: '#1e3a5f' }}>{d.planificado}%</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Completado:</span><span className="font-bold" style={{ color: '#15803d' }}>{d.completado}%</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Desviaci&#243;n:</span><span className="font-bold" style={{ color: dev >= 0 ? '#16a34a' : '#dc2626' }}>{dev > 0 ? '+' : ''}{dev}%</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Bar dataKey="planificado" name="% Planificado" fill="#93c5fd" radius={[0, 3, 3, 0]} barSize={10} />
                  <Bar dataKey="completado" name="% Completado" fill="#15803d" radius={[0, 3, 3, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase text-gray-500 mb-4 tracking-widest flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: '#1e3a5f' }} />
                % Avance Promedio por Gerencia
              </div>
            </h3>
            <div style={{ height: Math.max(180, gerData.length * 52) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={gerData}
                  margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
                  barCategoryGap="30%"
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      const clickedGerencia = e.activePayload[0].payload.fullName;
                      setDemand2GerenciaFilter(prev => prev === clickedGerencia ? null : clickedGerencia);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={9} />
                  <YAxis dataKey="name" type="category" width={150} fontSize={9} fontWeight={600} tick={{ fill: '#374151' }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                          <p className="font-bold text-gray-800 mb-2">{d.fullName}</p>
                          <div className="space-y-0.5">
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Plan prom.:</span><span className="font-bold" style={{ color: '#1e3a5f' }}>{d.planificado}%</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Real prom.:</span><span className="font-bold" style={{ color: '#15803d' }}>{d.completado}%</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  <Bar dataKey="planificado" name="% Planificado" fill="#93c5fd" radius={[0, 3, 3, 0]} barSize={14} />
                  <Bar dataKey="completado" name="% Completado" fill="#15803d" radius={[0, 3, 3, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Gantt Cronograma ── */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase text-gray-600 tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: '#1e3a5f' }} />
              CRONOGRAMA DE PROYECTOS Y ETAPAS
            </h3>
            <div className="text-[9px] text-gray-400 font-bold">
              {schedule.length} proyectos &middot; {schedule.reduce((a, p) => a + p.etapas.length, 0)} etapas
            </div>
          </div>

          <GanttTable schedule={schedule} allGanttCols={allGanttCols} yearGroups={yearGroups} MONTH_ABBR={MONTH_ABBR} ganttColor={ganttColor} pctStr={pctStr} indicadorInfo={indicadorInfo} />
        </div>
      </div>
    );
  };


  const renderPortfolioDashboard = () => {
    const stats = calculatePortfolioStats(filteredPortfolio);

    // Get unique values for charts
    const managementData = (() => {
      const counts = {};
      filteredPortfolio.forEach(p => {
        const g = cleanGerencia(p['Gerencia Líder']);
        const key = g || 'Otros';
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    })();

    const avgProgressData = [
      {
        name: 'Planificado',
        value: filteredPortfolio.length > 0
          ? parseFloat(((filteredPortfolio.reduce((acc, p) => acc + (parseFloat(p['% Avance Planificado']) || 0), 0) / filteredPortfolio.length) * 100).toFixed(1))
          : 0,
        fill: '#1e3a5f'
      },
      {
        name: 'Ejecutado',
        value: filteredPortfolio.length > 0
          ? parseFloat(((filteredPortfolio.reduce((acc, p) => acc + (parseFloat(p['% Avance ejecutado']) || 0), 0) / filteredPortfolio.length) * 100).toFixed(1))
          : 0,
        fill: '#a5000d'
      }
    ];

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
                    <span className="font-bold uppercase text-[10px]">{getHealthColor(selectedProject).includes('bg-green') ? 'Excelente' : getHealthColor(selectedProject).includes('bg-yellow') ? 'En Riesgo' : 'Retraso'}</span>
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
            {(portfolioFilter || portfolioSearch || Object.values(portfolioColumnFilters).some(v => v && v !== 'Todos')) && (
              <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 md:col-span-full mb-4">
                <Filter className="w-4 h-4 text-blue-600 shrink-0" />
                {portfolioFilter && (
                  <div className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                    <span className="text-blue-400 mr-1 uppercase">{portfolioFilter.key}:</span>
                    <span className="uppercase">{portfolioFilter.value}</span>
                    <button onClick={() => setPortfolioFilter(null)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {Object.entries(portfolioColumnFilters).map(([key, value]) => {
                  if (!value || value === 'Todos') return null;
                  return (
                    <div key={key} className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                      <span className="text-blue-400 mr-1 uppercase">{key}:</span>
                      <span className="uppercase">{value}</span>
                      <button
                        onClick={() => setPortfolioColumnFilters(prev => {
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

                {portfolioSearch && (
                  <div className="flex items-center bg-white border border-blue-100 rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                    <span className="text-blue-400 mr-1 uppercase">Búsqueda:</span>
                    <span className="uppercase">{portfolioSearch}</span>
                    <button onClick={() => setPortfolioSearch('')} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setPortfolioFilter(null);
                    setPortfolioSearch('');
                    setPortfolioColumnFilters({});
                  }}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline ml-2"
                >
                  Limpiar todo
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICard label="Total Proyectos" value={stats.total} />
              <KPICard label="En Curso" value={stats.enEjecucion} colorClass="text-blue-600" />
              <KPICard label="Implementado" value={stats.implementado} colorClass="text-green-600" />
              <KPICard label="No Iniciado" value={stats.noIniciado} colorClass="text-gray-500" />
              <KPICard label="Cerrado" value={stats.cerrado} colorClass="text-purple-600" />
              <KPICard label="Descartado" value={stats.descartado} colorClass="text-red-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 border border-gray-200 rounded shadow-sm relative">
                <div className="absolute top-4 right-4 bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold text-gray-500">
                  TOTAL: {managementData.reduce((a, d) => a + d.value, 0)}
                </div>
                <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Proyectos por Gerencia Líder</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={managementData}
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
                  TOTAL: {filteredPortfolio.length} PROYECTOS
                </div>
                <h3 className="text-xs font-bold uppercase text-gray-500 mb-6 tracking-widest">Promedio de Avance (Plan vs Real)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={avgProgressData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis domain={[0, 100]} fontSize={10} unit="%" />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        formatter={(value) => [`${value}%`, 'Avance Promedio']}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[10px] font-bold uppercase text-gray-600 tracking-wider">Portafolio P&D - Vista Planeamiento</h3>
                  <span className="text-[9px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold w-fit">{filteredPortfolio.length} proyectos</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar proyecto..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={portfolioSearch}
                      onChange={(e) => setPortfolioSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={portfolioColumnFilters['Priorizado'] || 'Todos'}
                    onChange={(e) => setPortfolioColumnFilters(prev => ({ ...prev, 'Priorizado': e.target.value }))}
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
                      <th className="px-4 py-3 w-64 group relative">
                        <div className="flex items-center justify-between">
                          <span>Proyecto</span>
                          <button onClick={(e) => handleFilterClick('Nombre del Proyecto', e, true)} className={cn(
                            "p-0.5 rounded hover:bg-gray-200 transition-colors",
                            portfolioColumnFilters['Nombre del Proyecto'] ? "text-blue-600" : "text-gray-400"
                          )}>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-3 w-40 group relative">
                        <div className="flex items-center justify-between">
                          <span>Gerencia Líder</span>
                          <button onClick={(e) => handleFilterClick('Gerencia Líder', e, true)} className={cn(
                            "p-0.5 rounded hover:bg-gray-200 transition-colors",
                            portfolioColumnFilters['Gerencia Líder'] ? "text-blue-600" : "text-gray-400"
                          )}>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-3 w-32 group relative">
                        <div className="flex items-center justify-between">
                          <span>Estado</span>
                          <button onClick={(e) => handleFilterClick('Estado', e, true)} className={cn(
                            "p-0.5 rounded hover:bg-gray-200 transition-colors",
                            portfolioColumnFilters['Estado'] ? "text-blue-600" : "text-gray-400"
                          )}>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-4 py-3 w-28 group relative">
                        <div className="flex items-center justify-between">
                          <span>Salud</span>
                          <button onClick={(e) => handleFilterClick('Salud', e, true)} className={cn(
                            "p-0.5 rounded hover:bg-gray-200 transition-colors",
                            portfolioColumnFilters['Salud'] ? "text-blue-600" : "text-gray-400"
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

                      return filteredPortfolio.map((p, i) => {
                        const isPrioritized = prioritizedProjectNames.has(String(p['Nombre del Proyecto'] || '').toLowerCase().trim());
                        const projectHealthLabel = getHealthColor(p).includes('bg-green') ? 'Excelente' : getHealthColor(p).includes('bg-yellow') ? 'En Riesgo' : 'Retraso';
                        const projectHealthEmoji = getHealthColor(p).includes('bg-green') ? '🟢' : getHealthColor(p).includes('bg-yellow') ? '🟡' : '🔴';
                        const projectHealthColor = getHealthColor(p).includes('bg-green') ? 'text-green-600' : getHealthColor(p).includes('bg-yellow') ? 'text-amber-600' : 'text-red-600';

                        return (
                          <tr key={i} className={cn(
                            "hover:bg-gray-50 transition-colors cursor-pointer border-l-4",
                            isPrioritized ? "bg-amber-50/70 border-l-amber-400" : "border-l-transparent"
                          )}
                            onClick={() => setSelectedProjectName(p['Nombre del Proyecto'])}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isPrioritized && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
                                <div className={cn(
                                  "font-bold leading-tight line-clamp-2",
                                  isPrioritized ? "text-amber-900" : "text-gray-800"
                                )}>
                                  {p['Nombre del Proyecto']}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 truncate">{cleanGerencia(p['Gerencia Líder'])}</td>
                            <td className="px-4 py-3">
                              <div className="max-w-fit">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border block truncate",
                                  (p['Estado'] || '').toLowerCase().includes('finalizado') || (p['Estado'] || '').toLowerCase().includes('cerrado') ? "bg-green-50 text-green-700 border-green-100" :
                                    (p['Estado'] || '').toLowerCase().includes('desarrollo') || (p['Estado'] || '').toLowerCase().includes('ejecución') || (p['Estado'] || '').toLowerCase().includes('curso') ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-600 border-gray-100"
                                )} title={p['Estado']}>{p['Estado'] || 'Sin Estado'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={cn(
                                "font-bold text-[9px]",
                                projectHealthColor
                              )}>{projectHealthEmoji} {projectHealthLabel}</span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="font-bold text-gray-700">{formatPercent(p['% Avance Planificado'])}</div>
                              <div className="text-blue-600 font-bold">{formatPercent(p['% Avance ejecutado'])}</div>
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
        {/* Top KPIs */}
        {(selectedProjectName || trendFilter || trendTypeFilter || Object.values(trendColumnFilters).some(v => v && v !== 'Todos')) && (
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
            {trendTypeFilter && (
              <div className="flex items-center gap-2 bg-corporate-dark text-white px-3 py-1 rounded-full text-xs font-bold">
                <span>Tipo: {trendTypeFilter.type}</span>
                <button onClick={() => setTrendTypeFilter(null)} className="hover:text-red-300"><X className="w-3 h-3" /></button>
              </div>
            )}
            {Object.entries(trendColumnFilters).map(([key, value]) => {
              if (!value || value === 'Todos') return null;
              return (
                <div key={key} className="flex items-center gap-2 bg-corporate-dark text-white px-3 py-1 rounded-full text-xs font-bold">
                  <span>{key}: {value}</span>
                  <button onClick={() => setTrendColumnFilters(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  })} className="hover:text-red-300"><X className="w-3 h-3" /></button>
                </div>
              );
            })}
            <button
              onClick={() => {
                setSelectedProjectName(null);
                setTrendFilter(null);
                setTrendTypeFilter(null);
                setTrendColumnFilters({});
              }}
              className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase underline ml-auto"
            >
              Limpiar Todo
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
          })() : (
            <>
              <KPICard label="01. No Iniciado" value={trendStats.counts['01. No Iniciado'] || 0} colorClass="text-gray-600" />
              <KPICard label="02. En Curso" value={trendStats.counts['02. En Curso'] || 0} colorClass="text-blue-600" />
              <KPICard label="03. Implementado" value={trendStats.counts['03. Implementado'] || 0} colorClass="text-green-600" />
              <KPICard label="04. Cerrado" value={trendStats.counts['04. Cerrado'] || 0} colorClass="text-purple-600" />
              <KPICard label="05. Descartado" value={trendStats.counts['05. Descartado'] || 0} colorClass="text-red-600" />
            </>
          )}
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
              Proyectos por Tipo
            </h3>
            <div className="h-[400px]">
              {Object.keys(trendStats.typeCounts || {}).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(trendStats.typeCounts).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      onClick={(data) => {
                        if (data && data.name) {
                          if (trendTypeFilter?.type === data.name) {
                            setTrendTypeFilter(null);
                          } else {
                            setTrendTypeFilter({ type: data.name });
                          }
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {Object.keys(trendStats.typeCounts).map((entry, index) => (
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
                    <th className="px-6 py-3 group relative">
                      <div className="flex items-center justify-between">
                        <span>Proyecto</span>
                        <button onClick={(e) => handleFilterClick('Proyecto', e, false, true)} className={cn(
                          "p-0.5 rounded hover:bg-gray-200 transition-colors",
                          trendColumnFilters['Proyecto'] ? "text-blue-600" : "text-gray-400"
                        )}>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    <th className="px-6 py-3 group relative">
                      <div className="flex items-center justify-between">
                        <span>Dimensión</span>
                        <button onClick={(e) => handleFilterClick('Dimensión', e, false, true)} className={cn(
                          "p-0.5 rounded hover:bg-gray-200 transition-colors",
                          trendColumnFilters['Dimensión'] ? "text-blue-600" : "text-gray-400"
                        )}>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                    <th className="px-6 py-3 group relative">
                      <div className="flex items-center justify-between">
                        <span>Estado</span>
                        <button onClick={(e) => handleFilterClick('Estado', e, false, true)} className={cn(
                          "p-0.5 rounded hover:bg-gray-200 transition-colors",
                          trendColumnFilters['Estado'] ? "text-blue-600" : "text-gray-400"
                        )}>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
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

                      if (trendTypeFilter) {
                        let type = t['Tipo de Proyecto'];
                        if (type === "0" || type === 0) {
                          type = "Otros (0)";
                        } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
                          type = "Por asignar";
                        } else {
                          type = String(type).trim();
                        }
                        if (type !== trendTypeFilter.type) return false;
                      }

                      const matchTrendColumnFilters = Object.entries(trendColumnFilters).every(([key, value]) => {
                        if (!value || value === 'Todos') return true;
                        if (key === 'Tipo de Proyecto') {
                          let type = t['Tipo de Proyecto'];
                          if (type === "0" || type === 0) {
                            type = "Otros (0)";
                          } else if (!type || String(type).trim() === "" || String(type).toLowerCase() === "null") {
                            type = "Por asignar";
                          } else {
                            type = String(type).trim();
                          }
                          return type === value;
                        }

                        if (value === 'Otros') {
                          const strVal = String(t[key] || '').trim();
                          return strVal === '' || strVal === '-' || strVal === '0';
                        }

                        return String(t[key] || '') === String(value);
                      });

                      if (!matchTrendColumnFilters) return false;

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
    const hasActiveFilters = (weeklyChartFilter || Object.values(weeklyColumnFilters).some(v => v && v !== 'Todos'));
    const activeFiltersUI = hasActiveFilters ? (
      <div className="flex flex-wrap gap-2 items-center bg-corporate-dark/5 p-3 rounded-lg border border-corporate-dark/10 mb-6">
        <span className="text-[10px] font-bold text-corporate-dark uppercase tracking-widest mr-2">Filtros Activos:</span>
        {weeklyChartFilter && (
          <div className="flex items-center gap-2 bg-corporate-dark text-white px-3 py-1 rounded-full text-xs font-bold">
            <span>{weeklyChartFilter.key}: {weeklyChartFilter.value}</span>
            <button onClick={() => setWeeklyChartFilter(null)} className="hover:text-red-300"><X className="w-3 h-3" /></button>
          </div>
        )}
        {Object.entries(weeklyColumnFilters).map(([key, value]) => {
          if (!value || value === 'Todos') return null;
          return (
            <div key={key} className="flex items-center gap-2 bg-corporate-dark text-white px-3 py-1 rounded-full text-xs font-bold">
              <span>{key}: {value}</span>
              <button onClick={() => setWeeklyColumnFilters(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
              })} className="hover:text-red-300"><X className="w-3 h-3" /></button>
            </div>
          );
        })}
        <button
          onClick={() => {
            setWeeklyChartFilter(null);
            setWeeklyColumnFilters({});
          }}
          className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase underline ml-auto"
        >
          Limpiar Todo
        </button>
      </div>
    ) : null;

    if (!filteredWeekly || filteredWeekly.length === 0) {
      return (
        <div className="space-y-6 animate-in fade-in ease-out duration-500">
          {activeFiltersUI}
          <div className="flex flex-col items-center justify-center p-20 bg-white rounded-xl shadow-sm border border-gray-100 mt-20">
            <FolderOpen className="w-16 h-16 text-gray-200 mb-4" />
            <p className="text-gray-400 text-lg font-medium">No hay datos en Seguimiento Semanal con los filtros actuales.</p>
          </div>
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
        fullName: name,
        value: filteredWeekly.filter(w => w['PROYECTO'] === name).length
      })).sort((a, b) => b.value - a.value).slice(0, 10);

    const estadosRawData = filteredWeekly.map(w => normalizeEstado(w['Estado']));

    const estadosMap = estadosRawData.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});
    const estadoData = Object.entries(estadosMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const COLORS_WEEKLY = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#f43f5e', '#8b5cf6', '#10b981', '#6b7280'];
    const getEstadoColor = (name) => {
      const s = (name || '').toLowerCase();
      if (s.includes('finalizado') || s.includes('cerrado')) return '#16a34a';
      if (s.includes('pendiente') || s.includes('atrasado')) return '#f59e0b';
      if (s.includes('proceso') || s.includes('curso')) return '#2563eb';
      if (s.includes('observado') || s.includes('subsanar')) return '#e11d48';
      if (s.includes('sin estado')) return '#9ca3af';
      return null;
    };

    return (
      <div className="space-y-6 animate-in fade-in ease-out duration-500">
        {/* Filter indicator */}
        {activeFiltersUI}

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
                <BarChart
                  data={proyectosData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  onClick={(data, index, event) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const clickedName = data.activePayload[0].payload.fullName;
                      if (weeklyChartFilter?.key === 'Proyecto' && weeklyChartFilter?.value === clickedName) {
                        setWeeklyChartFilter(null);
                      } else {
                        setWeeklyChartFilter({ key: 'Proyecto', value: clickedName });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={11} fontWeight={600} />
                  <YAxis dataKey="name" type="category" width={140} stroke="#4B5563" fontSize={10} fontWeight={600} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#F3F4F6' }}
                  />
                  <Bar dataKey="value" fill="#a5000d" radius={[0, 4, 4, 0]} barSize={20} className="cursor-pointer" />
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
                    onClick={(data, index, event) => {
                      if (data && data.name) {
                        if (weeklyChartFilter?.key === 'Estado' && weeklyChartFilter?.value === data.name) {
                          setWeeklyChartFilter(null);
                        } else {
                          setWeeklyChartFilter({ key: 'Estado', value: data.name });
                        }
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {estadoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getEstadoColor(entry.name) || COLORS_WEEKLY[index % COLORS_WEEKLY.length]} />
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
                  <th className="px-6 py-4 group relative min-w-[250px]">
                    <div className="flex items-center justify-between">
                      <span>Proyecto</span>
                      <button onClick={(e) => handleFilterClick('PROYECTO', e, false, false, true)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        weeklyColumnFilters['PROYECTO'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-6 py-4 group relative min-w-[350px]">
                    <div className="flex items-center justify-between">
                      <span>Pendiente</span>
                      <button onClick={(e) => handleFilterClick('Pendientes', e, false, false, true)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        weeklyColumnFilters['Pendientes'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-6 py-4 group relative min-w-[150px]">
                    <div className="flex items-center justify-between">
                      <span>Responsable / Líder</span>
                      <button onClick={(e) => handleFilterClick('Responsable', e, false, false, true)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        weeklyColumnFilters['Responsable'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-6 py-4 group relative min-w-[120px]">
                    <div className="flex items-center justify-between">
                      <span>F. Compromiso</span>
                      <button onClick={(e) => handleFilterClick('Fecha Compromiso2', e, false, false, true)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        weeklyColumnFilters['Fecha Compromiso2'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                  <th className="px-6 py-4 group relative min-w-[130px]">
                    <div className="flex items-center justify-between">
                      <span>Estado</span>
                      <button onClick={(e) => handleFilterClick('Estado', e, false, false, true)} className={cn(
                        "p-0.5 rounded hover:bg-gray-200 transition-colors",
                        weeklyColumnFilters['Estado'] ? "text-blue-600" : "text-gray-400"
                      )}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredWeekly.map((w, i) => {
                  const rawDate = w['Fecha Compromiso2'] || w['FECHA COMPROMISO'];
                  const d = parseDateString(rawDate);
                  let dateStr;
                  if (d) {
                    dateStr = d.toLocaleDateString('es-CL');
                  } else {
                    const s = cleanString(String(rawDate || '')).toLowerCase();
                    if (s.includes('por definir') || s.includes('por confirmar') || s.includes('pendiente fecha') || s.includes('sin definir')) dateStr = 'Por Definir';
                    else if (s.includes('finalizado') || s.includes('cerrado') || s.includes('terminado')) dateStr = 'Finalizado';
                    else dateStr = rawDate || 'N/A';
                  }
                  const estado = normalizeEstado(w['Estado']);
                  return (
                    <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-corporate-dark line-clamp-2 max-w-[200px]">{w['PROYECTO']}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-600 line-clamp-2 max-w-[300px]" title={w['Pendientes']}>{w['Pendientes'] || '-'}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{w['Responsable'] || w['LÍDER TÉCNICO'] || w['LIDER DEL PROYECTO'] || 'Sin asignar'}</td>
                      <td className="px-6 py-4 text-gray-500 font-semibold">{dateStr}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap",
                          estado === 'Finalizado' ? "bg-green-50 text-green-700 border-green-200"
                            : estado === 'Pendiente' || estado === 'Otros' ? "bg-orange-50 text-orange-700 border-orange-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {w['Estado'] || 'Sin estado'}
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard de Portafolio</h1>
          <p className="text-gray-500 text-sm mb-6">Cargue el Portafolio de Demanda Estratégica Excel para iniciar la visualización.</p>
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
          <div className="bg-white p-2 rounded flex items-center justify-center">
            <img src="https://www.fonafe.gob.pe/pw_content/empresas/17/Img/BancoNacion.png?946855555" alt="Banco de la Nación" className="h-6" />
          </div>
          <div className="flex flex-col">
            <div className="font-bold text-xl tracking-wide uppercase">Monitoreo y Control del Portafolio de Proyectos</div>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-xs font-medium flex flex-col items-end">
            <span className="opacity-70 uppercase tracking-widest">Fecha de Corte: {new Date().toLocaleDateString('es-CL')}</span>
            <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold mt-1">V1.2.0</div>
          </div>
          <div className="flex gap-2">
            <label className="bg-white text-[#a5000d] hover:bg-gray-100 px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
              <Upload className="w-4 h-4" />
              <span>SUBIR PORTAFOLIO DEMANDA ESTRATÉGICA </span>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
            <label className="bg-[#a5000d] border border-white hover:bg-white hover:text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
              <Upload className="w-4 h-4" />
              <span>SUBIR PORTAFOLIO DE DEMANDA TÁCTICA</span>
              <input type="file" accept=".xlsx, .xls, .xlsm" onChange={handleDemand2Upload} className="hidden" />
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
      </nav>

      {/* Filter Bar (Horizontal) */}
      {!showStrategicDetail && activeTab !== 'weekly' && (
        <div className="bg-white border-b border-gray-100 p-4 flex flex-wrap gap-4 items-center shrink-0 px-10">
          {activeTab === 'demand2' ? (
            <>
              <div className="flex items-center space-x-3">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Indicador:</span>
                <select
                  value={demand2IndicadorFilter || 'Todos'}
                  onChange={(e) => setDemand2IndicadorFilter(e.target.value === 'Todos' ? null : e.target.value)}
                  className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
                >
                  <option value="Todos">-- TODOS LOS INDICADORES --</option>
                  {getFilterOptions('indicador').map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              <div className="flex items-center space-x-3">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filtrar por Gestor:</span>
                <select
                  value={demand2GestorFilter || 'Todos'}
                  onChange={(e) => setDemand2GestorFilter(e.target.value === 'Todos' ? null : e.target.value)}
                  className="border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none bg-gray-50 hover:bg-white transition-all min-w-[250px]"
                >
                  <option value="Todos">-- TODOS LOS GESTORES --</option>
                  {getFilterOptions('gestor').map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          ) : activeTab === 'trend' ? (
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
          ) : activeTab === 'weekly' ? null : (
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
        <div className={activeTab === 'weekly' ? 'w-full' : 'max-w-[1600px] mx-auto'}>
          {activeTab === 'demand' && renderDemandDashboard()}
          {activeTab === 'portfolio' && renderPortfolioDashboard()}
          {activeTab === 'trend' && renderTrendDashboard()}
          {activeTab === 'weekly' && renderWeeklyDashboard()}
          {activeTab === 'demand2' && renderDemand2Dashboard()}
        </div>
      </main>

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
              if (activeFilterMenu.isPortfolio) {
                setPortfolioColumnFilters(prev => {
                  const next = { ...prev };
                  delete next[activeFilterMenu.key];
                  return next;
                });
              } else if (activeFilterMenu.isTrend) {
                setTrendColumnFilters(prev => {
                  const next = { ...prev };
                  delete next[activeFilterMenu.key];
                  return next;
                });
              } else if (activeFilterMenu.isWeekly) {
                setWeeklyColumnFilters(prev => {
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
                } else if (activeFilterMenu.isTrend) {
                  setTrendColumnFilters(prev => {
                    const next = { ...prev };
                    delete next[activeFilterMenu.key];
                    return next;
                  });
                } else if (activeFilterMenu.isWeekly) {
                  setWeeklyColumnFilters(prev => {
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
                  : activeFilterMenu.isTrend
                    ? (!trendColumnFilters[activeFilterMenu.key] || trendColumnFilters[activeFilterMenu.key] === 'Todos')
                    : activeFilterMenu.isWeekly
                      ? (!weeklyColumnFilters[activeFilterMenu.key] || weeklyColumnFilters[activeFilterMenu.key] === 'Todos')
                      : (!tableColumnFilters[activeFilterMenu.key] || tableColumnFilters[activeFilterMenu.key] === 'Todos')
                        ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"
              )}
            >
              <span>(Todos)</span>
            </button>
            {getUniqueValues(activeFilterMenu.key, activeFilterMenu.isPortfolio, activeFilterMenu.isTrend, activeFilterMenu.isWeekly).map((val, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (activeFilterMenu.isPortfolio) {
                    setPortfolioColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                  } else if (activeFilterMenu.isTrend) {
                    setTrendColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                  } else if (activeFilterMenu.isWeekly) {
                    setWeeklyColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                  } else {
                    setTableColumnFilters(prev => ({ ...prev, [activeFilterMenu.key]: val }));
                  }
                  setActiveFilterMenu(null);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors flex items-center justify-between",
                  (activeFilterMenu.isPortfolio ? portfolioColumnFilters[activeFilterMenu.key] : activeFilterMenu.isTrend ? trendColumnFilters[activeFilterMenu.key] : activeFilterMenu.isWeekly ? weeklyColumnFilters[activeFilterMenu.key] : tableColumnFilters[activeFilterMenu.key]) === val ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"
                )}
              >
                <span className="truncate">{val}</span>
                {(activeFilterMenu.isPortfolio ? portfolioColumnFilters[activeFilterMenu.key] : activeFilterMenu.isTrend ? trendColumnFilters[activeFilterMenu.key] : activeFilterMenu.isWeekly ? weeklyColumnFilters[activeFilterMenu.key] : tableColumnFilters[activeFilterMenu.key]) === val && <CheckCircle2 className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
