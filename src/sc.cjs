const fs = require('fs');
const content = fs.readFileSync('App.jsx', 'utf8');

let newContent = content;

// 1. Add states
newContent = newContent.replace(
  'const [data, setData] = useState(null);',
  'const [data, setData] = useState(null);\n  const [demand2Data, setDemand2Data] = useState(null);'
);

// 2. Add handleDemand2Upload logic just after handleFileUpload
const uploadFuncStr = `  const handleDemand2Upload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const XLSX = require('xlsx'); 
        // We use global window.XLSX since this runs in browser
        const wb = window.XLSX.read(bstr, { type: 'binary', cellDates: true });
        
        let targetSheetName = wb.SheetNames.find(n => n.includes('Demanda Estratégica') || n.includes('Demanda Estrategica'));
        if (!targetSheetName) throw new Error("No se encontró la hoja Demanda Estratégica");
        
        const sheet = wb.Sheets[targetSheetName];
        let rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        let headerRowIndex = rows.findIndex(row => row && row.some(cell => typeof cell === 'string' && typeof cell.trim === 'function' && cell.trim().toUpperCase().includes('PROYECTO')));
        
        if (headerRowIndex !== -1) {
          const rawData = window.XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
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
`;

newContent = newContent.replace(
  'const getFilterOptions = (field) => {',
  uploadFuncStr + '\n  const getFilterOptions = (field) => {'
);


// 3. getFilterOptions
newContent = newContent.replace(
  "else if (activeTab === 'weekly') source = data?.weekly || [];",
  "else if (activeTab === 'weekly') source = data?.weekly || [];\n    else if (activeTab === 'demand2') source = demand2Data || [];"
);

// 4. filteredDemand2
const filteredDemand2Str = `
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

`;

newContent = newContent.replace(
  'const stats = useMemo(() => {',
  filteredDemand2Str + '  const stats = useMemo(() => {'
);


// 5. Duplicate renderDemandDashboard to renderDemand2Dashboard
const renderDemandStart = newContent.indexOf('const renderDemandDashboard = () => {');
const renderPortStart = newContent.indexOf('const renderPortfolioDashboard = () => {');

const demandDashCode = newContent.substring(renderDemandStart, renderPortStart);

let demand2DashCode = demandDashCode.replace('const renderDemandDashboard = () => {', 'const renderDemand2Dashboard = () => {');
demand2DashCode = demand2DashCode.replace(/filteredDemand/g, 'filteredDemand2');
demand2DashCode = demand2DashCode.replace(/data\?\.demand/g, 'demand2Data');
demand2DashCode = demand2DashCode.replace(/data\.demand/g, 'demand2Data');
demand2DashCode = demand2DashCode.replace(/Demanda Estratégica TI/g, 'Demanda Estratégica (2)');


newContent = newContent.slice(0, renderPortStart) + demand2DashCode + '\\n' + newContent.slice(renderPortStart);

// 6. TABS loop logic for displaying demand2 tab.
const tabsMapIndex = newContent.indexOf('{TABS.map((tab) => (');
const customTabs = `
          {TABS.map((tab) => (
            <button
               key={tab.id}
               onClick={() => {
                 setActiveTab(tab.id);
                 setSelectedProjectName(null);
                 setTopPortfolio('Todas');
                 setSidebarFilters({ management: 'Todas', dimension: 'Todas', status: 'Todos' });
                 setDemandFilter(null);
                 setTableSearch('');
                 setTableColumnFilters({});
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
                 setDemandFilter(null);
                 setTableSearch('');
                 setTableColumnFilters({});
                 setShowStrategicDetail(false);
               }}
               className={cn(
                 "px-6 py-4 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center space-x-2",
                 activeTab === 'demand2'
                   ? "text-corporate-dark border-b-2 border-corporate-dark bg-gray-50" 
                   : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
               )}
             >
               <LineChart className={cn("w-4 h-4", activeTab === 'demand2' ? "text-corporate-dark" : "text-gray-400")} />
               <span>Demanda Estratégica (2)</span>
             </button>
          )}
`;

// we need to replace exactly the old tabs loop
const tabsMapEnd = newContent.indexOf('</div>', tabsMapIndex);
newContent = newContent.slice(0, tabsMapIndex) + customTabs + newContent.slice(tabsMapEnd);


// 7. Change upload buttons
const oldUploadBlock = `          <label className="bg-white text-[#a5000d] hover:bg-gray-100 px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
            <Upload className="w-4 h-4" />
            <span>SUBIR ORIGINAL</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>`;

const newUploadBlock = `          <label className="bg-white text-[#a5000d] hover:bg-gray-100 px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
            <Upload className="w-4 h-4" />
            <span>SUBIR ORIGINAL</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <label className="bg-[#a5000d] border border-white hover:bg-white hover:text-[#a5000d] px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">
            <Upload className="w-4 h-4" />
            <span>SUBIR DEMANDA TI</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleDemand2Upload}
              className="hidden"
            />
          </label>`;

newContent = newContent.replace(
  '<span>SUBIR EXCEL</span>',
  '<span>SUBIR ORIGINAL</span>'
);

// We'll replace the block dynamically since exact whitespace matching is hard.
// In App.jsx, the upload section is around:
// <div className="text-xs font-medium flex flex-col items-end">
//   <span ...>Fecha de Corte: ...</span>
//   <div ...>V1.2.0</div>
// </div>
// <div className="flex gap-2"> or missing gap-2. 
// Let's replace the whole header right side.

newContent = newContent.replace(
  '<div className="flex items-center space-x-6">',
  '<div className="flex items-center space-x-6">\\n          <div className="text-xs font-medium flex flex-col items-end">\\n            <span className="opacity-70 uppercase tracking-widest">Fecha de Corte: {new Date().toLocaleDateString(\\'es-CL\\')}</span>\\n            <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold mt-1">V1.2.0</div>\\n          </div>\\n          <div className="flex gap-2">\\n            <label className="bg-white text-[#a5000d] hover:bg-gray-100 px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">\\n              <Upload className="w-4 h-4" />\\n              <span>SUBIR ORIGINAL</span>\\n              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />\\n            </label>\\n            <label className="bg-[#a5000d] border border-white hover:bg-white hover:text-[#a5000d] px-4 py-2 rounded font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg">\\n              <Upload className="w-4 h-4" />\\n              <span>SUBIR DEMANDA TI</span>\\n              <input type="file" accept=".xlsx, .xls" onChange={handleDemand2Upload} className="hidden" />\\n            </label>\\n          </div>\\n        </div>\\n        <!-- Remove Old -->'
);

// We need to clean up what it replaced so let's just make it target the actual App.jsx string!
const weeklyDashStr = `  const renderWeeklyDashboard = () => {
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
    
    const estadosRawData = filteredWeekly.map(w => w['Estado'] || 'Sin estado');
    const estadosMap = estadosRawData.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});
    const estadoData = Object.entries(estadosMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#f43f5e', '#8b5cf6', '#10b981'];

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
                          <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
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
\`;`;

// now replace the old empty renderWeeklyDashboard with our new one
const originalWeeklyIndex = newContent.indexOf('const renderWeeklyDashboard');
const authEndIndex = newContent.indexOf('return (', originalWeeklyIndex);
// wait, the old one is `const renderWeeklyDashboard = () => { ... }` up to the main return
const oldRenderWeeklyStr = newContent.substring(originalWeeklyIndex, newContent.indexOf('const getDemandProjectHealth', originalWeeklyIndex));

// Since getDemandProjectHealth is right after renderWeeklyDashboard in App.jsx... Oh wait!
// Let's just find the end of `renderWeeklyDashboard` via index of `{/* Main Dashboard Content */}` minus some lines? 
// No, standard JS replace!
// We'll replace the regex /const renderWeeklyDashboard = \(\) => {[\s\S]*?}(?=\n\n\s*const getDemandProjectHealth)/

newContent = newContent.replace(
  oldRenderWeeklyStr,
  weeklyDashStr + '\\n\\n'
);

// If the regex mapping fails, I'll use a safer direct replace:
newContent = newContent.replace('const renderWeeklyDashboard = () => {\\n    return (\\n      <div>\\n        <h2>Seguimiento Semanal</h2>\\n      </div>\\n    );\\n  };', weeklyDashStr);
newContent = newContent.replace('const renderWeeklyDashboard = () => {\\n    if (!filteredWeekly) return null;\\n    return (\\n      <div>\\n        <h2>Seguimiento Semanal</h2>\\n        {/* Add weekly logic here */}\\n      </div>\\n    );\\n  };', weeklyDashStr);


fs.writeFileSync('App.jsx', newContent);
console.log('Successfully updated App.jsx');
