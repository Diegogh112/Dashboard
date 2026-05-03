import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, Info, AlignLeft } from 'lucide-react';

const ProgressBar = ({ value, color }) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div className="h-2 rounded-full" style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }}></div>
  </div>
);

const Badge = ({ text, type }) => {
  const colors = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[type] || colors.gray}`}>{text}</span>;
};

export default function DemandaView({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSoloPadres, setShowSoloPadres] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filtros
  const [filterGerencia, setFilterGerencia] = useState('');
  const [filterEstadoTI, setFilterEstadoTI] = useState('');
  const [filterEstadoProy, setFilterEstadoProy] = useState('');
  const [filterCartera, setFilterCartera] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterTrimestre, setFilterTrimestre] = useState('');

  // Opciones únicas
  const uniqueGerencias = useMemo(() => Array.from(new Set(data.map(d => d.gerencia))).filter(Boolean).sort(), [data]);
  const uniqueEstadosTI = useMemo(() => Array.from(new Set(data.map(d => d.estadoTI))).filter(Boolean).sort(), [data]);
  const uniqueEstadosProy = useMemo(() => Array.from(new Set(data.map(d => d.estadoProyTI))).filter(Boolean).sort(), [data]);
  const uniqueCarteras = useMemo(() => Array.from(new Set(data.map(d => d.cartera))).filter(Boolean).sort(), [data]);
  const uniqueTipos = useMemo(() => Array.from(new Set(data.map(d => d.tipo))).filter(Boolean).sort(), [data]);
  const uniqueTrimestres = useMemo(() => Array.from(new Set(data.map(d => d.trimestreFin))).filter(Boolean).sort(), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPadre = showSoloPadres ? !String(item.tipo).toLowerCase().includes('hijo') : true;
      const matchGerencia = filterGerencia === '' || item.gerencia === filterGerencia;
      const matchEstadoTI = filterEstadoTI === '' || item.estadoTI === filterEstadoTI;
      const matchEstadoProy = filterEstadoProy === '' || item.estadoProyTI === filterEstadoProy;
      const matchCartera = filterCartera === '' || item.cartera === filterCartera;
      const matchTipo = filterTipo === '' || item.tipo === filterTipo;
      const matchTrimestre = filterTrimestre === '' || item.trimestreFin === filterTrimestre;
      
      return matchSearch && matchPadre && matchGerencia && matchEstadoTI && matchEstadoProy && matchCartera && matchTipo && matchTrimestre;
    });
  }, [data, searchTerm, showSoloPadres, filterGerencia, filterEstadoTI, filterEstadoProy, filterCartera, filterTipo, filterTrimestre]);

  const estadoCounts = useMemo(() => {
    const counts = {};
    filteredData.forEach(d => {
      const e = d.estadoTI || 'No definido';
      counts[e] = (counts[e] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ Estado: k, Cantidad: counts[k] })).sort((a,b) => b.Cantidad - a.Cantidad);
  }, [filteredData]);

  const toggleRow = (id) => {
    if (expandedRow === id) setExpandedRow(null);
    else setExpandedRow(id);
  };

  const getAlertaColor = (dias) => {
    if (dias < 0) return 'bg-red-50';
    if (dias <= 30) return 'bg-yellow-50';
    return 'bg-white';
  };

  const getBadgeType = (dias) => {
    if (dias < 0) return 'red';
    if (dias <= 30) return 'yellow';
    return 'green';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-bn-dark mb-4">Requerimientos por Estado TI</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={estadoCounts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis dataKey="Estado" type="category" width={100} tick={{fontSize: 10}} />
                <RechartsTooltip />
                <Bar dataKey="Cantidad" fill="#1565C0" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="text-lg font-bold text-bn-dark">Detalle de Demandas ({filteredData.length})</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showSoloPadres} 
                    onChange={(e) => setShowSoloPadres(e.target.checked)}
                    className="rounded text-bn-primary focus:ring-bn-primary"
                  />
                  Solo Proyectos Padre
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            {/* Combo Boxes Demanda */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <select className="border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterGerencia} onChange={e => setFilterGerencia(e.target.value)}>
                <option value="">Todas las Gerencias</option>
                {uniqueGerencias.map((g, i) => <option key={i} value={g}>{g}</option>)}
              </select>
              <select className="border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterEstadoTI} onChange={e => setFilterEstadoTI(e.target.value)}>
                <option value="">Todos los Estados TI</option>
                {uniqueEstadosTI.map((e, i) => <option key={i} value={e}>{e}</option>)}
              </select>
              <select className="border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterEstadoProy} onChange={e => setFilterEstadoProy(e.target.value)}>
                <option value="">Todos los Estados Proy</option>
                {uniqueEstadosProy.map((e, i) => <option key={i} value={e}>{e}</option>)}
              </select>
              <select className="border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterCartera} onChange={e => setFilterCartera(e.target.value)}>
                <option value="">Todas las Carteras</option>
                {uniqueCarteras.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
              <select className="border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                <option value="">Todos los Tipos</option>
                {uniqueTipos.map((t, i) => <option key={i} value={t}>{t}</option>)}
              </select>
              <select className="border border-gray-300 rounded-md py-1 px-2 text-xs focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterTrimestre} onChange={e => setFilterTrimestre(e.target.value)}>
                <option value="">Todos los Trimestres</option>
                {uniqueTrimestres.map((t, i) => <option key={i} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-200 relative">
              <thead className="bg-bn-dark text-white sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase w-1/3">Proyecto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Gerencia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Estado TI</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase">Días Falt.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((row, idx) => (
                  <React.Fragment key={idx}>
                    <tr className={`cursor-pointer hover:bg-blue-50 ${getAlertaColor(row.diasFaltantes)}`} onClick={() => toggleRow(row.id)}>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{row.id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="line-clamp-2" title={row.nombre}>{row.nombre}</div>
                        <div className="text-xs text-gray-500 mt-1">{row.tipo}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{row.gerencia}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <Badge text={row.estadoTI} type={row.estadoTI.includes('Finalizada') || row.estadoTI.includes('Certificado') ? 'green' : 'blue'} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge text={`${row.diasFaltantes} d`} type={getBadgeType(row.diasFaltantes)} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-right">
                        <Info size={18} />
                      </td>
                    </tr>
                    
                    {expandedRow === row.id && (
                      <tr>
                        <td colSpan="6" className="px-0 py-0 border-b border-gray-200">
                          <div className="bg-gray-50 p-4 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-bold text-bn-dark mb-2 flex items-center gap-2"><AlignLeft size={16}/> Notas de Seguimiento</h4>
                              <div className="bg-white p-3 rounded border border-gray-200 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar text-gray-700">
                                {row.notas || 'No hay notas de seguimiento registradas.'}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs text-gray-500 font-semibold uppercase">Líder Técnico / Proveedor</p>
                                <p className="text-sm text-gray-800">{row.liderTecnico || '-'} / {row.proveedor || '-'}</p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs text-gray-500 font-semibold uppercase">Trimestre Fin</p>
                                <p className="text-sm text-gray-800">{row.trimestreFin || '-'}</p>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs text-gray-500 font-semibold uppercase">Avance (Plan vs Ejec)</p>
                                <div className="mt-1">
                                  <div className="flex justify-between text-xs mb-1"><span>Plan: {row.avancePlan.toFixed(0)}%</span></div>
                                  <ProgressBar value={row.avancePlan} color="#1565C0" />
                                  <div className="flex justify-between text-xs mt-2 mb-1"><span>Ejec: {row.avanceEjec.toFixed(0)}%</span></div>
                                  <ProgressBar value={row.avanceEjec} color="#F57C00" />
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-xs text-gray-500 font-semibold uppercase">Alerta</p>
                                <p className={`text-sm font-medium ${row.diasFaltantes < 0 ? 'text-red-600' : row.diasFaltantes <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                                  {row.alerta || (row.diasFaltantes < 0 ? 'Vencido' : row.diasFaltantes <= 30 ? 'Por Vencer' : 'A Tiempo')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
