import React, { useState, useMemo } from 'react';
import { Calendar, User, Clock, CheckCircle, AlertCircle, LayoutGrid, List } from 'lucide-react';

const Badge = ({ text, type }) => {
  const colors = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',
    orange: 'bg-orange-100 text-orange-800',
  };
  return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[type] || colors.gray}`}>{text}</span>;
};

export default function SeguimientoView({ data }) {
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [soloVencidos, setSoloVencidos] = useState(false);

  const filteredData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return data.filter(item => {
      const matchSearch = (item.proyecto || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.responsable || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.pendiente || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchVencido = true;
      if (soloVencidos) {
        if (!item.fechaRaw || item.estado === 'Finalizado') {
          matchVencido = false;
        } else {
          const itemDate = new Date(item.fechaRaw);
          matchVencido = itemDate < today;
        }
      }
      return matchSearch && matchVencido;
    });
  }, [data, searchTerm, soloVencidos]);

  // Kanban columns
  const columns = {
    'Por Definir': { title: 'Por Definir', color: 'bg-gray-100', borderColor: 'border-gray-200' },
    'Pendiente': { title: 'Pendiente', color: 'bg-red-50', borderColor: 'border-red-200' },
    'En Proceso': { title: 'En Proceso', color: 'bg-blue-50', borderColor: 'border-blue-200' },
    'Finalizado': { title: 'Finalizado', color: 'bg-green-50', borderColor: 'border-green-200' }
  };

  const getColData = (estadoCol) => {
    return filteredData.filter(d => d.estado === estadoCol).sort((a,b) => {
      if (!a.fechaRaw) return 1;
      if (!b.fechaRaw) return -1;
      return new Date(a.fechaRaw) - new Date(b.fechaRaw);
    });
  };

  const isVencido = (fechaRaw, estado) => {
    if (!fechaRaw || estado === 'Finalizado') return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    return new Date(fechaRaw) < today;
  };

  return (
    <div className="space-y-6">
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <input
            type="text"
            className="w-full md:w-64 border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-bn-primary focus:border-bn-primary"
            placeholder="Buscar por proyecto, responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
            <input 
              type="checkbox" 
              checked={soloVencidos} 
              onChange={(e) => setSoloVencidos(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500"
            />
            Solo Vencidos
          </label>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-bn-dark' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid size={16} /> Kanban
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-bn-dark' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewMode('table')}
          >
            <List size={16} /> Tabla
          </button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {Object.keys(columns).map(colKey => {
            const col = columns[colKey];
            const tasks = getColData(colKey);
            return (
              <div key={colKey} className={`${col.color} border ${col.borderColor} rounded-xl overflow-hidden flex flex-col max-h-[800px]`}>
                <div className="bg-white/50 px-4 py-3 border-b border-black/5 flex justify-between items-center sticky top-0">
                  <h3 className="font-bold text-gray-800">{col.title}</h3>
                  <span className="bg-white text-gray-600 text-xs font-bold px-2 py-1 rounded-full shadow-sm">{tasks.length}</span>
                </div>
                <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                  {tasks.map((task, i) => {
                    const vencido = isVencido(task.fechaRaw, task.estado);
                    return (
                      <div key={i} className={`bg-white p-3 rounded-lg shadow-sm border-l-4 ${vencido ? 'border-l-red-500' : 'border-l-bn-primary'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-bn-primary uppercase bg-blue-50 px-2 py-1 rounded line-clamp-1" title={task.proyecto}>{task.proyecto}</span>
                          {vencido && <span className="flex items-center text-[10px] text-red-600 font-bold"><AlertCircle size={12} className="mr-1"/> Vencido</span>}
                        </div>
                        <p className="text-sm text-gray-800 mb-3">{task.pendiente}</p>
                        
                        <div className="flex flex-col gap-1 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User size={14} className="text-gray-400" /> 
                            <span className="truncate" title={task.responsable}>{task.responsable}</span>
                          </div>
                          {task.fechaCompromisoStr && (
                            <div className="flex items-center gap-1">
                              <Calendar size={14} className={vencido ? 'text-red-500' : 'text-gray-400'} /> 
                              <span className={vencido ? 'text-red-600 font-semibold' : ''}>{task.fechaCompromisoStr}</span>
                            </div>
                          )}
                        </div>
                        {task.proveedor && (
                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-[10px] text-gray-500">Prov:</span>
                            <Badge text={task.proveedor} type="orange" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {tasks.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                      No hay tareas
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-bn-dark text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase w-1/4">Proyecto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase w-1/3">Tarea Pendiente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Responsable</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Fecha Comp.</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((row, idx) => {
                  const vencido = isVencido(row.fechaRaw, row.estado);
                  return (
                    <tr key={idx} className={`hover:bg-gray-50 ${vencido ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="line-clamp-2" title={row.proyecto}>{row.proyecto}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{row.pendiente}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{row.responsable}</td>
                      <td className={`px-4 py-3 text-sm ${vencido ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        {row.fechaCompromisoStr || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge text={row.estado} type={row.estado === 'Finalizado' ? 'green' : row.estado === 'En Proceso' ? 'blue' : row.estado === 'Pendiente' ? 'red' : 'gray'} />
                      </td>
                    </tr>
                  )
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-10 text-center text-gray-500">
                      No se encontraron tareas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
