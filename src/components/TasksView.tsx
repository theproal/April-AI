import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Download,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import type { AprilTask, GoogleTaskRemote, TaskCategory } from '../types';
import {
  buildGoogleMapsUrl,
  downloadTaskAsIcs,
  formatTasksDigestForMessaging,
  shareViaAndroidSheet,
} from '../services/officialIntegrations';

interface TasksViewProps {
  tasks: AprilTask[];
  googleTasks: GoogleTaskRemote[];
  googleConnected: boolean;
  todayIso: string;
  onNewTask: () => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: AprilTask) => void;
  onDeleteTask: (id: string) => void;
  onSendTaskWhatsApp: (task: AprilTask) => void;
  onSendDigestWhatsApp: (message: string) => void;
  onSyncTaskToGoogleTasks: (task: AprilTask) => void;
  onToggleRemoteGoogleTask: (task: GoogleTaskRemote) => void;
  onDeleteRemoteGoogleTask: (task: GoogleTaskRemote) => void;
}

type StatusFilter = 'pendientes' | 'hoy' | 'todas' | 'completadas';
const CATEGORIES: Array<'Todas' | TaskCategory> = ['Todas', 'Personal', 'Trabajo', 'Hogar', 'Salud'];

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  googleTasks,
  googleConnected,
  todayIso,
  onNewTask,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onSendTaskWhatsApp,
  onSendDigestWhatsApp,
  onSyncTaskToGoogleTasks,
  onToggleRemoteGoogleTask,
  onDeleteRemoteGoogleTask,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pendientes');
  const [categoryFilter, setCategoryFilter] = useState<'Todas' | TaskCategory>('Todas');
  const [search, setSearch] = useState('');
  const [shareNote, setShareNote] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (statusFilter === 'pendientes' && t.completed) return false;
        if (statusFilter === 'completadas' && !t.completed) return false;
        if (statusFilter === 'hoy' && t.dueDate !== todayIso) return false;
        if (categoryFilter !== 'Todas' && t.category !== categoryFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            t.title.toLowerCase().includes(q) ||
            (t.notes ?? '').toLowerCase().includes(q) ||
            (t.location ?? '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [tasks, statusFilter, categoryFilter, search, todayIso]);

  const handleAndroidShare = async () => {
    const digest = formatTasksDigestForMessaging(tasks);
    const shared = await shareViaAndroidSheet('Mis tareas — April IA', digest).catch(() => false);
    if (!shared) {
      await navigator.clipboard?.writeText(digest).catch(() => undefined);
      setShareNote('Lista copiada al portapapeles para pegar en cualquier app.');
      setTimeout(() => setShareNote(null), 3000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto touch-scroll px-3.5 py-4 sm:px-8 sm:py-7 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Organizador de tareas</h1>
          <p className="text-xs sm:text-sm text-[#c38bff] mt-0.5">
            Gestiona tus pendientes y compártelos directo con tus apps oficiales.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onSendDigestWhatsApp(formatTasksDigestForMessaging(tasks))}
            className="min-h-[44px] px-3.5 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4 text-[#c000ff]" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handleAndroidShare}
            className="min-h-[44px] px-3.5 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartir</span>
          </button>
          <button
            type="button"
            onClick={onNewTask}
            className="flex-1 sm:flex-none min-h-[44px] px-4 rounded-[10px] bg-[#8500e8] hover:bg-[#a000ff] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva tarea</span>
          </button>
        </div>
      </div>

      {shareNote && (
        <div className="rounded-xl border border-[#8500ff] bg-[#1b0b2d] px-4 py-2.5 text-xs font-medium text-[#d9aaff]">
          {shareNote}
        </div>
      )}

      {/* Búsqueda + Filtros */}
      <div className="rounded-2xl bg-[#10051d] border border-[#6500a8] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#987cae] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              enterKeyHint="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tareas, notas o lugares..."
              className="w-full min-h-[44px] rounded-xl border border-[#8500ff] bg-[#170925] pl-10 pr-3.5 text-base sm:text-sm text-white placeholder:text-[#987cae] focus:outline-none focus:ring-2 focus:ring-[#c000ff]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#170925] border border-[#6500a8] overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'pendientes', label: 'Pendientes' },
                { id: 'hoy', label: 'Hoy' },
                { id: 'todas', label: 'Todas' },
                { id: 'completadas', label: 'Listas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[44px] px-3.5 rounded-lg text-xs font-medium transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-[#8500d9] text-white'
                    : 'text-[#c38bff] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[44px] px-3.5 rounded-lg text-xs font-medium transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#8500e8] text-white'
                  : 'bg-[#1b0b2d] text-[#d9b5ff] hover:bg-[#6500a8]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Tareas */}
      <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#d9aaff]">No hay tareas en esta vista</p>
            <p className="text-xs text-[#987cae] mt-1">
              Toca &quot;Nueva tarea&quot; para agregar una o cambia los filtros.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#6500a8]/40">
            {filteredTasks.map((task) => (
              <li
                key={task.id}
                className="px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-[#1b0b2d]/70 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  aria-label={task.completed ? `Marcar "${task.title}" pendiente` : `Completar "${task.title}"`}
                  className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center shrink-0"
                >
                  <span
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${
                      task.completed
                        ? 'bg-[#8500e8] border-[#c000ff] text-white'
                        : 'border-[#8500ff] bg-[#170925]'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  className="flex-1 min-w-0 text-left py-1"
                >
                  <p
                    className={`text-sm font-medium leading-snug ${
                      task.completed ? 'line-through text-[#987cae]' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#c38bff]">
                    <span className="font-mono tabular-nums">{task.dueDate}</span>
                    {task.dueTime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{task.dueTime}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{task.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className={task.priority === 'alta' && !task.completed ? 'text-[#ff85b3] font-medium' : ''}>
                      Prioridad {task.priority}
                    </span>
                  </div>
                  {task.notes && (
                    <p className="mt-1 text-xs text-[#987cae] line-clamp-1">{task.notes}</p>
                  )}
                </button>

                <div className="flex items-center shrink-0">
                  {task.location && (
                    <a
                      href={buildGoogleMapsUrl(task.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en Google Maps"
                      aria-label={`Abrir ${task.location} en Google Maps`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-white active:scale-95"
                    >
                      <MapPin className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onSendTaskWhatsApp(task)}
                    title="Enviar por WhatsApp"
                    aria-label={`Enviar "${task.title}" por WhatsApp`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-white active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  {googleConnected && !task.googleTaskId && (
                    <button
                      type="button"
                      onClick={() => onSyncTaskToGoogleTasks(task)}
                      title="Guardar en Google Tasks"
                      aria-label={`Guardar "${task.title}" en Google Tasks`}
                      className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#c38bff] hover:text-white"
                    >
                      <CalendarPlus className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadTaskAsIcs(task)}
                    title="Descargar evento .ics para calendario"
                    aria-label={`Exportar "${task.title}" a calendario .ics`}
                    className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#c38bff] hover:text-white"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    title="Eliminar tarea"
                    aria-label={`Eliminar "${task.title}"`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-[#ff6ea0] active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Google Tasks Oficial */}
      {googleConnected && (
        <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#6500a8]/60 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Google Tasks oficial</h2>
              <p className="text-xs text-[#c38bff]">
                Sincronizado directamente con tu cuenta de Google
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#d9b5ff]">
              {googleTasks.length} elementos
            </span>
          </div>

          {googleTasks.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-[#987cae]">
              No tienes tareas en tu lista principal de Google Tasks.
            </p>
          ) : (
            <ul className="divide-y divide-[#6500a8]/40">
              {googleTasks.map((gt) => {
                const done = gt.status === 'completed';
                return (
                  <li key={gt.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleRemoteGoogleTask(gt)}
                      aria-label={done ? `Reabrir ${gt.title} en Google Tasks` : `Completar ${gt.title} en Google Tasks`}
                      className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center shrink-0"
                    >
                      <span
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                          done ? 'bg-[#8500e8] border-[#c000ff] text-white' : 'border-[#8500ff] bg-[#170925]'
                        }`}
                      >
                        {done && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${done ? 'line-through text-[#987cae]' : 'text-white'}`}>
                        {gt.title}
                      </p>
                      <p className="text-xs text-[#c38bff] mt-0.5">
                        {gt.listTitle}
                        {gt.due ? ` · ${gt.due}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteRemoteGoogleTask(gt)}
                      aria-label={`Eliminar ${gt.title} de Google Tasks`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-[#ff6ea0]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
