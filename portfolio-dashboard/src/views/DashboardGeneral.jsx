import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { Briefcase, Target, PlayCircle, CheckCircle, AlertTriangle, DollarSign, Clock } from 'lucide-react';

const COLORS = {
  plan: '#1565C0', // bn-primary
  ejec: '#F57C00', // bn-orange
  green: '#2E7D32',
  red: '#C62828',
  gray: '#546E7A',
  lightGray: '#F4F6F9',
  pieColors: ['#2E7D32', '#1565C0', '#546E7A', '#C62828', '#F57C00'] // Implementado, En Curso, No Iniciado, Descartado, Cerrado
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(val);
};

const KPICard = ({ title, value, icon: Icon, color, borderColor }) => (
  <div className={`bg-white rounded-xl shadow-sm border-l-4 p-4 flex items-center justify-between`} style={{ borderLeftColor: borderColor }}>
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-bn-dark">{value}</h3>
    </div>
    <div className={`p-3 rounded-full`} style={{ backgroundColor: `${color}20`, color: color }}>
      <Icon size={24} />
    </div>
  </div>
);

export default function DashboardGeneral({ data }) {
  const { portafolio, demanda, tendencia, seguimiento } = data;

  // 1. Cálculos de KPIs
  const kpis = useMemo(() => {
    const portActivos = portafolio.filter(p => p.estado !== '05. Descartado');
    const demProyectos = demanda.filter(d => String(d.tipo).toLowerCase().includes('proyecto') && !String(d.tipo).toLowerCase().includes('hijo'));
    const enEjecucion = portafolio.filter(p => String(p.estado).includes('02.'));
    const implementados = portafolio.filter(p => String(p.estado).includes('03.'));
    const conRetraso = portafolio.filter(p => p.desvio < -10);
    const presupuestoTotal = portafolio.reduce((sum, p) => sum + (p.presupuesto || 0), 0);
    const tareasPendientes = seguimiento.filter(s => s.estado !== 'Finalizado');

    return {
      totalPD: portActivos.length,
      totalDemanda: demProyectos.length,
      enEjecucion: enEjecucion.length,
      implementados: implementados.length,
      conRetraso: conRetraso.length,
      presupuestoTotal,
      tareasPendientes: tareasPendientes.length
    };
  }, [portafolio, demanda, seguimiento]);

  // 2. Gráfico Barras: Avance por Proyecto (Solo En Curso)
  const barChartData = useMemo(() => {
    return portafolio
      .filter(p => String(p.estado).includes('02.'))
      .map(p => ({
        name: p.nombre.length > 20 ? p.nombre.substring(0, 20) + '...' : p.nombre,
        fullName: p.nombre,
        Planificado: Math.round(p.avancePlan),
        Ejecutado: Math.round(p.avanceEjec)
      }));
  }, [portafolio]);

  // 3. Gráfico Dona: Estados
  const pieChartData = useMemo(() => {
    const counts = {};
    portafolio.forEach(p => {
      const e = p.estado || 'Sin Estado';
      counts[e] = (counts[e] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a,b) => b.value - a.value);
  }, [portafolio]);

  // 4. Gráfico Línea: Evolución Tendencia
  const lineChartData = useMemo(() => {
    if (!tendencia || tendencia.length === 0) return [];
    
    // Asumimos que todos los proyectos tienen la misma estructura de meses
    // Tomamos los meses del primer proyecto que tenga data
    const projConMeses = tendencia.find(t => t.meses && t.meses.length > 0);
    if (!projConMeses) return [];

    const result = projConMeses.meses.map(m => {
      let sumPlan = 0, sumEjec = 0, count = 0;
      tendencia.forEach(p => {
        const mesData = p.meses.find(x => x.mes === m.mes);
        if (mesData) {
          sumPlan += mesData.planif;
          sumEjec += mesData.ejec;
          count++;
        }
      });
      return {
        mes: m.mes,
        Planificado: count > 0 ? Math.round(sumPlan / count) : 0,
        Ejecutado: count > 0 ? Math.round(sumEjec / count) : 0
      };
    });
    return result;
  }, [tendencia]);

  // 5. Tabla Alertas: Top 10 Desvíos (Demanda o Portafolio, usamos Portafolio por ser más completo en desvíos)
  const topAlertas = useMemo(() => {
    return portafolio
      .filter(p => p.desvio < 0)
      .sort((a, b) => a.desvio - b.desvio)
      .slice(0, 10);
  }, [portafolio]);

  return (
    <div className="space-y-6">
      
      {/* FILA 1: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Proyectos P&D" value={kpis.totalPD} icon={Briefcase} color={COLORS.plan} borderColor={COLORS.plan} />
        <KPICard title="Presupuesto Total" value={formatCurrency(kpis.presupuestoTotal)} icon={DollarSign} color={COLORS.gray} borderColor={COLORS.gray} />
        <KPICard title="En Ejecución" value={kpis.enEjecucion} icon={PlayCircle} color={COLORS.plan} borderColor={COLORS.plan} />
        <KPICard title="Implementados" value={kpis.implementados} icon={CheckCircle} color={COLORS.green} borderColor={COLORS.green} />
        <KPICard title="Proyectos con Retraso" value={kpis.conRetraso} icon={AlertTriangle} color={COLORS.red} borderColor={COLORS.red} />
        <KPICard title="Tareas Pendientes" value={kpis.tareasPendientes} icon={Clock} color={COLORS.ejec} borderColor={COLORS.ejec} />
        <KPICard title="Requerimientos Demanda" value={kpis.totalDemanda} icon={Target} color={COLORS.plan} borderColor={COLORS.plan} />
      </div>

      {/* FILA 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-bn-dark mb-4">% Avance Planificado vs Ejecutado (En Curso)</h3>
          <div className="h-80">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{fontSize: 11}} />
                  <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip 
                    formatter={(value) => [`${value}%`]}
                    labelFormatter={(label) => {
                      const item = barChartData.find(d => d.name === label);
                      return item ? item.fullName : label;
                    }}
                  />
                  <Legend verticalAlign="top" />
                  <Bar dataKey="Planificado" fill={COLORS.plan} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Ejecutado" fill={COLORS.ejec} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No hay proyectos en curso</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-bn-dark mb-4">Distribución por Estado P&D</h3>
          <div className="h-80">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.pieColors[index % COLORS.pieColors.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend layout="vertical" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILA 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-bold text-bn-dark mb-4">Evolución Promedio Consolidada</h3>
          <div className="h-72">
            {lineChartData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={{fontSize: 12}} />
                  <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <RechartsTooltip formatter={(value) => [`${value}%`]} />
                  <Legend verticalAlign="top" />
                  <Line type="monotone" dataKey="Planificado" stroke={COLORS.plan} strokeWidth={3} dot={{r: 4}} />
                  <Line type="monotone" dataKey="Ejecutado" stroke={COLORS.ejec} strokeWidth={3} strokeDasharray="5 5" dot={{r: 4}} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">Datos de tendencia no encontrados</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-bn-dark p-4">
             <h3 className="text-lg font-bold text-white">Top Proyectos con Mayor Desvío</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold">Proyecto</th>
                  <th className="px-4 py-3 font-semibold">% Plan</th>
                  <th className="px-4 py-3 font-semibold">% Ejec</th>
                  <th className="px-4 py-3 font-semibold">Desvío</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {topAlertas.map((p, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-bn-dark truncate max-w-[200px]" title={p.nombre}>{p.nombre}</td>
                    <td className="px-4 py-3">{p.avancePlan.toFixed(1)}%</td>
                    <td className="px-4 py-3">{p.avanceEjec.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.desvio < -10 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {p.desvio.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{p.estado}</td>
                  </tr>
                ))}
                {topAlertas.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No hay proyectos con desvío negativo</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
    </div>
  );
}
