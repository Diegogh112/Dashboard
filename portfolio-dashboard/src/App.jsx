import { useState, useMemo } from 'react';
import { UploadCloud, LayoutDashboard, Briefcase, Target, TrendingUp, Calendar, RefreshCcw } from 'lucide-react';
import { parseExcelData } from './utils/excelParser';

// Placeholder for Views
import DashboardGeneral from './views/DashboardGeneral';
import PortafolioView from './views/PortafolioView';
import DemandaView from './views/DemandaView';
import TendenciaView from './views/TendenciaView';
import SeguimientoView from './views/SeguimientoView';

function App() {
  const [fileLoaded, setFileLoaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [data, setData] = useState({
    portafolio: [],
    demanda: [],
    tendencia: [],
    seguimiento: []
  });

  const [activeView, setActiveView] = useState('general');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const parsed = await parseExcelData(arrayBuffer);
        setData(parsed);
        setFileLoaded(true);
      } catch (err) {
        setError(err.message || 'Error al leer el archivo. Asegúrate de que sea el Excel correcto.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Error leyendo el archivo.");
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload({ target: { files: [e.dataTransfer.files[0]] } });
    }
  };

  if (!fileLoaded) {
    return (
      <div className="min-h-screen bg-bn-light flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-10 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-bn-dark rounded-full flex items-center justify-center text-white">
              <LayoutDashboard size={40} />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-bn-dark mb-2">📊 Portfolio Manager BN</h1>
          <p className="text-gray-500 mb-10 text-lg">Sistema de Gestión de Portafolio de Proyectos</p>

          <div 
            className="border-4 border-dashed border-bn-primary rounded-xl p-12 mb-6 cursor-pointer hover:bg-blue-50 transition-colors flex flex-col items-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload').click()}
          >
            <UploadCloud size={60} className="text-bn-primary mb-4" />
            <h3 className="text-xl font-semibold text-bn-dark mb-2">Arrastra tu archivo Excel aquí o haz clic para seleccionar</h3>
            <p className="text-sm text-gray-500">Compatible con archivos .xlsx del Portafolio de Proyectos BN</p>
            <input 
              id="file-upload" 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </div>

          {isLoading && (
            <div className="text-bn-primary animate-pulse font-semibold">Procesando archivo, por favor espera...</div>
          )}
          
          {error && (
            <div className="text-bn-red bg-red-50 p-4 rounded-lg font-medium">{error}</div>
          )}
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'general': return <DashboardGeneral data={data} />;
      case 'portafolio': return <PortafolioView data={data.portafolio} />;
      case 'demanda': return <DemandaView data={data.demanda} />;
      case 'tendencia': return <TendenciaView data={data.tendencia} />;
      case 'seguimiento': return <SeguimientoView data={data.seguimiento} />;
      default: return <DashboardGeneral data={data} />;
    }
  };

  const getMenuName = (view) => {
    switch (view) {
      case 'general': return 'Dashboard General';
      case 'portafolio': return 'Portafolio P&D';
      case 'demanda': return 'Demanda Estratégica';
      case 'tendencia': return 'Pys Transf Digital';
      case 'seguimiento': return 'Seguimiento Semanal';
      default: return '';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bn-light">
      {/* Sidebar */}
      <aside className="w-64 bg-bn-dark text-white flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <LayoutDashboard className="text-bn-primary shrink-0" size={28} />
          <h2 className="text-xl font-bold tracking-tight">Portfolio BN</h2>
        </div>
        
        <div className="px-6 py-4 border-b border-white/10">
          <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Archivo Actual</p>
          <p className="text-sm font-medium truncate" title={fileName}>{fileName}</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {[
            { id: 'general', label: 'Dashboard General', icon: LayoutDashboard },
            { id: 'portafolio', label: 'Portafolio P&D', icon: Briefcase },
            { id: 'demanda', label: 'Demanda Estratégica', icon: Target },
            { id: 'tendencia', label: 'Pys Transf Digital', icon: TrendingUp },
            { id: 'seguimiento', label: 'Seguimiento Semanal', icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-bn-primary text-white font-semibold' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={() => { setFileLoaded(false); setData({ portafolio: [], demanda: [], tendencia: [], seguimiento: [] }); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded transition-colors text-sm"
          >
            <RefreshCcw size={16} />
            Cambiar archivo
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-bn-dark">{getMenuName(activeView)}</h1>
            <p className="text-sm text-gray-500">Dashboard &gt; {getMenuName(activeView)}</p>
          </div>
          <div className="text-sm font-medium text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default App;
