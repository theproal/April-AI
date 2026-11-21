import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { AprilTask, CalendarEventItem, EmailInsight } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { buildGoogleMapsUrl } from '../services/officialIntegrations';

interface TodayViewProps {
  tasks: AprilTask[];
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
  onQuickAddTask: (title: string, date: string) => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: AprilTask) => void;
  onDeleteTask: (id: string) => void;
  onSendTaskWhatsApp: (task: AprilTask) => void;
  onAskAprilOrganize: () => void;
  onCreateTaskFromEmail: (email: EmailInsight) => void;
  calendarEvents: CalendarEventItem[];
  emailInsights: EmailInsight[];
  googleConnected: boolean;
  isSyncingGoogle: boolean;
  onConnectGoogle: () => void;
  onRefreshGoogle: () => void;
}

function getLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const TodayView: React.FC<TodayViewProps> = ({
  tasks,
  selectedDate,
  onSelectDate,
  onQuickAddTask,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onSendTaskWhatsApp,
  onAskAprilOrganize,
  onCreateTaskFromEmail,
  calendarEvents,
  emailInsights,
  googleConnected,
  isSyncingGoogle,
  onConnectGoogle,
  onRefreshGoogle,
}) => {
  const [quickTitle, setQuickTitle] = useState('');
  const [isListening, setIsListening] = useState(false);

  const todayIso = useMemo(() => getLocalIsoDate(new Date()), []);

  const weekDays = useMemo(() => {
    const base = new Date();
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return {
        iso: getLocalIsoDate(d),
        label: i === 0 ? 'Hoy' : dayNames[d.getDay()],
        dayNum: d.getDate(),
      };
    });
  }, []);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate === selectedDate)
        .sort((a, b) => Number(a.completed) - Number(b.completed)),
    [tasks, selectedDate]
  );

  const completedCount = dayTasks.filter((t) => t.completed).length;
  const totalCount = dayTasks.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const ringCircumference = 2 * Math.PI * 18;
  const ringOffset = ringCircumference - (progressPct / 100) * ringCircumference;

  const dayEvents = useMemo(
    () => calendarEvents.filter((ev) => ev.start.slice(0, 10) === selectedDate),
    [calendarEvents, selectedDate]
  );

  const formattedHeaderDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1);
    return dateObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [selectedDate]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onQuickAddTask(quickTitle.trim(), selectedDate);
    setQuickTitle('');
  };

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const handleVoiceCapture = () => {
    if (!speechSupported || isListening) return;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recognition = new SpeechRec() as {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setQuickTitle((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div className="flex-1 overflow-y-auto touch-scroll px-3.5 py-4 sm:px-8 sm:py-7 space-y-5 sm:space-y-6">
      {/* Cabecera Hoy */}
      <section className="rounded-2xl bg-[#10051d] border border-[#8500ff] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#c38bff] capitalize">
              {formattedHeaderDate}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              {selectedDate === todayIso ? 'Tu enfoque de hoy' : 'Agenda del día'}
            </h1>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#6500a8]/50">
            <div className="flex items-center gap-3">
              <svg className="w-11 h-11 -rotate-90 shrink-0" viewBox="0 0 44 44" aria-hidden="true">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#1b0b2d"
                  strokeWidth="4"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#c000ff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-300"
                />
              </svg>
              <div>
                <p className="text-lg font-bold font-mono tabular-nums text-white leading-none">
                  {completedCount}/{totalCount}
                </p>
                <p className="text-xs text-[#c38bff] mt-1">Tareas listas</p>
              </div>
            </div>

            <div className="h-8 w-px bg-[#6500a8]/60" />

            <div>
              <p className="text-lg font-bold font-mono tabular-nums text-white leading-none">
                {dayEvents.length}
              </p>
              <p className="text-xs text-[#c38bff] mt-1">Eventos Google</p>
            </div>
          </div>
        </div>

        {/* Selector horizontal 7 días */}
        <div className="mt-5 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {weekDays.map((day) => {
            const active = day.iso === selectedDate;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => onSelectDate(day.iso)}
                className={`min-h-[54px] min-w-[56px] px-3 py-2 rounded-[10px] flex flex-col items-center justify-center transition-colors shrink-0 ${
                  active
                    ? 'bg-[#8500d9] text-white'
                    : 'bg-[#1b0b2d] text-[#d9b5ff] hover:bg-[#6500a8]'
                }`}
              >
                <span className="text-[11px] font-medium opacity-85">{day.label}</span>
                <span className="text-sm font-bold font-mono tabular-nums mt-0.5">{day.dayNum}</span>
              </button>
            );
          })}
        </div>

        {/* Captura rápida */}
        <form onSubmit={handleQuickSubmit} className="mt-4 flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[#170925] border-2 border-[#9b00ff] rounded-[12px] px-3 py-0.5">
            <input
              type="text"
              enterKeyHint="done"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Añade una tarea rápida para este día..."
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-base sm:text-sm text-white py-2.5 placeholder:text-[#987cae]"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={handleVoiceCapture}
                aria-label={isListening ? 'Escuchando dictado' : 'Dictar tarea por voz'}
                className={`min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center shrink-0 active:scale-95 transition-transform ${
                  isListening ? 'bg-[#c000ff] text-white' : 'text-[#c38bff] hover:bg-[#1b0b2d]'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
          <button
            type="submit"
            className="min-h-[48px] min-w-[48px] px-4 rounded-[12px] bg-[#9900ed] hover:bg-[#c000ff] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </form>
      </section>

      {/* Grid 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Tareas del día */}
        <section className="lg:col-span-7 rounded-2xl bg-[#10051d] border border-[#6500a8] overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#6500a8]/60 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Tareas del día</h2>
            <button
              type="button"
              onClick={onAskAprilOrganize}
              className="min-h-[44px] px-3.5 rounded-[10px] text-xs font-medium text-[#d9b5ff] bg-[#1b0b2d] border border-[#6500a8] hover:bg-[#6500a8] hover:text-white transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              Organizar con April IA
            </button>
          </div>

          {dayTasks.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-[#d9aaff]">
                No tienes tareas programadas para este día
              </p>
              <p className="text-xs text-[#987cae] mt-1">
                Escribe arriba una tarea rápida o pídele a April IA que organice tu semana.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#6500a8]/40">
              {dayTasks.map((task) => (
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
                    className="flex-1 min-w-0 text-left py-1.5"
                  >
                    <p
                      className={`text-sm font-medium leading-snug ${
                        task.completed ? 'line-through text-[#987cae]' : 'text-white'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#c38bff]">
                      <span>{task.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className={task.priority === 'alta' && !task.completed ? 'text-[#ff85b3] font-medium' : ''}>
                        Prioridad {task.priority}
                      </span>
                      {task.dueTime && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{task.dueTime}</span>
                        </>
                      )}
                      {task.location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[160px]">{task.location}</span>
                        </>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center shrink-0">
                    {task.location && (
                      <a
                        href={buildGoogleMapsUrl(task.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir ${task.location} en Google Maps`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-white hover:bg-[#6500a8]/50 active:scale-95"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onSendTaskWhatsApp(task)}
                      aria-label={`Enviar "${task.title}" por WhatsApp`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-white hover:bg-[#6500a8]/50 active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      title="Eliminar tarea"
                      aria-label={`Eliminar "${task.title}"`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-[#ff4d6d] hover:bg-[#b91c1c]/20 transition-colors active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Google Calendar & Gmail */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <CalendarIcon className="w-4 h-4 text-[#c000ff]" />
                <h2 className="text-base font-semibold text-white">Google Calendar</h2>
              </div>
              {googleConnected && (
                <button
                  type="button"
                  onClick={onRefreshGoogle}
                  disabled={isSyncingGoogle}
                  aria-label="Actualizar eventos de Google"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:bg-[#1b0b2d] active:scale-95"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {!googleConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-[#d9b5ff] leading-relaxed">
                  Vincula tu cuenta oficial de Google para ver tus eventos del calendario, sincronizar Google Tasks y detectar recordatorios en Gmail.
                </p>
                <GoogleSignInButton onClick={onConnectGoogle} fullWidth />
              </div>
            ) : dayEvents.length === 0 ? (
              <p className="text-sm text-[#987cae] py-2">
                No tienes eventos agendados en Google Calendar para este día.
              </p>
            ) : (
              <ul className="divide-y divide-[#6500a8]/40">
                {dayEvents.map((ev) => {
                  const timeStr = ev.allDay
                    ? 'Todo el día'
                    : new Date(ev.start).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                  return (
                    <li key={ev.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{ev.summary}</p>
                        <p className="text-xs text-[#c38bff] mt-0.5 font-mono tabular-nums">
                          {timeStr}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </p>
                      </div>
                      {ev.htmlLink && (
                        <a
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir ${ev.summary} en Google Calendar`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:text-white active:scale-95"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {googleConnected && (
            <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <Mail className="w-4 h-4 text-[#c000ff]" />
                <h2 className="text-base font-semibold text-white">Correos recientes en Gmail</h2>
              </div>

              {emailInsights.length === 0 ? (
                <p className="text-sm text-[#987cae]">
                  No se encontraron mensajes recientes en tu bandeja principal.
                </p>
              ) : (
                <ul className="divide-y divide-[#6500a8]/40">
                  {emailInsights.slice(0, 4).map((em) => (
                    <li key={em.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{em.subject}</p>
                          <p className="text-xs text-[#c38bff] truncate mt-0.5">{em.from}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onCreateTaskFromEmail(em)}
                          className="min-h-[44px] px-3 rounded-lg text-xs font-medium text-[#d9b5ff] bg-[#1b0b2d] border border-[#6500a8] hover:bg-[#6500a8] hover:text-white whitespace-nowrap shrink-0 active:scale-95"
                        >
                          + Tarea
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
