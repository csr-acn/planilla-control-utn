import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  FileText,
  Download,
  Upload,
  Calendar,
  Eye
} from 'lucide-react';

// Registro de componentes de Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// --- Configuración de Conexión a Supabase ---
const SUPABASE_URL = "https://jtdcidvhhdktchigovsn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZGNpZHZoaGRrdGNoaWdvdnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM0MjEsImV4cCI6MjA4NzkzOTQyMX0.FjhRZeamDl8J3Kkm6O8u74DxToSsQiAo1a58IX_vTxI";

const AREAS_BASE = [
  'ACTAS', 
  'ALUMNADO', 
  'CARRERA ACADÉMICA', 
  'CONC', 
  'DESPACHO', 
  'OTROS', 
  'RRHH', 
  'SADMIN', 
  'SAU', 
  'SCYT', 
  'SACAD', 
  'SEU', 
  'TITULOS'
];

export default function App() {
  const [supabase] = useState(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  const [resoluciones, setResoluciones] = useState([]);
  const [estados, setEstados] = useState([]);
  const [areasExtra, setAreasExtra] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Estados para Filtros y UI
  const [filtro, setFiltro] = useState('');
  const [areaFiltro, setAreaFiltro] = useState('Todas');
  const [estadoFiltro, setEstadoFiltro] = useState('Todos');
  const [anioFiltro, setAnioFiltro] = useState(''); 
  
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigEstados, setShowConfigEstados] = useState(false);
  
  const [nuevaRes, setNuevaRes] = useState({ 
    numero: '', anio: new Date().getFullYear().toString(), area: 'ALUMNADO', sesion: '', 
    tematica: '', interesado: '', estado: 'sin-redactar', observaciones: '' 
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: res, error: resErr } = await supabase.from('resoluciones').select('*').order('created_at', { ascending: false });
      const { data: est, error: estErr } = await supabase.from('estados').select('*').order('orden', { ascending: true });
      const { data: ars, error: arsErr } = await supabase.from('config_areas').select('sigla');
      
      if (resErr || estErr || arsErr) throw new Error("Error al obtener datos");

      setResoluciones(res || []);
      setEstados(est || []);
      setAreasExtra(ars?.map(a => a.sigla) || []);
      setError(null);
    } catch (err) {
      setError("Error de conexión con la base de datos.");
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

  const areasFinales = useMemo(() => [...new Set([...AREAS_BASE, ...areasExtra])].sort(), [areasExtra]);
  
  // LÓGICA DE FILTRADO UNIFICADA
  const filtradas = useMemo(() => resoluciones.filter(r => {
    const matchBusqueda = `${r.numero} ${r.tematica} ${r.interesado} ${r.observaciones || ''}`.toLowerCase().includes(filtro.toLowerCase());
    const matchArea = areaFiltro === 'Todas' || r.area === areaFiltro;
    const matchEstado = estadoFiltro === 'Todos' || r.estado === estadoFiltro;
    const matchAnio = anioFiltro === '' || r.anio.toString().includes(anioFiltro);
    return matchBusqueda && matchArea && matchEstado && matchAnio;
  }), [resoluciones, filtro, areaFiltro, estadoFiltro, anioFiltro]);

  // MAPEO DE COLORES TAILWIND
  const tailwindToHex = {
    amber: '#f59e0b',
    emerald: '#10b981',
    blue: '#3b82f6',
    red: '#ef4444',
    indigo: '#6366f1',
    slate: '#94a3b8',
    yellow: '#eab308',
    green: '#22c55e'
  };

  // EL GRÁFICO AHORA DEPENDE DE 'filtradas'
  const stats = useMemo(() => {
    return {
      labels: estados.map(e => e.label),
      datasets: [{
        data: estados.map(e => filtradas.filter(r => r.estado === e.id).length),
        backgroundColor: estados.map(e => {
          const colorName = e.color?.split('-')[1] || 'slate'; 
          return tailwindToHex[colorName] || '#94a3b8';
        }),
        borderRadius: 8
      }]
    };
  }, [filtradas, estados]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const { error: err } = await supabase.from('resoluciones').insert([{ ...nuevaRes, tematica: nuevaRes.tematica.toUpperCase() }]);
    if (!err) {
      setNuevaRes({ numero: '', anio: new Date().getFullYear().toString(), area: 'ALUMNADO', sesion: '', tematica: '', interesado: '', estado: estados[0]?.id || 'sin-redactar', observaciones: '' });
      setShowAddModal(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const { error: err } = await supabase.from('resoluciones').update({
        numero: editItem.numero,
        anio: editItem.anio,
        area: editItem.area,
        sesion: editItem.sesion,
        tematica: editItem.tematica.toUpperCase(),
        interesado: editItem.interesado,
        estado: editItem.estado,
        observaciones: editItem.observaciones
    }).eq('id', editItem.id);
    if (!err) setEditItem(null);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(resoluciones, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo_resoluciones_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        if (!Array.isArray(jsonData)) throw new Error("Inválido");
        setLoading(true);
        await supabase.from('resoluciones').upsert(jsonData);
        alert("Importación exitosa");
        fetchData();
      } catch (err) { alert("Error al importar el archivo."); }
      finally { setLoading(false); e.target.value = null; }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 antialiased pb-10">
      <nav className="bg-indigo-950 text-white sticky top-0 z-50 shadow-xl border-b border-indigo-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-xl shadow-md flex items-center justify-center min-w-[44px] h-12">
               <img src="/logo-frre.png" alt="Logo" className="h-10 w-auto" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
               <span className="hidden text-indigo-950 font-black text-xl leading-none">U</span>
            </div>
            <div>
              <h1 className="text-sm md:text-lg font-bold tracking-tight uppercase leading-none">App de Resoluciones de Consejo Directivo</h1>
              <p className="text-indigo-300 text-[10px] font-medium uppercase tracking-widest mt-1">Secretaría Académica · UTN FRRe</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setShowConfigEstados(true)} className="p-2 hover:bg-indigo-800 rounded-lg text-indigo-200 transition-colors"><Settings size={20} /></button>
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-900/50 border border-indigo-700/50">
               <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
               <span className="text-[10px] font-bold uppercase text-indigo-100 leading-none">{loading ? 'Sync' : 'Online'}</span>
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {error && <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-700 text-sm font-semibold flex items-center gap-2 animate-bounce"><AlertCircle size={18}/> {error}</div>}

        {/* Dashboard Dinámico Sincronizado */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><LayoutDashboard size={14}/> Análisis del Filtro Actual</h2>
               <div className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-3 py-1 rounded-lg">
                  Visualizando: {filtradas.length} Trámites
               </div>
            </div>
            <div className="h-64">
              <Bar 
                data={stats} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false, 
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, 
                  plugins: { legend: { display: false } } 
                }} 
              />
            </div>
          </div>
          <div className="space-y-4 flex flex-col justify-center">
             <div className="bg-white p-6 rounded-[2rem] border border-slate-200 flex items-center justify-between shadow-sm transition-all hover:shadow-md">
                <div><span className="text-xs font-bold text-slate-400 block mb-1 uppercase tracking-wider">Trámites en Selección</span><span className="text-4xl font-black text-slate-800 leading-none">{filtradas.length}</span></div>
                <Database className="text-indigo-100 w-12 h-12" />
             </div>
             <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 flex items-center justify-between shadow-sm transition-all hover:shadow-md">
                <div><span className="text-xs font-bold text-emerald-600/60 block mb-1 uppercase tracking-wider leading-none">Protocolizados (Filtro)</span><span className="text-4xl font-black text-emerald-700 leading-none">{filtradas.filter(r => r.estado === 'firmada').length}</span></div>
                <CheckCircle className="text-emerald-200 w-12 h-12" />
             </div>
          </div>
        </section>

        {/* Listado Principal */}
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-center gap-4 border-b border-slate-100">
             <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-grow max-w-md w-full md:w-64">
                  <Search className="absolute left-4 top-3 text-slate-400" size={16} />
                  <input type="text" placeholder="Buscar temática o interesado..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none w-full shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all" value={filtro} onChange={e => setFiltro(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <select className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none" value={areaFiltro} onChange={e => setAreaFiltro(e.target.value)}>
                    <option value="Todas">Áreas</option>
                    {areasFinales.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
                    <option value="Todos">Estados</option>
                    {estados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                  <div className="relative w-24">
                    <Calendar className="absolute left-3 top-3 text-slate-400" size={14} />
                    <input type="text" placeholder="Año" className="pl-9 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none w-full shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all" value={anioFiltro} onChange={e => setAnioFiltro(e.target.value)} />
                  </div>
                </div>
             </div>
             
             <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
                <div className="flex gap-1 border-r pr-2 border-slate-200">
                   <button onClick={handleExport} className="bg-white text-slate-600 border border-slate-200 p-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm" title="Exportar JSON"><Download size={16} /></button>
                   <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-600 border border-slate-200 p-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm" title="Importar JSON"><Upload size={16} /></button>
                   <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                </div>
                <button onClick={() => { const s = prompt("Nueva sigla:"); if(s) supabase.from('config_areas').insert([{ sigla: s.toUpperCase() }]); }} className="bg-white text-slate-500 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm">Áreas</button>
                <button onClick={() => setShowAddModal(true)} className="flex-grow bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><Plus size={16}/> Nuevo Trámite</button>
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr><th className="px-8 py-4">Resolución</th><th className="px-8 py-4">Sesión CD</th><th className="px-8 py-4">Fuerza Resolutiva</th><th className="px-8 py-4">Estado</th><th className="px-8 py-4 text-center">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {filtradas.map(r => {
                  const currentEstado = estados.find(e => e.id === r.estado);
                  // Derivamos las clases de color de forma segura
                  const colorFamily = currentEstado?.color?.split('-')[1] || 'slate';
                  const bgClass = `bg-${colorFamily}-50`;
                  const textClass = `text-${colorFamily}-700`;
                  const borderClass = `border-${colorFamily}-200`;

                  return (
                    <tr key={r.id} className="hover:bg-indigo-50/10 transition-colors group">
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-1 font-bold text-slate-800">
                            <span>{r.numero}</span><span className="text-slate-300">/</span><span>{r.anio}</span>
                         </div>
                         <span className="text-[9px] font-bold text-indigo-400 uppercase mt-1 block tracking-tighter leading-none">{r.area}</span>
                      </td>
                      <td className="px-8 py-5 text-xs text-slate-500 italic leading-none">{r.sesion || 'N/A'}</td>
                      <td className="px-8 py-5">
                         <span className="text-indigo-950 font-bold block leading-tight mb-0.5 uppercase tracking-tight">{r.tematica}</span>
                         <span className="text-[11px] text-slate-400 font-medium line-clamp-1 leading-none">{r.interesado}</span>
                         {r.observaciones && (
                           <div className="mt-1 text-[10px] text-slate-500 italic max-w-[350px] whitespace-normal break-words leading-relaxed" title={r.observaciones}>
                             {r.observaciones}
                           </div>
                         )}
                      </td>
                      <td className="px-8 py-5">
                         <span className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded-full border leading-none ${bgClass} ${textClass} ${borderClass}`}>
                           {currentEstado?.label || 'Pendiente'}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-center flex items-center justify-center gap-2">
                        <button onClick={() => setViewItem(r)} className="text-slate-500 hover:bg-slate-50 p-2 border border-slate-100 rounded-xl transition-all shadow-sm" title="Ver Detalles"><Eye size={14} /></button>
                        <button onClick={() => setEditItem(r)} className="text-indigo-600 hover:bg-indigo-50 p-2 border border-indigo-100 rounded-xl transition-all shadow-sm" title="Editar"><Edit2 size={14} /></button>
                        <button onClick={async () => { if(confirm("¿Eliminar trámite?")) await supabase.from('resoluciones').delete().eq('id', r.id) }} className="text-red-500 hover:bg-red-50 p-2 border border-red-100 rounded-xl transition-all shadow-sm" title="Eliminar"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* MODAL: VISUALIZACIÓN */}
      {viewItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-2xl w-full shadow-2xl relative border border-white/20">
             <button onClick={() => setViewItem(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600"><X size={24} /></button>
             <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-5">
               <div className="bg-slate-100 p-3 rounded-2xl text-slate-600 shadow-sm"><FileText size={20} /></div>
               <div>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none uppercase">Detalles del Trámite</h3>
                  <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-widest italic text-nowrap">Consulta de Registro</p>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
               <div><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Número / Año de Resolución</label><p className="text-lg font-black text-slate-800">{viewItem.numero} / {viewItem.anio}</p></div>
               <div><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Estado</label><span className={`text-[9px] font-bold uppercase px-3 py-1.5 rounded-full border bg-${viewItem.estado?.split('-')[1] || 'slate'}-50 text-${viewItem.estado?.split('-')[1] || 'slate'}-700 border-${viewItem.estado?.split('-')[1] || 'slate'}-200`}>{estados.find(e => e.id === viewItem.estado)?.label || 'Desconocido'}</span></div>
               <div><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Área</label><p className="text-sm font-bold text-indigo-600 uppercase leading-none">{viewItem.area}</p></div>
               <div><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sesión CD</label><p className="text-sm font-medium text-slate-600 leading-none">{viewItem.sesion || 'Sin especificar'}</p></div>
               <div className="col-span-2"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Temática del Proyecto</label><p className="text-sm font-black text-indigo-950 uppercase bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50">{viewItem.tematica}</p></div>
               <div className="col-span-2"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Interesado/Asignatura/Departamento/Área</label><p className="text-sm font-medium text-slate-700 leading-tight">{viewItem.interesado}</p></div>
               <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Observaciones</label><p className="text-xs text-slate-500 leading-relaxed italic">{viewItem.observaciones || 'No hay observaciones.'}</p></div>
            </div>
            <button onClick={() => setViewItem(null)} className="w-full mt-8 bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs">Cerrar Visualización</button>
          </div>
        </div>
      )}

      {/* MODAL: ALTA */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-2xl w-full shadow-2xl relative border border-white/20 overflow-y-auto max-h-[95vh]">
             <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors"><X size={24} /></button>
             <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-5">
               <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600 shadow-sm"><FileText size={20} /></div>
               <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none uppercase">Nuevo Registro de Trámite</h3>
            </div>
             <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex justify-between">
                        <span>Número de Resolución</span>
                        <span>Año</span>
                      </label>
                      <div className="flex gap-2">
                         <input type="text" placeholder="Nro" required className="flex-1 p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" value={nuevaRes.numero} onChange={e => setNuevaRes({...nuevaRes, numero: e.target.value})} />
                         <input type="text" placeholder="Año" required className="w-24 p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" value={nuevaRes.anio} onChange={e => setNuevaRes({...nuevaRes, anio: e.target.value})} />
                      </div>
                   </div>
                   <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-1">Estado</label><select className="w-full p-3.5 bg-indigo-50 rounded-xl border-none outline-none text-xs font-bold text-indigo-700 shadow-sm" value={nuevaRes.estado} onChange={e => setNuevaRes({...nuevaRes, estado: e.target.value})}>{estados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-1 leading-none">Sesión de Consejo Directivo</label><input type="text" placeholder="Ej: Octava Reunión Ordinaria 2026" className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" value={nuevaRes.sesion} onChange={e => setNuevaRes({...nuevaRes, sesion: e.target.value})} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-1 leading-none">Área Responsable</label><select className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-bold focus:ring-2 focus:ring-indigo-100 shadow-sm" value={nuevaRes.area} onChange={e => setNuevaRes({...nuevaRes, area: e.target.value})}>{areasFinales.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                   <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-1 leading-none">Interesado/Asignatura/Departamento/Área</label><input type="text" placeholder="Nombre completo o Referencia" required className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm focus:ring-2 focus:ring-indigo-100 shadow-sm" value={nuevaRes.interesado} onChange={e => setNuevaRes({...nuevaRes, interesado: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-1 leading-none">Temática del Proyecto</label><input type="text" placeholder="Ej: READMISION" required className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm font-bold uppercase text-indigo-900 focus:ring-2 focus:ring-indigo-100 shadow-sm" value={nuevaRes.tematica} onChange={e => setNuevaRes({...nuevaRes, tematica: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-1 leading-none">Observaciones de Control</label><textarea placeholder="Anotaciones para la gestión..." className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none text-sm focus:ring-2 focus:ring-indigo-100 shadow-sm" rows="3" value={nuevaRes.observaciones} onChange={e => setNuevaRes({...nuevaRes, observaciones: e.target.value})} /></div>
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                   <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Registrar Trámite</button>
                   <button type="button" onClick={() => setShowAddModal(false)} className="px-8 bg-slate-50 text-slate-400 font-bold py-4 rounded-2xl uppercase text-xs hover:bg-slate-100 transition-colors">Cerrar</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: EDICIÓN */}
      {editItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-2xl w-full shadow-2xl relative border border-white/20 overflow-y-auto max-h-[95vh]">
             <button onClick={() => setEditItem(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"><X size={24} /></button>
             <h3 className="text-xl font-bold text-slate-800 mb-8 border-b pb-5 uppercase tracking-tight">Actualizar Información</h3>
             <form onSubmit={handleUpdateSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex justify-between">
                      <span>Número</span>
                      <span>Año</span>
                    </label>
                    <div className="flex gap-2">
                      <input type="text" className="flex-1 p-3.5 bg-slate-50 rounded-xl transition-all shadow-sm outline-none border-none focus:ring-2 focus:ring-indigo-100" value={editItem.numero} onChange={e => setEditItem({...editItem, numero: e.target.value})} />
                      <input type="text" className="w-24 p-3.5 bg-slate-50 rounded-xl transition-all shadow-sm outline-none border-none focus:ring-2 focus:ring-indigo-100" value={editItem.anio} onChange={e => setEditItem({...editItem, anio: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase leading-none">Estado</label><select className="w-full p-3.5 bg-indigo-50 rounded-xl font-bold text-indigo-700 shadow-sm border-none outline-none transition-all" value={editItem.estado} onChange={e => setEditItem({...editItem, estado: e.target.value})}>{estados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase leading-none">Sesión CD</label><input type="text" className="w-full p-3.5 bg-slate-50 rounded-xl transition-all shadow-sm outline-none border-none focus:ring-2 focus:ring-indigo-100" value={editItem.sesion || ''} onChange={e => setEditItem({...editItem, sesion: e.target.value})} /></div>
                  <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase leading-none">Área</label><select className="w-full p-3.5 bg-slate-50 rounded-xl font-bold transition-all shadow-sm outline-none border-none focus:ring-2 focus:ring-indigo-100" value={editItem.area} onChange={e => setEditItem({...editItem, area: e.target.value})}>{areasFinales.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase leading-none">Temática</label><input type="text" className="w-full p-3.5 bg-slate-50 rounded-xl font-bold uppercase text-indigo-900 shadow-sm border-none outline-none transition-all focus:ring-2 focus:ring-indigo-100" value={editItem.tematica} onChange={e => setEditItem({...editItem, tematica: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase leading-none">Interesado/Asignatura/Departamento/Área</label><input type="text" className="w-full p-3.5 bg-slate-50 rounded-xl font-medium shadow-sm border-none outline-none transition-all focus:ring-2 focus:ring-indigo-100" value={editItem.interesado} onChange={e => setEditItem({...editItem, interesado: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase leading-none">Observaciones</label><textarea className="w-full p-3.5 bg-slate-50 rounded-xl shadow-sm border-none outline-none transition-all focus:ring-2 focus:ring-indigo-100" rows="3" value={editItem.observaciones || ''} onChange={e => setEditItem({...editItem, observaciones: e.target.value})} /></div>
                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">Guardar Cambios</button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: PROTOCOLO DE ESTADOS */}
      {showConfigEstados && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold uppercase text-slate-800 tracking-tight leading-none">Protocolo de Estados</h3>
              <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                {estados.map(est => (
                  <div key={est.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all">
                     <input type="text" className="flex-1 bg-white border-none rounded p-1.5 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-100" value={est.label} onChange={async (e) => await supabase.from('estados').update({ label: e.target.value }).eq('id', est.id)} />
                     <input type="number" className="w-12 text-center bg-white rounded p-1.5 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-100" value={est.orden} onChange={async (e) => await supabase.from('estados').update({ orden: parseInt(e.target.value) }).eq('id', est.id)} />
                  </div>
                ))}
              </div>
              <button onClick={() => setShowConfigEstados(false)} className="w-full bg-slate-900 text-white py-3 rounded-xl uppercase font-bold text-[10px] tracking-widest hover:bg-slate-800 transition-all">Cerrar</button>
           </div>
        </div>
      )}
    </div>
  );
}