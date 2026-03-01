import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  Database, 
  X,
  AlertCircle,
  LayoutDashboard,
  Settings,
  Filter
} from 'lucide-react';

// Registro de componentes de Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// --- Credenciales Directas (Supabase) ---
const SUPABASE_URL = "https://jtdcidvhhdktchigovsn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZGNpZHZoaGRrdGNoaWdvdnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM0MjEsImV4cCI6MjA4NzkzOTQyMX0.FjhRZeamDl8J3Kkm6O8u74DxToSsQiAo1a58IX_vTxI";

const AREAS_BASE = ['ACT', 'ALU', 'CA', 'CONC', 'DESP', 'OTROS', 'RRHH', 'SADMIN', 'SAU', 'SCYT', 'SACAD', 'SEU', 'TIT'];

// ========================================================
// LÓGICA DE NEGOCIO (HOOK)
// ========================================================
function useResoluciones() {
  const [supabase] = useState(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  const [resoluciones, setResoluciones] = useState([]);
  const [estados, setEstados] = useState([]);
  const [areasExtra, setAreasExtra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: resData, error: resErr } = await supabase.from('resoluciones').select('*').order('created_at', { ascending: false });
      const { data: areasData, error: areasErr } = await supabase.from('config_areas').select('sigla');
      const { data: estadosData, error: estadosErr } = await supabase.from('estados').select('*').order('orden', { ascending: true });
      
      if (resErr || areasErr || estadosErr) throw new Error("Error en la base de datos");
      
      setResoluciones(resData || []);
      setEstados(estadosData || []);
      setAreasExtra(areasData?.map(a => a.sigla) || []);
      setError(null);
    } catch (err) {
      setError("Error de conexión. Verifica las tablas en Supabase.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('realtime_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resoluciones' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estados' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config_areas' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchData]);

  return { 
    resoluciones, estados, areasExtra, loading, error,
    create: (item) => supabase.from('resoluciones').insert([{ ...item, tematica: item.tematica.toUpperCase() }]),
    update: (id, campos) => supabase.from('resoluciones').update(campos).eq('id', id),
    remove: (id) => supabase.from('resoluciones').delete().eq('id', id),
    updateEstado: (id, campos) => supabase.from('estados').update(campos).eq('id', id),
    addArea: (sigla) => supabase.from('config_areas').insert([{ sigla: sigla.toUpperCase() }])
  };
}

// ========================================================
// INTERFAZ DE USUARIO
// ========================================================
export default function App() {
  const { resoluciones, estados, areasExtra, loading, error, create, update, remove, updateEstado, addArea } = useResoluciones();
  
  // Estados de UI
  const [filtro, setFiltro] = useState('');
  const [areaFiltro, setAreaFiltro] = useState('Todas');
  const [estadoFiltro, setEstadoFiltro] = useState('Todos');
  const [dashboardArea, setDashboardArea] = useState('Global');
  
  const [editItem, setEditItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigEstados, setShowConfigEstados] = useState(false);
  
  const [nuevaRes, setNuevaRes] = useState({ 
    numero: '', anio: '2026', area: 'ALU', sesion: '', 
    tematica: '', interesado: '', estado: 'sin-redactar', observaciones: '' 
  });

  const areasFinales = useMemo(() => [...new Set([...AREAS_BASE, ...areasExtra])].sort(), [areasExtra]);
  
  const filtradas = useMemo(() => resoluciones.filter(r => 
    `${r.numero} ${r.tematica} ${r.interesado} ${r.observaciones || ''}`.toLowerCase().includes(filtro.toLowerCase()) &&
    (areaFiltro === 'Todas' || r.area === areaFiltro) &&
    (estadoFiltro === 'Todos' || r.estado === estadoFiltro)
  ), [resoluciones, filtro, areaFiltro, estadoFiltro]);

  // Lógica de Dashboard por Área
  const stats = useMemo(() => {
    const dataFiltrada = dashboardArea === 'Global' 
      ? resoluciones 
      : resoluciones.filter(r => r.area === dashboardArea);

    return {
      labels: estados.map(e => e.label),
      datasets: [{
        data: estados.map(e => dataFiltrada.filter(r => r.estado === e.id).length),
        backgroundColor: estados.map(e => {
          if (e.id === 'sin-redactar') return '#ef4444';
          if (e.id === 'en-redaccion') return '#f59e0b';
          if (e.id === 'revision-jefe') return '#3b82f6';
          if (e.id === 'verificada') return '#6366f1';
          if (e.id === 'firmada') return '#10b981';
          return '#94a3b8';
        }),
        borderRadius: 8
      }]
    };
  }, [resoluciones, estados, dashboardArea]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          precision: 0,
          color: '#94a3b8',
          font: { size: 10 }
        },
        grid: { color: '#f1f5f9' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10, weight: '500' } }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 12, weight: 'bold' },
        padding: 12,
        cornerRadius: 8
      }
    }
  };

  // Handlers
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const defaultEstado = estados.length > 0 ? estados[0].id : 'sin-redactar';
    const { error: err } = await create({ ...nuevaRes, estado: nuevaRes.estado || defaultEstado });
    if (!err) {
      setNuevaRes({ 
        numero: '', anio: '2026', area: 'ALU', sesion: '', 
        tematica: '', interesado: '', estado: defaultEstado, observaciones: '' 
      });
      setShowAddModal(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const { error: err } = await update(editItem.id, {
        numero: editItem.numero,
        anio: editItem.anio,
        area: editItem.area,
        sesion: editItem.sesion,
        tematica: editItem.tematica.toUpperCase(),
        interesado: editItem.interesado,
        estado: editItem.estado,
        observaciones: editItem.observaciones
    });
    if (!err) setEditItem(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 antialiased">
      {/* Navegación */}
      <nav className="bg-indigo-950 text-white sticky top-0 z-50 shadow-xl border-b border-indigo-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-indigo-950 font-bold text-xl">U</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">Planilla Control CD</h1>
              <p className="text-indigo-300 text-[10px] font-medium uppercase tracking-widest mt-0.5">Secretaría Académica · UTN FRRe</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={() => setShowConfigEstados(true)}
              className="p-2 hover:bg-indigo-800 rounded-lg transition-colors text-indigo-200"
              title="Protocolo de Estados"
             >
               <Settings size={20} />
             </button>
             <div className="h-6 w-px bg-indigo-800"></div>
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-900/50 border border-indigo-700/50">
               <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
               <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">{loading ? 'Sincronizando' : 'En Línea'}</span>
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {error && <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-700 text-sm font-semibold flex items-center gap-2"><AlertCircle size={18}/> {error}</div>}

        {/* Dashboard Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/60">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <LayoutDashboard size={16} /> Analítica de Gestión
               </h2>
               <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase px-3">Ver por Área:</span>
                  <select 
                    className="bg-white border-none text-xs font-semibold text-indigo-600 rounded-lg px-2 py-1 outline-none shadow-sm"
                    value={dashboardArea}
                    onChange={(e) => setDashboardArea(e.target.value)}
                  >
                    <option value="Global">Global (Todas)</option>
                    {areasFinales.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
               </div>
            </div>
            <div className="h-64">
              <Bar data={stats} options={chartOptions} />
            </div>
          </div>
          <div className="space-y-4 flex flex-col justify-center">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between">
               <div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Total {dashboardArea}</span>
                 <span className="text-4xl font-bold text-slate-800 leading-none">
                   {dashboardArea === 'Global' ? resoluciones.length : resoluciones.filter(r => r.area === dashboardArea).length}
                 </span>
               </div>
               <Database className="text-indigo-100 w-12 h-12" />
            </div>
            <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm flex items-center justify-between">
               <div>
                 <span className="text-xs font-bold text-emerald-600/60 uppercase tracking-widest block mb-1">Finalizadas</span>
                 <span className="text-4xl font-bold text-emerald-700 leading-none">
                   {resoluciones.filter(r => r.estado === 'firmada' && (dashboardArea === 'Global' || r.area === dashboardArea)).length}
                 </span>
               </div>
               <CheckCircle className="text-emerald-200 w-12 h-12" />
            </div>
          </div>
        </section>

        {/* Filtros y Tabla */}
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="p-6 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-center gap-4 border-b border-slate-100">
             <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-grow">
                  <Search className="absolute left-4 top-3 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Buscar temática u observaciones..." 
                    className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 w-full md:w-64 transition-all" 
                    value={filtro} 
                    onChange={e => setFiltro(e.target.value)} 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-slate-400" />
                  <select 
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none" 
                    value={areaFiltro} 
                    onChange={e => setAreaFiltro(e.target.value)}
                  >
                    <option value="Todas">Áreas</option>
                    {areasFinales.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select 
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none" 
                    value={estadoFiltro} 
                    onChange={e => setEstadoFiltro(e.target.value)}
                  >
                    <option value="Todos">Estados</option>
                    {estados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => { const s = prompt("Sigla nueva área:"); if(s) addArea(s); }} 
                  className="bg-white text-slate-500 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all"
                >
                  Config. Áreas
                </button>
                <button 
                  onClick={() => setShowAddModal(true)} 
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
                >
                  <Plus size={16} /> Nuevo Trámite
                </button>
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-8 py-4">Resolución</th>
                  <th className="px-8 py-4">Sesión CD</th>
                  <th className="px-8 py-4">Fuerza Resolutiva</th>
                  <th className="px-8 py-4">Estado</th>
                  <th className="px-8 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtradas.map(r => {
                  const currentEstado = estados.find(e => e.id === r.estado);
                  return (
                    <tr key={r.id} className="hover:bg-indigo-50/10 transition-colors group">
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-sm">{r.numero}</span>
                            <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded leading-none">{r.anio}</span>
                         </div>
                         <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter mt-1 block">{r.area}</span>
                      </td>
                      <td className="px-8 py-5">
                         <span className="text-xs font-medium text-slate-500 italic">{r.sesion || 'N/A'}</span>
                      </td>
                      <td className="px-8 py-5">
                         <span className="text-indigo-950 font-bold text-xs block mb-0.5">{r.tematica}</span>
                         <span className="text-[11px] text-slate-400 font-medium line-clamp-1">{r.interesado}</span>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded-full border ${currentEstado?.color || 'bg-slate-100 text-slate-400'} ${currentEstado?.border || 'border-slate-200'}`}>
                           {currentEstado?.label || 'Pendiente'}
                         </span>
                         {r.observaciones && (
                           <div className="mt-1.5 text-[10px] text-slate-400 font-medium italic truncate max-w-[150px]">
                             "{r.observaciones}"
                           </div>
                         )}
                      </td>
                      <td className="px-8 py-5 text-center">
                         <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditItem(r)} className="text-slate-400 hover:text-indigo-600 p-2 border border-transparent hover:border-indigo-100 rounded-lg transition-all" title="Editar"><Edit2 size={14} /></button>
                            <button onClick={() => { if(confirm("¿Eliminar trámite?")) remove(r.id) }} className="text-slate-300 hover:text-red-500 p-2 border border-transparent hover:border-red-100 rounded-lg transition-all" title="Eliminar"><Trash2 size={14} /></button>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal: Nuevo Proyecto */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl space-y-4 relative border border-white/20 animate-in fade-in zoom-in duration-200">
            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors"><X size={24} /></button>
            <div className="flex items-center gap-3 mb-4">
               <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600"><Plus size={20} /></div>
               <h3 className="text-xl font-bold text-slate-800 tracking-tight">Registro de Nuevo Proyecto</h3>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Identificador</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Nro" required className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.numero} onChange={e => setNuevaRes({...nuevaRes, numero: e.target.value})} />
                    <input type="text" placeholder="Año" required className="w-20 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.anio} onChange={e => setNuevaRes({...nuevaRes, anio: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sesión CD</label>
                  <input type="text" placeholder="Ej: Octava Reunión Ordinaria 2026" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.sesion} onChange={e => setNuevaRes({...nuevaRes, sesion: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Área</label>
                  <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-bold focus:ring-2 focus:ring-indigo-100" value={nuevaRes.area} onChange={e => setNuevaRes({...nuevaRes, area: e.target.value})}>
                     {areasFinales.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Interesado</label>
                  <input type="text" placeholder="Apellido y Nombre" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.interesado} onChange={e => setNuevaRes({...nuevaRes, interesado: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Temática del Proyecto</label>
                <input type="text" placeholder="Ej: EQUIVALENCIA" required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm uppercase font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-100" value={nuevaRes.tematica} onChange={e => setNuevaRes({...nuevaRes, tematica: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Observaciones Preventivas</label>
                <textarea className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" placeholder="Anotaciones adicionales sobre el trámite..." value={nuevaRes.observaciones} onChange={e => setNuevaRes({...nuevaRes, observaciones: e.target.value})} rows="2" />
              </div>
              <div className="pt-4 flex gap-3">
                 <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Registrar</button>
                 <button type="button" onClick={() => setShowAddModal(false)} className="px-6 bg-slate-50 text-slate-400 font-bold py-3.5 rounded-2xl uppercase text-xs">Cerrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Proyecto */}
      {editItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl space-y-4 relative border border-white/20 animate-in fade-in zoom-in duration-200">
            <button onClick={() => setEditItem(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors"><X size={24} /></button>
            <div className="flex items-center gap-3 mb-4">
               <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600"><Edit2 size={20} /></div>
               <h3 className="text-xl font-bold text-slate-800 tracking-tight">Actualizar Trámite</h3>
            </div>
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Identificador</label>
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3 bg-slate-50 rounded-xl border-none outline-none text-sm font-medium" value={editItem.numero} onChange={e => setEditItem({...editItem, numero: e.target.value})} />
                    <input type="text" className="w-20 p-3 bg-slate-50 rounded-xl border-none outline-none text-sm font-medium" value={editItem.anio} onChange={e => setEditItem({...editItem, anio: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Estado del Protocolo</label>
                  <select className="w-full p-3 bg-indigo-50 rounded-xl border-none outline-none text-xs font-bold text-indigo-700" value={editItem.estado} onChange={e => setEditItem({...editItem, estado: e.target.value})}>
                     {estados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Sesión CD</label>
                  <input type="text" placeholder="Ej: Octava Reunión Ordinaria 2026" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-sm font-medium" value={editItem.sesion || ''} onChange={e => setEditItem({...editItem, sesion: e.target.value})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Área</label>
                   <select className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-sm font-bold" value={editItem.area} onChange={e => setEditItem({...editItem, area: e.target.value})}>
                      {areasFinales.map(a => <option key={a} value={a}>{a}</option>)}
                   </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Temática</label>
                <input type="text" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-sm uppercase font-bold text-indigo-950" value={editItem.tematica} onChange={e => setEditItem({...editItem, tematica: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Interesado</label>
                <input type="text" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-sm font-medium" value={editItem.interesado} onChange={e => setEditItem({...editItem, interesado: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Observaciones</label>
                <textarea className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-sm font-medium" value={editItem.observaciones || ''} onChange={e => setEditItem({...editItem, observaciones: e.target.value})} rows="3" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Actualizar</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Configuración de Protocolo (Estados) */}
      {showConfigEstados && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden">
             <button onClick={() => setShowConfigEstados(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600"><X size={24} /></button>
             <div className="flex items-center gap-3 mb-6">
                <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><Settings size={20} /></div>
                <div>
                   <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Protocolo de Estados</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Configuración de etiquetas y visibilidad</p>
                </div>
             </div>
             <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {estados.map(est => (
                  <div key={est.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-center gap-4">
                     <div className="flex-grow space-y-2 w-full">
                        <input 
                          type="text" 
                          className="w-full bg-white px-3 py-1.5 rounded-lg border-none text-xs font-bold" 
                          value={est.label}
                          onChange={(e) => updateEstado(est.id, { label: e.target.value })}
                        />
                        <div className="flex gap-2">
                           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${est.color} ${est.border}`}>Previsualización</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Orden:</label>
                        <input 
                          type="number" 
                          className="w-16 bg-white px-2 py-1.5 rounded-lg text-center font-bold text-xs" 
                          value={est.orden}
                          onChange={(e) => updateEstado(est.id, { orden: parseInt(e.target.value) })}
                        />
                     </div>
                  </div>
                ))}
             </div>
             <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <button 
                  onClick={() => setShowConfigEstados(false)}
                  className="bg-slate-900 text-white px-10 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Finalizar Configuración
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}