import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ListTodo, MessageCircle, Mic, MicOff, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ChatAttachment, ChatMessage, ProposedAction } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AprilChatViewProps {
  messages: ChatMessage[];
  isSending: boolean;
  errorBanner: string | null;
  googleUser: User | null;
  isLoggingInGoogle: boolean;
  onConnectGoogle: () => void;
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void;
  onTriggerProposedAction: (messageId: string, action: ProposedAction) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export const AprilChatView: React.FC<AprilChatViewProps> = ({
  messages,
  isSending,
  errorBanner,
  googleUser,
  isLoggingInGoogle,
  onConnectGoogle,
  onSendMessage,
  onTriggerProposedAction,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingAttachments.length === 0) || isSending) return;
    onSendMessage(input.trim(), pendingAttachments);
    setInput('');
    setPendingAttachments([]);
    setFileError(null);
  };

  const handleSelectFile = (kind: 'file' | 'image' | 'video') => {
    if (kind === 'file') fileInputRef.current?.click();
    if (kind === 'image') imageInputRef.current?.click();
    if (kind === 'video') videoInputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'file' | 'image' | 'video'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setFileError('El archivo supera 10 MB. Elige uno más ligero.');
      return;
    }

    setFileError(null);
    try {
      const dataBase64 = await fileToBase64(file);
      setPendingAttachments((prev) => [
        ...prev.slice(0, 2),
        {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          kind,
          dataBase64,
        },
      ]);
    } catch {
      setFileError('No pude cargar el archivo seleccionado.');
    }
  };

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleVoice = () => {
    if (!speechSupported || isListening) return;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recognition = new SpeechRec() as {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    setIsListening(true);
    recognition.onresult = (event) => {
      const t = event.results[0]?.[0]?.transcript;
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const renderActionLabel = (action: ProposedAction) => {
    const p = action.payload;
    switch (action.type) {
      case 'create_task':
        return `Tarea agregada: ${String(p.title ?? '')}`;
      case 'complete_task':
        return `Tarea completada: ${String(p.taskTitle ?? '')}`;
      case 'draft_calendar_event':
        return `Agendar en Google Calendar: ${String(p.summary ?? '')} (${String(p.date ?? '')} ${String(p.startTime ?? '')})`;
      case 'draft_google_task':
        return `Guardar en Google Tasks: ${String(p.title ?? '')}`;
      case 'draft_whatsapp_message':
        return `Abrir WhatsApp para ${String(p.recipientName || 'Mí mismo')}`;
      default:
        return 'Acción preparada';
    }
  };

  const renderActionIcon = (type: ProposedAction['type']) => {
    switch (type) {
      case 'draft_calendar_event':
        return <Calendar className="w-4 h-4 shrink-0" />;
      case 'draft_whatsapp_message':
        return <MessageCircle className="w-4 h-4 shrink-0" />;
      default:
        return <ListTodo className="w-4 h-4 shrink-0" />;
    }
  };

  const firstName = googleUser?.displayName?.split(' ')[0];

  const quickPrompts = [
    'Organiza mi día de hoy con mis pendientes',
    'Anota una tarea para mañana a las 10:00',
    'Prepara un mensaje de WhatsApp de recordatorio',
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-[#08020f]">
      {/* Mensajes */}
      <section className="flex-1 overflow-y-auto touch-scroll px-3.5 py-4 sm:px-8 sm:py-7 flex flex-col gap-3.5 sm:gap-4">
        {messages.length === 0 && !isSending && (
          <div className="my-auto pb-2 text-center max-w-md mx-auto w-full">
            <h1 className="text-[21px] sm:text-[27px] font-semibold text-white">
              {firstName ? `¡Hola, ${firstName}!, ¿por dónde empezamos?` : '¡Hola!, ¿por dónde empezamos?'}
            </h1>
            <p className="mt-2 text-sm text-[#c38bff]">
              Pídeme organizar tus tareas, agendar en Google Calendar o redactar un WhatsApp.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-left">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendMessage(prompt)}
                  className="min-h-[44px] w-full rounded-xl border border-[#6500a8] bg-[#10051d] hover:bg-[#1b0b2d] px-3.5 py-2.5 text-xs sm:text-sm text-[#d9b5ff] hover:text-white text-left transition-all active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
            {!googleUser && (
              <div className="mt-5 flex justify-center">
                <GoogleSignInButton
                  onClick={onConnectGoogle}
                  disabled={isLoggingInGoogle}
                  label={isLoggingInGoogle ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}
                />
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[75%] rounded-xl px-4 py-3.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-[#7100c9] text-white'
                  : 'bg-[#1b0b2d] text-white'
              }`}
            >
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mb-2 text-xs text-[#d9b5ff]">
                  {msg.attachments.map((a) => a.name).join(' · ')}
                </div>
              )}
              {msg.text}
            </div>

            {msg.actions && msg.actions.length > 0 && (
              <div className="mt-2 space-y-2 w-full max-w-[90%] sm:max-w-[75%]">
                {msg.actions.map((act) => {
                  const isLocalDone =
                    act.type === 'create_task' ||
                    act.type === 'complete_task' ||
                    act.status === 'executed';
                  return (
                    <div
                      key={act.id}
                      className="rounded-xl border border-[#8500ff] bg-[#10051d] px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[#c000ff]">
                          {isLocalDone ? <Check className="w-4 h-4" /> : renderActionIcon(act.type)}
                        </span>
                        <span className="text-xs font-medium text-[#d9aaff] truncate">
                          {renderActionLabel(act)}
                        </span>
                      </div>

                      {!isLocalDone && (
                        <button
                          type="button"
                          onClick={() => onTriggerProposedAction(msg.id, act)}
                          className="min-h-[44px] px-3.5 rounded-lg bg-[#8500e8] hover:bg-[#a000ff] text-white text-xs font-medium whitespace-nowrap shrink-0 transition-all active:scale-95"
                        >
                          Revisar y confirmar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="self-start max-w-[75%] rounded-xl bg-[#1b0b2d] px-4 py-3.5 text-sm text-[#d9aaff]">
            April está pensando...
          </div>
        )}

        {(errorBanner || fileError) && (
          <div className="rounded-xl border border-[#ff4d8d]/50 bg-[#2a081d] px-4 py-3 text-xs text-[#ffb3cd]">
            {fileError || errorBanner}
          </div>
        )}

        <div ref={bottomRef} />
      </section>

      {/* Barra de texto + Archivos / Imágenes / Videos */}
      <div className="px-3 pb-2.5 pt-1.5 sm:px-8 sm:pb-6 shrink-0 bg-[#08020f]">
        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-[#d9b5ff]">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1b0b2d] border border-[#6500a8] px-3 py-1.5"
              >
                <span className="truncate max-w-[180px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPendingAttachments((prev) => prev.filter((item) => item.id !== att.id))
                  }
                  aria-label={`Quitar ${att.name}`}
                  className="min-h-[28px] min-w-[28px] flex items-center justify-center text-[#c38bff] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center bg-[#170925] border-2 border-[#9b00ff] rounded-[14px] p-1.5 sm:p-2 gap-1.5"
        >
          <input
            type="text"
            enterKeyHint="send"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje aquí..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-white px-2.5 sm:px-3.5 py-2.5 text-base placeholder:text-[#987cae]"
          />

          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={isListening ? 'Detener dictado' : 'Dictar por voz'}
              className={`min-h-[44px] min-w-[44px] rounded-[10px] flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                isListening
                  ? 'bg-[#c000ff] text-white'
                  : 'text-[#c38bff] hover:bg-[#1b0b2d]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <button
            type="submit"
            disabled={(!input.trim() && pendingAttachments.length === 0) || isSending}
            className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-[10px] bg-[#9900ed] hover:bg-[#c000ff] disabled:opacity-50 text-white text-sm font-medium transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            Enviar
          </button>
        </form>

        <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-3 mt-2 sm:mt-3">
          <button
            type="button"
            onClick={() => handleSelectFile('file')}
            className="min-h-[44px] bg-[#1b0b2d] hover:bg-[#6500a8] text-[#d9b5ff] border border-[#6500a8] px-2 sm:px-4 py-2 rounded-[10px] text-xs sm:text-sm transition-all active:scale-95 text-center"
          >
            Archivos
          </button>
          <button
            type="button"
            onClick={() => handleSelectFile('image')}
            className="min-h-[44px] bg-[#1b0b2d] hover:bg-[#6500a8] text-[#d9b5ff] border border-[#6500a8] px-2 sm:px-4 py-2 rounded-[10px] text-xs sm:text-sm transition-all active:scale-95 text-center"
          >
            Imágenes
          </button>
          <button
            type="button"
            onClick={() => handleSelectFile('video')}
            className="min-h-[44px] bg-[#1b0b2d] hover:bg-[#6500a8] text-[#d9b5ff] border border-[#6500a8] px-2 sm:px-4 py-2 rounded-[10px] text-xs sm:text-sm transition-all active:scale-95 text-center"
          >
            Videos
          </button>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => handleFileChange(e, 'file')}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFileChange(e, 'image')}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => handleFileChange(e, 'video')}
          />
        </div>
      </div>
    </div>
  );
};
