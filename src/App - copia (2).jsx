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
  LayoutDashboard
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
      // Fetch Resoluciones
      const { data: resData, error: resErr } = await supabase.from('resoluciones').select('*').order('created_at', { ascending: false });
      // Fetch Áreas
      const { data: areasData, error: areasErr } = await supabase.from('config_areas').select('sigla');
      // Fetch Estados dinámicos
      const { data: estadosData, error: estadosErr } = await supabase.from('estados').select('*').order('orden', { ascending: true });
      
      if (resErr || areasErr || estadosErr) throw new Error("Error en la base de datos");
      
      setResoluciones(resData || []);
      setEstados(estadosData || []);
      setAreasExtra(areasData?.map(a => a.sigla) || []);
      setError(null);
    } catch (err) {
      setError("Error de conexión. Verifica las tablas 'resoluciones', 'config_areas' y 'estados' en Supabase.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('realtime_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resoluciones' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estados' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchData]);

  return { 
    resoluciones, estados, areasExtra, loading, error,
    create: (item) => supabase.from('resoluciones').insert([{ ...item, tematica: item.tematica.toUpperCase() }]),
    update: (id, campos) => supabase.from('resoluciones').update(campos).eq('id', id),
    remove: (id) => supabase.from('resoluciones').delete().eq('id', id),
    addArea: (sigla) => supabase.from('config_areas').insert([{ sigla: sigla.toUpperCase() }])
  };
}

// ========================================================
// INTERFAZ DE USUARIO
// ========================================================
export default function App() {
  const { resoluciones, estados, areasExtra, loading, error, create, update, remove, addArea } = useResoluciones();
  
  // Estados de UI
  const [filtro, setFiltro] = useState('');
  const [areaFiltro, setAreaFiltro] = useState('Todas');
  const [estadoFiltro, setEstadoFiltro] = useState('Todos');
  const [editItem, setEditItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
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

  const stats = useMemo(() => ({
    labels: estados.map(e => e.label),
    datasets: [{
      data: estados.map(e => resoluciones.filter(r => r.estado === e.id).length),
      backgroundColor: estados.map(e => {
        if (e.id === 'sin-redactar') return '#f87171';
        if (e.id === 'en-redaccion') return '#fbbf24';
        if (e.id === 'revision-jefe') return '#60a5fa';
        if (e.id === 'verificada') return '#818cf8';
        if (e.id === 'firmada') return '#34d399';
        return '#cbd5e1';
      }),
      borderRadius: 12
    }]
  }), [resoluciones, estados]);

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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Navegación */}
      <nav className="bg-indigo-950 text-white sticky top-0 z-50 shadow-2xl border-b border-indigo-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center text-sans">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-xl flex items-center justify-center">
              <span className="text-indigo-950 font-black text-xl">U</span>
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight leading-none">Planilla Control CD</h1>
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">UTN FRRe · Secretaría Académica</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-900/50 border border-indigo-700/50">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">{loading ? 'Sincronizando' : 'En Línea'}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {error && <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-700 text-sm font-bold flex items-center gap-2"><AlertCircle size={18}/> {error}</div>}

        {/* Dashboard */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200/60 text-sans">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6"><LayoutDashboard size={16} /> Avance del Lote 2026</h2>
            <div className="h-64"><Bar data={stats} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} /></div>
          </div>
          <div className="space-y-6 flex flex-col justify-center">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl text-white">
               <span className="text-7xl font-black block leading-none">{resoluciones.length}</span>
               <span className="text-xs font-black uppercase tracking-widest text-indigo-100">Proyectos Totales</span>
            </div>
            <div className="bg-emerald-500 p-8 rounded-[2.5rem] shadow-xl text-white">
               <span className="text-7xl font-black block leading-none">{resoluciones.filter(r => r.estado === 'firmada').length}</span>
               <span className="text-xs font-black uppercase tracking-widest text-emerald-50">Protocolizadas</span>
            </div>
          </div>
        </section>

        {/* Controles y Tabla */}
        <section className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden text-sans">
          <div className="p-6 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-center gap-4">
             <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-grow">
                  <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Filtrar por palabra clave..." 
                    className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-indigo-100 w-full md:w-64 transition-all" 
                    value={filtro} 
                    onChange={e => setFiltro(e.target.value)} 
                  />
                </div>
                <select 
                  className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none" 
                  value={areaFiltro} 
                  onChange={e => setAreaFiltro(e.target.value)}
                >
                  <option value="Todas">Todas las Áreas</option>
                  {areasFinales.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select 
                  className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none" 
                  value={estadoFiltro} 
                  onChange={e => setEstadoFiltro(e.target.value)}
                >
                  <option value="Todos">Todos los Estados</option>
                  {estados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => { const s = prompt("Sigla nueva área:"); if(s) addArea(s); }} 
                  className="bg-slate-100 text-slate-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Áreas
                </button>
                <button 
                  onClick={() => setShowAddModal(true)} 
                  className="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                  <Plus size={16} /> Nuevo Trámite
                </button>
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Resolución</th>
                  <th className="px-8 py-5">Origen / Sesión</th>
                  <th className="px-8 py-5">Fuerza Resolutiva</th>
                  <th className="px-8 py-5">Observaciones</th>
                  <th className="px-8 py-5">Estado</th>
                  <th className="px-8 py-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map(r => {
                  const currentEstado = estados.find(e => e.id === r.estado);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-6">
                         <span className="font-black text-slate-800 text-base block leading-none">{r.numero}</span>
                         <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">{r.anio}</span>
                      </td>
                      <td className="px-8 py-6">
                         <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase">{r.area}</span>
                         <span className="block text-[10px] text-slate-400 mt-1 italic">Ses. {r.sesion || '-'}</span>
                      </td>
                      <td className="px-8 py-6">
                         <span className="text-indigo-950 font-black text-sm block uppercase leading-tight mb-1">{r.tematica}</span>
                         <span className="text-[11px] text-slate-400 font-medium italic line-clamp-1">{r.interesado}</span>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-start max-w-[180px]">
                            {r.observaciones ? (
                              <span className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100 w-full">
                                 {r.observaciones}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">Sin observaciones</span>
                            )}
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border-2 ${currentEstado?.color || 'bg-slate-100 text-slate-400'} ${currentEstado?.border || 'border-slate-200'}`}>
                           {currentEstado?.label || 'Pendiente'}
                         </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                         <div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditItem(r)} className="text-slate-400 hover:text-indigo-600 p-2" title="Editar Trámite"><Edit2 size={16} /></button>
                            <button onClick={() => { if(confirm("¿Eliminar trámite?")) remove(r.id) }} className="text-slate-300 hover:text-red-600 p-2" title="Eliminar"><Trash2 size={16} /></button>
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
          <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl space-y-4 relative border border-white/20 animate-in fade-in zoom-in duration-200 text-sans">
            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors"><X size={28} /></button>
            <div className="flex items-center gap-3 mb-4">
               <div className="bg-indigo-100 p-4 rounded-3xl text-indigo-600"><Plus size={24} /></div>
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Nuevo Proyecto</h3>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Identificador (Nro/Año)</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Nro" required className="flex-1 p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.numero} onChange={e => setNuevaRes({...nuevaRes, numero: e.target.value})} />
                    <input type="text" placeholder="Año" required className="w-24 p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.anio} onChange={e => setNuevaRes({...nuevaRes, anio: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sesión CD</label>
                  <input type="text" placeholder="Ej: 01/26" className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.sesion} onChange={e => setNuevaRes({...nuevaRes, sesion: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Área Origen</label>
                  <select className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-black focus:ring-2 focus:ring-indigo-100" value={nuevaRes.area} onChange={e => setNuevaRes({...nuevaRes, area: e.target.value})}>
                     {areasFinales.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Interesado</label>
                  <input type="text" placeholder="Nombre completo" required className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={nuevaRes.interesado} onChange={e => setNuevaRes({...nuevaRes, interesado: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fuerza Resolutiva (Art. 1)</label>
                <input type="text" placeholder="Ej: EQUIVALENCIA" required className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm uppercase font-black text-indigo-900 focus:ring-2 focus:ring-indigo-100" value={nuevaRes.tematica} onChange={e => setNuevaRes({...nuevaRes, tematica: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Observaciones</label>
                <textarea className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" placeholder="Anotaciones técnicas..." value={nuevaRes.observaciones} onChange={e => setNuevaRes({...nuevaRes, observaciones: e.target.value})} rows="3" />
              </div>
              <div className="pt-4 flex gap-3">
                 <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-[1.5rem] shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Registrar Trámite</button>
                 <button type="button" onClick={() => setShowAddModal(false)} className="px-8 bg-slate-100 text-slate-500 font-bold py-4 rounded-[1.5rem] uppercase text-xs">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Proyecto */}
      {editItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl space-y-4 relative border border-white/20 animate-in fade-in zoom-in duration-200 text-sans">
            <button onClick={() => setEditItem(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors"><X size={28} /></button>
            <div className="flex items-center gap-3 mb-4">
               <div className="bg-indigo-100 p-4 rounded-3xl text-indigo-600"><Edit2 size={24} /></div>
               <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Editar Trámite</h3>
            </div>
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Número</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={editItem.numero} onChange={e => setEditItem({...editItem, numero: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Año</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={editItem.anio} onChange={e => setEditItem({...editItem, anio: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sesión CD</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={editItem.sesion || ''} onChange={e => setEditItem({...editItem, sesion: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Estado</label>
                  <select className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-black focus:ring-2 focus:ring-indigo-100" value={editItem.estado} onChange={e => setEditItem({...editItem, estado: e.target.value})}>
                     {estados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Temática</label>
                <input type="text" className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm uppercase font-black text-indigo-900 focus:ring-2 focus:ring-indigo-100" value={editItem.tematica} onChange={e => setEditItem({...editItem, tematica: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Interesado</label>
                <input type="text" className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={editItem.interesado} onChange={e => setEditItem({...editItem, interesado: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Observaciones</label>
                <textarea className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100" value={editItem.observaciones || ''} onChange={e => setEditItem({...editItem, observaciones: e.target.value})} rows="3" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-[1.5rem] shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}