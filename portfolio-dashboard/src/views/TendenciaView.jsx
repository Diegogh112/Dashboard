import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function TendenciaView({ data }) {
  const [selectedProject, setSelectedProject] = useState('Todos');

  const proyectosUnicos = useMemo(() => {
    return Array.from(new Set(data.map(d => d.nombre))).sort();
  }, [data]);

  const lineChartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Identificar todos los meses disponibles
    let allMonths = [];
    const projConMeses = data.find(t => t.meses && t.meses.length > 0);
    if (projConMeses) {
      allMonths = projConMeses.meses.map(m => m.mes);
    }

    if (selectedProject === 'Todos') {
      return allMonths.map(mes => {
        let sumPlan = 0, sumEjec = 0, count = 0;
        data.forEach(p => {
          const mesData = p.meses?.find(x => x.mes === mes);
          if (mesData) {
            sumPlan += mesData.planif;
            sumEjec += mesData.ejec;
            count++;
          }
        });
        return {
          mes: mes,
          Planificado: count > 0 ? Number((sumPlan / count).toFixed(1)) : 0,
          Ejecutado: count > 0 ? Number((sumEjec / count).toFixed(1)) : 0
        };
      });
    } else {
      const pData = data.find(p => p.nombre === selectedProject);
      if (!pData || !pData.meses) return [];
      return pData.meses.map(m => ({
        mes: m.mes,
        Planificado: Number(m.planif.toFixed(1)),
        Ejecutado: Number(m.ejec.toFixed(1))
      }));
    }
  }, [data, selectedProject]);

  return (
    <div className="space-y-6">
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Proyecto</label>
          <select 
            className="w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-bn-primary focus:border-bn-primary sm:text-sm"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="Todos">Promedio de Todos los Proyectos</option>
            {proyectosUnicos.map((p, i) => (
              <option key={i} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-lg font-bold text-bn-dark mb-4">
          {selectedProject === 'Todos' ? 'Evolución Promedio Consolidada' : `Evolución: ${selectedProject}`}
        </h3>
        <div className="h-96">
          {lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1565C0" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1565C0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" />
                <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <RechartsTooltip formatter={(value) => [`${value}%`]} />
                <Legend verticalAlign="top" />
                <Area type="monotone" dataKey="Planificado" stroke="#1565C0" fillOpacity={1} fill="url(#colorPlan)" strokeWidth={3} />
                <Line type="monotone" dataKey="Ejecutado" stroke="#F57C00" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4}} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">No hay datos de tendencia para mostrar</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-bn-dark p-4">
           <h3 className="text-lg font-bold text-white">Tabla Comparativa Mensual</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-64">Proyecto</th>
                {lineChartData.map((m, i) => (
                  <th key={i} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{m.mes}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-bn-dark sticky left-0 bg-white z-10 truncate max-w-xs" title={row.nombre}>
                    {row.nombre}
                  </td>
                  {lineChartData.map((m, i) => {
                    const mesData = row.meses?.find(x => x.mes === m.mes);
                    if (!mesData) return <td key={i} className="px-4 py-3 text-center text-sm text-gray-400">-</td>;
                    
                    const p = mesData.planif;
                    const e = mesData.ejec;
                    let colorClass = 'text-gray-500';
                    if (e >= p) colorClass = 'text-green-600 font-bold';
                    else if (e < p - 10) colorClass = 'text-red-600 font-bold';
                    else colorClass = 'text-yellow-600 font-bold';

                    return (
                      <td key={i} className={`px-4 py-3 text-center text-sm ${colorClass}`}>
                        {e.toFixed(0)}%
                        <div className="text-[10px] text-gray-400 font-normal">P: {p.toFixed(0)}%</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
