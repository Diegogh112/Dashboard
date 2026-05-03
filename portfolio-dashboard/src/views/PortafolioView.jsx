import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, FileText, Info } from 'lucide-react';

const ProgressBar = ({ value, color }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div className="h-2.5 rounded-full" style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }}></div>
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

export default function PortafolioView({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Filtros
  const [filterGerencia, setFilterGerencia] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterDimension, setFilterDimension] = useState('');
  const [filterCartera, setFilterCartera] = useState('');
  const [filterAnio, setFilterAnio] = useState('');

  // Opciones únicas para dropdowns
  const uniqueGerencias = useMemo(() => Array.from(new Set(data.map(d => d.gerencia))).filter(Boolean).sort(), [data]);
  const uniqueEstados = useMemo(() => Array.from(new Set(data.map(d => d.estado))).filter(Boolean).sort(), [data]);
  const uniqueDimensiones = useMemo(() => Array.from(new Set(data.map(d => d.dimension))).filter(Boolean).sort(), [data]);
  const uniqueCarteras = useMemo(() => Array.from(new Set(data.map(d => d.cartera))).filter(Boolean).sort(), [data]);
  const uniqueAnios = useMemo(() => Array.from(new Set(data.map(d => d.anioInicio))).filter(Boolean).sort(), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (item.gerencia && item.gerencia.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchGerencia = filterGerencia === '' || item.gerencia === filterGerencia;
      const matchEstado = filterEstado === '' || item.estado === filterEstado;
      const matchDimension = filterDimension === '' || item.dimension === filterDimension;
      const matchCartera = filterCartera === '' || item.cartera === filterCartera;
      const matchAnio = filterAnio === '' || String(item.anioInicio) === filterAnio;
      
      return matchSearch && matchGerencia && matchEstado && matchDimension && matchCartera && matchAnio;
    });
  }, [data, searchTerm, filterGerencia, filterEstado, filterDimension, filterCartera, filterAnio]);

  const toggleRow = (id) => {
    if (expandedRow === id) setExpandedRow(null);
    else setExpandedRow(id);
  };

  const getDesvioColor = (val) => {
    if (val < -10) return 'red';
    if (val < 0) return 'yellow';
    return 'green';
  };

  const getEstadoColor = (estado) => {
    const e = String(estado).toLowerCase();
    if (e.includes('implementado') || e.includes('cerrado')) return 'green';
    if (e.includes('curso') || e.includes('ejecución')) return 'blue';
    if (e.includes('descartado')) return 'red';
    return 'gray';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Header & Filters */}
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-bn-dark">Detalle de Portafolio P&D</h2>
            <p className="text-sm text-gray-500">{filteredData.length} proyectos encontrados</p>
          </div>
          
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-bn-primary focus:border-bn-primary sm:text-sm"
              placeholder="Buscar por nombre o gerencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Combo Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mt-2">
          <select className="border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterGerencia} onChange={e => setFilterGerencia(e.target.value)}>
            <option value="">Todas las Gerencias</option>
            {uniqueGerencias.map((g, i) => <option key={i} value={g}>{g}</option>)}
          </select>
          <select className="border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="">Todos los Estados</option>
            {uniqueEstados.map((e, i) => <option key={i} value={e}>{e}</option>)}
          </select>
          <select className="border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterDimension} onChange={e => setFilterDimension(e.target.value)}>
            <option value="">Todas las Dimensiones</option>
            {uniqueDimensiones.map((d, i) => <option key={i} value={d}>{d}</option>)}
          </select>
          <select className="border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterCartera} onChange={e => setFilterCartera(e.target.value)}>
            <option value="">Todas las Carteras</option>
            {uniqueCarteras.map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
          <select className="border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:ring-bn-primary focus:border-bn-primary bg-white" value={filterAnio} onChange={e => setFilterAnio(e.target.value)}>
            <option value="">Todos los Años (Inicio)</option>
            {uniqueAnios.map((a, i) => <option key={i} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-bn-dark text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">N°</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/4">Proyecto</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Gerencia</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">% Plan</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">% Ejec</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">Desvío</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.map((row, idx) => (
              <React.Fragment key={idx}>
                <tr className={`hover:bg-gray-50 cursor-pointer ${expandedRow === idx ? 'bg-blue-50' : ''}`} onClick={() => toggleRow(idx)}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{row.no}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 line-clamp-2" title={row.nombre}>{row.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{row.gerencia}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center w-24">
                    <div className="flex flex-col items-center">
                      <span className="mb-1">{row.avancePlan.toFixed(1)}%</span>
                      <ProgressBar value={row.avancePlan} color="#1565C0" />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center w-24">
                    <div className="flex flex-col items-center">
                      <span className="mb-1">{row.avanceEjec.toFixed(1)}%</span>
                      <ProgressBar value={row.avanceEjec} color="#F57C00" />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Badge text={`${row.desvio > 0 ? '+' : ''}${row.desvio.toFixed(1)}%`} type={getDesvioColor(row.desvio)} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Badge text={row.estado} type={getEstadoColor(row.estado)} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-gray-400">
                    {expandedRow === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </td>
                </tr>
                
                {/* Expanded Content */}
                {expandedRow === idx && (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-2">
                          <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                            <FileText size={14} /> Alcance del Proyecto
                          </h4>
                          <p className="text-sm text-gray-700 bg-white p-3 border rounded shadow-sm whitespace-pre-wrap">
                            {row.alcance || 'No se registró alcance para este proyecto.'}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                            <Info size={14} /> Detalles Adicionales
                          </h4>
                          <ul className="text-sm space-y-2 bg-white p-3 border rounded shadow-sm">
                            <li><span className="font-semibold">Líder:</span> {row.lider || '-'}</li>
                            <li><span className="font-semibold">Líder Técnico:</span> {row.liderTecnico || '-'}</li>
                            <li><span className="font-semibold">Cartera:</span> {row.cartera}</li>
                            <li><span className="font-semibold">Presupuesto:</span> {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(row.presupuesto || 0)}</li>
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                            <Info size={14} /> Fechas
                          </h4>
                          <ul className="text-sm space-y-2 bg-white p-3 border rounded shadow-sm">
                            <li><span className="font-semibold">Inicio:</span> {row.fechaInicio ? new Date(row.fechaInicio).toLocaleDateString('es-PE') : '-'}</li>
                            <li><span className="font-semibold">Fin:</span> {row.fechaFin ? new Date(row.fechaFin).toLocaleDateString('es-PE') : '-'}</li>
                            <li><span className="font-semibold">Cambios:</span> {row.cambios}</li>
                          </ul>
                        </div>
                      </div>
                      
                      {row.seguimiento && (
                        <div className="mt-4">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Notas de Seguimiento</h4>
                          <div className="text-sm text-gray-700 bg-yellow-50 p-3 border border-yellow-200 rounded shadow-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {row.seguimiento}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                  No se encontraron proyectos con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
