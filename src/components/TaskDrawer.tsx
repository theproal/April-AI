import React, { useEffect, useState } from 'react';
import { Calendar, CalendarPlus, Clock, Download, MapPin, X } from 'lucide-react';
import type { AprilTask, TaskCategory, TaskPriority } from '../types';
import { downloadTaskAsIcs } from '../services/officialIntegrations';

interface TaskDrawerProps {
  open: boolean;
  initialTask?: AprilTask | null;
  defaultDate: string;
  googleConnected: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<AprilTask, 'id' | 'createdAt' | 'completed'>,
    options: { syncToGoogleTasks: boolean; addToGoogleCalendar: boolean }
  ) => void;
  onSyncToGoogleTasks?: (task: AprilTask) => void;
}

const CATEGORIES: TaskCategory[] = ['Personal', 'Trabajo', 'Hogar', 'Salud'];
const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  open,
  initialTask,
  defaultDate,
  googleConnected,
  onClose,
  onSave,
  onSyncToGoogleTasks,
}) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDate);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('media');
  const [category, setCategory] = useState<TaskCategory>('Personal');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [syncToGoogleTasks, setSyncToGoogleTasks] = useState(false);
  const [addToGoogleCalendar, setAddToGoogleCalendar] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialTask) {
        setTitle(initialTask.title);
        setDueDate(initialTask.dueDate);
        setDueTime(initialTask.dueTime || '');
        setPriority(initialTask.priority);
        setCategory(initialTask.category);
        setLocation(initialTask.location || '');
        setNotes(initialTask.notes || '');
      } else {
        setTitle('');
        setDueDate(defaultDate);
        setDueTime('');
        setPriority('media');
        setCategory('Personal');
        setLocation('');
        setNotes('');
      }
      setSyncToGoogleTasks(false);
      setAddToGoogleCalendar(false);
    }
  }, [open, initialTask, defaultDate]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(
      {
        title: title.trim(),
        dueDate,
        dueTime: dueTime.trim() || undefined,
        priority,
        category,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        source: 'april',
      },
      { syncToGoogleTasks, addToGoogleCalendar }
    );
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-drawer-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto touch-scroll rounded-t-3xl sm:rounded-2xl bg-[#10051d] border border-[#8500ff] p-5 pb-safe sm:p-6 shadow-2xl"
      >
        <div className="mx-auto mb-3.5 h-1.5 w-10 rounded-full bg-[#6500a8] sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h2 id="task-drawer-title" className="text-lg font-semibold text-white">
            {initialTask ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:bg-[#1b0b2d] active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#c38bff] mb-1.5">
              ¿Qué necesitas hacer?
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Pagar recibo de luz o llamar al médico"
              className="w-full min-h-[46px] rounded-xl border border-[#8500ff] bg-[#170925] px-3.5 text-base sm:text-sm text-white placeholder:text-[#987cae] focus:outline-none focus:ring-2 focus:ring-[#c000ff]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#c38bff] mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fecha
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#6500a8] bg-[#170925] px-3 text-base sm:text-sm text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#c000ff]"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#c38bff] mb-1.5">
                <Clock className="w-3.5 h-3.5" />
                Hora (opcional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#6500a8] bg-[#170925] px-3 text-base sm:text-sm text-white font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#c000ff]"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#c38bff] mb-1.5">Categoría</span>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`min-h-[44px] rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                    category === cat
                      ? 'bg-[#8500e8] text-white'
                      : 'bg-[#1b0b2d] text-[#d9b5ff] border border-[#6500a8]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#c38bff] mb-1.5">Prioridad</span>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`min-h-[44px] rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                    priority === p.value
                      ? 'bg-[#9900ed] text-white'
                      : 'bg-[#1b0b2d] text-[#d9b5ff] border border-[#6500a8]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#c38bff] mb-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Lugar o dirección (abre en Google Maps)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej. Clínica Centro o Av. Reforma 222"
              className="w-full min-h-[44px] rounded-xl border border-[#6500a8] bg-[#170925] px-3.5 text-base sm:text-sm text-white placeholder:text-[#987cae] focus:outline-none focus:ring-2 focus:ring-[#c000ff]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#c38bff] mb-1.5">Notas</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales o recordatorios..."
              className="w-full rounded-xl border border-[#6500a8] bg-[#170925] p-3 text-base sm:text-sm text-white placeholder:text-[#987cae] focus:outline-none focus:ring-2 focus:ring-[#c000ff]"
            />
          </div>

          {initialTask && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-[#6500a8]/50">
              <button
                type="button"
                onClick={() => downloadTaskAsIcs(initialTask)}
                className="min-h-[44px] px-3.5 rounded-xl border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-2 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Exportar .ics</span>
              </button>
              {googleConnected && !initialTask.googleTaskId && onSyncToGoogleTasks && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncToGoogleTasks(initialTask);
                    onClose();
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-2 active:scale-95"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Guardar en Google Tasks</span>
                </button>
              )}
            </div>
          )}

          {!initialTask && googleConnected && (
            <div className="space-y-2 pt-1 border-t border-[#6500a8]/50">
              <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToGoogleTasks}
                  onChange={(e) => setSyncToGoogleTasks(e.target.checked)}
                  className="w-5 h-5 accent-[#c000ff] rounded"
                />
                <span className="text-sm text-[#d9aaff]">
                  Guardar también en Google Tasks oficial (pedirá confirmación)
                </span>
              </label>
              <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToGoogleCalendar}
                  onChange={(e) => setAddToGoogleCalendar(e.target.checked)}
                  className="w-5 h-5 accent-[#c000ff] rounded"
                />
                <span className="text-sm text-[#d9aaff]">
                  Agendar bloque en Google Calendar (pedirá confirmación)
                </span>
              </label>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] rounded-xl border border-[#6500a8] bg-[#1b0b2d] text-sm font-medium text-[#d9b5ff] hover:bg-[#6500a8]/40 active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[48px] rounded-xl bg-[#8500e8] hover:bg-[#a000ff] text-white text-sm font-medium transition-all active:scale-95"
            >
              {initialTask ? 'Guardar cambios' : 'Agregar tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
