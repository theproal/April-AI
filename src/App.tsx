import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarCheck, ExternalLink, Grid, ListTodo, LogOut, Menu, MessageSquareText, Plus, Trash2, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AprilTask,
  CalendarEventItem,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  ConfirmationRequest,
  EmailInsight,
  GoogleTaskList,
  GoogleTaskRemote,
  OfficialAppPreferences,
  ProposedAction,
  SpotifySummary,
  TabId,
} from './types';
import {
  formatGoogleAuthError,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
  type GoogleAuthErrorInfo,
} from './services/googleAuth';
import {
  createAccountChatSession,
  deleteAccountChat,
  ensureUserProfile,
  saveAccountChatMessage,
  subscribeChatMessages,
  subscribeUserChats,
  updateAccountMessageActions,
} from './services/chatStore';
import {
  createGoogleCalendarEvent,
  createGoogleTask,
  deleteGoogleTask,
  fetchGoogleTasks,
  fetchRecentGmailInsights,
  fetchUpcomingCalendarEvents,
  toggleGoogleTaskStatus,
} from './services/googleWorkspace';
import { buildTelegramShareUrl, buildWhatsAppUrl } from './services/officialIntegrations';
import { TodayView } from './components/TodayView';
import { TasksView } from './components/TasksView';
import { AprilChatView } from './components/AprilChatView';
import { AppsHubView } from './components/AppsHubView';
import { TaskDrawer } from './components/TaskDrawer';
import { ConfirmationModal } from './components/ConfirmationModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { GoogleSignInButton } from './components/GoogleSignInButton';

const TASKS_STORAGE_KEY = 'april_ia_tasks_v1';
const PREFS_STORAGE_KEY = 'april_ia_prefs_v1';

function getTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function openExternalOfficialUrl(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getInitialTasks(): AprilTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AprilTask[];
  } catch {
    // ignore storage errors
  }
  const today = getTodayIso();
  return [
    {
      id: 'task_welcome_1',
      title: 'Revisar pendientes prioritarios de hoy',
      completed: false,
      dueDate: today,
      dueTime: '09:30',
      priority: 'alta',
      category: 'Personal',
      notes: 'Toca aquí para editar o enviar este recordatorio por WhatsApp.',
      source: 'april',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task_welcome_2',
      title: 'Confirmar cita o compras de la semana',
      completed: false,
      dueDate: today,
      dueTime: '17:00',
      priority: 'media',
      category: 'Hogar',
      source: 'april',
      createdAt: new Date().toISOString(),
    },
  ];
}

function getInitialPrefs(): OfficialAppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as OfficialAppPreferences;
  } catch {
    // ignore
  }
  return {
    whatsappSelfPhone: '',
    whatsappContacts: [],
    telegramUsername: '',
    notificationsEnabled: false,
  };
}

function getInitialTab(): TabId {
  if (typeof window === 'undefined') return 'april';
  const param = new URLSearchParams(window.location.search).get('tab');
  if (param === 'april' || param === 'hoy' || param === 'tareas' || param === 'apps') {
    return param;
  }
  return 'april';
}

export default function App() {
  const todayIso = useMemo(() => getTodayIso(), []);
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [menuOpen, setMenuOpen] = useState(false);

  const [tasks, setTasks] = useState<AprilTask[]>(getInitialTasks);
  const [prefs, setPrefs] = useState<OfficialAppPreferences>(getInitialPrefs);

  // Chats de sesión
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Google Workspace Auth & Live Data State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [googleTaskLists, setGoogleTaskLists] = useState<GoogleTaskList[]>([]);
  const [googleTasks, setGoogleTasks] = useState<GoogleTaskRemote[]>([]);
  const [emailInsights, setEmailInsights] = useState<EmailInsight[]>([]);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<string | null>(null);
  const [googleAuthError, setGoogleAuthError] = useState<GoogleAuthErrorInfo | null>(null);

  // Spotify OAuth State
  const [spotifySessionId, setSpotifySessionId] = useState<string | null>(null);
  const [spotifySummary, setSpotifySummary] = useState<SpotifySummary | null>(null);
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [spotifyCallbackUrl, setSpotifyCallbackUrl] = useState<string | null>(null);

  // Task Drawer & Confirmation Modal
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AprilTask | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);

  // April Chat Request State
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  const syncGoogleWorkspaceData = useCallback(async (token: string) => {
    setIsSyncingGoogle(true);
    setWorkspaceFeedback(null);
    try {
      const [eventsRes, tasksRes, emailsRes] = await Promise.all([
        fetchUpcomingCalendarEvents(token, 10).catch(() => []),
        fetchGoogleTasks(token).catch(() => ({ lists: [], tasks: [] })),
        fetchRecentGmailInsights(token).catch(() => []),
      ]);
      setCalendarEvents(eventsRes);
      setGoogleTaskLists(tasksRes.lists);
      setGoogleTasks(tasksRes.tasks);
      setEmailInsights(emailsRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'TOKEN_EXPIRED') {
        setGoogleConnected(false);
        setWorkspaceFeedback('Tu sesión de Google expiró. Conéctate de nuevo para sincronizar.');
      }
    } finally {
      setIsSyncingGoogle(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleConnected(true);
        void syncGoogleWorkspaceData(token);
      },
      (user) => {
        setGoogleUser(user);
        setGoogleConnected(false);
      }
    );
    return unsubscribe;
  }, [syncGoogleWorkspaceData]);

  // Per-account persistent chats in Firestore (isolated per Google UID)
  const accountUid = googleUser?.uid ?? null;

  useEffect(() => {
    // Reset active conversation list immediately on account switch or sign-out
    setChats([]);
    setCurrentChatId(null);

    if (!googleUser || !accountUid) {
      return;
    }

    let cancelled = false;
    void ensureUserProfile(googleUser).catch((err) => {
      console.warn('No se pudo inicializar el perfil de usuario:', err);
    });

    const unsubChats = subscribeUserChats(
      accountUid,
      (accountChats) => {
        if (cancelled) return;
        setChats((prev) => {
          const prevMessages = new Map(prev.map((c) => [c.id, c.messages]));
          return accountChats.map((c) => ({
            id: c.id,
            name: c.name,
            messages: prevMessages.get(c.id) ?? [],
          }));
        });
        setCurrentChatId((prevId) => {
          if (prevId && accountChats.some((c) => c.id === prevId)) {
            return prevId;
          }
          return accountChats[0]?.id ?? null;
        });
      },
      (err) => {
        if (!cancelled) {
          console.warn('Error al sincronizar chats de la cuenta:', err);
          setChatError('No pude cargar los chats guardados de tu cuenta.');
        }
      }
    );

    return () => {
      cancelled = true;
      unsubChats();
    };
  }, [accountUid, googleUser]);

  useEffect(() => {
    if (!accountUid || !currentChatId) {
      return;
    }

    const unsubMsgs = subscribeChatMessages(
      accountUid,
      currentChatId,
      (messages) => {
        setChats((prev) =>
          prev.map((c) => (c.id === currentChatId ? { ...c, messages } : c))
        );
      },
      (err) => {
        console.warn('Error al sincronizar mensajes del chat:', err);
      }
    );

    return () => {
      unsubMsgs();
    };
  }, [accountUid, currentChatId]);

  // Spotify session fetch + popup postMessage listener
  const fetchSpotifySummary = useCallback(async (sessionOverride?: string | null) => {
    try {
      const sid = sessionOverride ?? spotifySessionId;
      const res = await fetch('/api/spotify/summary', {
        headers: sid ? { 'x-spotify-session': sid } : undefined,
      });
      if (!res.ok) {
        setSpotifySummary(null);
        return;
      }
      const data = (await res.json()) as {
        connected?: boolean;
        summary?: SpotifySummary | null;
      } & Partial<SpotifySummary>;
      if (data.connected === false) {
        setSpotifySummary(null);
        return;
      }
      const summary = data.summary ?? (data.profile ? (data as SpotifySummary) : null);
      setSpotifySummary(summary);
      setSpotifyError(null);
    } catch {
      // ignore initial check errors
    }
  }, [spotifySessionId]);

  useEffect(() => {
    void fetchSpotifySummary(null);
  }, [fetchSpotifySummary]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        const sid = typeof event.data.sessionId === 'string' ? event.data.sessionId : null;
        setSpotifySessionId(sid);
        setIsConnectingSpotify(false);
        setSpotifyError(null);
        void fetchSpotifySummary(sid);
      } else if (event.data?.type === 'SPOTIFY_AUTH_ERROR') {
        setIsConnectingSpotify(false);
        setSpotifyError('No se completó la autorización con Spotify.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchSpotifySummary]);

  const handleConnectSpotify = async () => {
    setIsConnectingSpotify(true);
    setSpotifyError(null);
    setSpotifyCallbackUrl(null);
    try {
      const res = await fetch('/api/spotify/auth-url');
      const data = (await res.json()) as {
        configured?: boolean;
        url?: string;
        error?: string;
        callbackUrl?: string;
      };
      if (!res.ok || data.configured === false || !data.url) {
        if (data.error === 'SPOTIFY_CREDENTIALS_MISSING') {
          setSpotifyCallbackUrl(data.callbackUrl || `${window.location.origin}/auth/spotify/callback`);
          setSpotifyError(
            'Faltan las credenciales de Spotify (SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET) en Settings > Secrets de AI Studio.'
          );
        } else {
          setSpotifyError('No se pudo iniciar la conexión con Spotify.');
        }
        setIsConnectingSpotify(false);
        return;
      }

      const authWindow = window.open(data.url, 'spotify_oauth_popup', 'width=540,height=720');
      if (!authWindow) {
        setSpotifyError('Tu navegador bloqueó la ventana emergente de Spotify. Permite popups e intenta de nuevo.');
        setIsConnectingSpotify(false);
        return;
      }

      const closeCheck = window.setInterval(() => {
        if (authWindow.closed) {
          window.clearInterval(closeCheck);
          setIsConnectingSpotify(false);
        }
      }, 600);
    } catch {
      setSpotifyError('Error de red al conectar con Spotify.');
      setIsConnectingSpotify(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    await fetch('/api/spotify/disconnect', {
      method: 'POST',
      headers: spotifySessionId ? { 'x-spotify-session': spotifySessionId } : undefined,
    }).catch(() => undefined);
    setSpotifySessionId(null);
    setSpotifySummary(null);
  };

  const handleConnectGoogle = async (includeWorkspaceScopes = true) => {
    setIsLoggingInGoogle(true);
    setWorkspaceFeedback(null);
    setGoogleAuthError(null);
    try {
      const { user, accessToken } = await googleSignIn({ includeWorkspaceScopes });
      setGoogleUser(user);
      if (accessToken) {
        setGoogleConnected(true);
        await syncGoogleWorkspaceData(accessToken);
      } else {
        setGoogleConnected(false);
        setCalendarEvents([]);
        setGoogleTasks([]);
        setGoogleTaskLists([]);
        setEmailInsights([]);
      }
    } catch (err) {
      const info = formatGoogleAuthError(err, includeWorkspaceScopes);
      if (info.code !== 'auth/popup-closed-by-user' && info.code !== 'auth/cancelled-popup-request') {
        console.warn('Google Sign-In failed:', info.code, err);
      }
      setGoogleAuthError(info);
      setWorkspaceFeedback(info.message);
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await logout();
    setGoogleUser(null);
    setGoogleConnected(false);
    setGoogleAuthError(null);
    setWorkspaceFeedback(null);
    setCalendarEvents([]);
    setGoogleTasks([]);
    setGoogleTaskLists([]);
    setEmailInsights([]);
  };

  const handleRefreshGoogle = async () => {
    const token = await getAccessToken();
    if (!token) {
      await handleConnectGoogle();
      return;
    }
    await syncGoogleWorkspaceData(token);
  };

  // Task Operations
  const createLocalTask = useCallback(
    (data: Omit<AprilTask, 'id' | 'createdAt' | 'completed'>): AprilTask => {
      const newTask: AprilTask = {
        ...data,
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
      return newTask;
    },
    []
  );

  const handleQuickAddTask = (title: string, date: string) => {
    createLocalTask({
      title,
      dueDate: date,
      priority: 'media',
      category: 'Personal',
      source: 'april',
    });
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const requestSyncToGoogleTasks = (task: { title: string; dueDate?: string; notes?: string }) => {
    setConfirmation({
      title: 'Guardar en Google Tasks',
      description: '¿Confirmas agregar esta tarea a tu lista oficial de Google Tasks?',
      details: [
        `Título: ${task.title}`,
        task.dueDate ? `Fecha: ${task.dueDate}` : 'Fecha: Sin fecha límite',
      ],
      confirmLabel: 'Guardar en Google Tasks',
      onConfirm: async () => {
        const token = await getAccessToken();
        if (!token) {
          setWorkspaceFeedback('Conéctate con Google primero para guardar en Google Tasks.');
          return;
        }
        const listId = googleTaskLists[0]?.id || '@default';
        const created = await createGoogleTask(token, listId, task);
        setGoogleTasks((prev) => [created, ...prev]);
      },
    });
  };

  const requestAddToGoogleCalendar = (event: {
    summary: string;
    date: string;
    startTime: string;
    endTime?: string;
    location?: string;
    description?: string;
  }) => {
    setConfirmation({
      title: 'Agendar en Google Calendar',
      description: '¿Confirmas crear este evento en tu Google Calendar oficial?',
      details: [
        `Evento: ${event.summary}`,
        `Fecha y hora: ${event.date} a las ${event.startTime}`,
        event.location ? `Lugar: ${event.location}` : '',
      ].filter(Boolean),
      confirmLabel: 'Confirmar evento',
      onConfirm: async () => {
        const token = await getAccessToken();
        if (!token) {
          setWorkspaceFeedback('Conéctate con Google primero para agendar en Google Calendar.');
          return;
        }
        const created = await createGoogleCalendarEvent(token, event);
        setCalendarEvents((prev) => [...prev, created]);
      },
    });
  };

  const requestSendWhatsApp = (phone: string | undefined, recipientName: string, message: string) => {
    const targetPhone = phone || prefs.whatsappSelfPhone;
    setConfirmation({
      title: 'Abrir WhatsApp Oficial',
      description: `Se abrirá WhatsApp con el siguiente mensaje preparado para ${recipientName || 'elegir contacto'}:`,
      details: [
        targetPhone ? `Número: +${targetPhone.replace(/\D/g, '')}` : 'Destino: Elegir contacto dentro de WhatsApp',
        `Mensaje: ${message}`,
      ],
      confirmLabel: 'Abrir WhatsApp',
      onConfirm: () => {
        openExternalOfficialUrl(buildWhatsAppUrl(targetPhone, message));
      },
    });
  };

  const requestSendTelegram = (message: string) => {
    setConfirmation({
      title: 'Abrir Telegram Oficial',
      description: 'Se abrirá Telegram con tu resumen de tareas listo para enviar:',
      details: [
        prefs.telegramUsername ? `Destino: ${prefs.telegramUsername}` : 'Destino: Mensajes guardados o chat a elegir',
        `Contenido: ${message}`,
      ],
      confirmLabel: 'Abrir Telegram',
      onConfirm: () => {
        openExternalOfficialUrl(buildTelegramShareUrl(message, prefs.telegramUsername));
      },
    });
  };

  const handleSaveTaskFromDrawer = (
    data: Omit<AprilTask, 'id' | 'createdAt' | 'completed'>,
    options: { syncToGoogleTasks: boolean; addToGoogleCalendar: boolean }
  ) => {
    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...data } : t))
      );
      setEditingTask(null);
    } else {
      createLocalTask(data);
      if (options.syncToGoogleTasks && googleConnected) {
        requestSyncToGoogleTasks({
          title: data.title,
          dueDate: data.dueDate,
          notes: data.notes,
        });
      } else if (options.addToGoogleCalendar && googleConnected) {
        requestAddToGoogleCalendar({
          summary: data.title,
          date: data.dueDate,
          startTime: data.dueTime || '09:00',
          location: data.location,
          description: data.notes,
        });
      }
    }
  };

  const handleToggleRemoteGoogleTask = (gt: GoogleTaskRemote) => {
    const nextCompleted = gt.status !== 'completed';
    setConfirmation({
      title: nextCompleted ? 'Completar en Google Tasks' : 'Reabrir en Google Tasks',
      description: `¿Confirmas actualizar el estado de "${gt.title}" en tu cuenta oficial de Google Tasks?`,
      details: [`Lista: ${gt.listTitle}`],
      confirmLabel: nextCompleted ? 'Marcar completada' : 'Marcar pendiente',
      onConfirm: async () => {
        const token = await getAccessToken();
        if (!token) return;
        await toggleGoogleTaskStatus(token, gt.listId, gt.id, nextCompleted);
        setGoogleTasks((prev) =>
          prev.map((item) =>
            item.id === gt.id
              ? { ...item, status: nextCompleted ? 'completed' : 'needsAction' }
              : item
          )
        );
      },
    });
  };

  const handleDeleteRemoteGoogleTask = (gt: GoogleTaskRemote) => {
    setConfirmation({
      title: 'Eliminar de Google Tasks',
      description: `¿Seguro que deseas eliminar "${gt.title}" permanentemente de Google Tasks?`,
      details: [`Lista: ${gt.listTitle}`, 'Esta acción no se puede deshacer.'],
      confirmLabel: 'Eliminar tarea',
      destructive: true,
      onConfirm: async () => {
        const token = await getAccessToken();
        if (!token) return;
        await deleteGoogleTask(token, gt.listId, gt.id);
        setGoogleTasks((prev) => prev.filter((item) => item.id !== gt.id));
      },
    });
  };

  const handleCreateTaskFromEmail = (email: EmailInsight) => {
    createLocalTask({
      title: `Revisar correo: ${email.subject}`,
      dueDate: selectedDate,
      priority: 'alta',
      category: 'Trabajo',
      notes: `De ${email.from}: ${email.snippet}`,
      source: 'gmail',
    });
  };

  // Gestión de chats
  const handleNewChat = () => {
    const newId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextSession: ChatSession = {
      id: newId,
      name: 'Nuevo chat',
      messages: [],
    };
    setChats((prev) => [nextSession, ...prev]);
    setCurrentChatId(newId);
    setActiveTab('april');
    setChatError(null);
    setMenuOpen(false);

    if (googleUser) {
      void createAccountChatSession(googleUser, newId, 'Nuevo chat').catch((err) => {
        console.warn('No se pudo crear el chat en la cuenta:', err);
      });
    }
  };

  const handleDeleteChat = (chatId: string) => {
    setChats((prev) => {
      const remaining = prev.filter((c) => c.id !== chatId);
      if (currentChatId === chatId) {
        setCurrentChatId(remaining[0]?.id ?? null);
      }
      return remaining;
    });

    if (googleUser) {
      void deleteAccountChat(googleUser.uid, chatId).catch((err) => {
        console.warn('No se pudo eliminar el chat de la cuenta:', err);
      });
    }
  };

  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentChatId) ?? null,
    [chats, currentChatId]
  );

  // Enviar mensaje a April IA
  const sendAprilChatMessage = async (text: string, attachments: ChatAttachment[] = []) => {
    let targetChatId = currentChatId;
    const existingMessages = currentChat?.messages ?? [];

    const nowTime = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_u`,
      role: 'user',
      text: text || `Archivo adjunto: ${attachments.map((a) => a.name).join(', ')}`,
      timestamp: nowTime,
      attachments: attachments.map((a) => ({ name: a.name, kind: a.kind })),
    };

    const previewLabel = (text || attachments[0]?.name || 'Nuevo chat').trim();
    const shortTitle =
      previewLabel.length > 28 ? `${previewLabel.substring(0, 28)}...` : previewLabel;

    let resolvedChatName = currentChat?.name || shortTitle;
    let shouldUpdateName = false;

    if (!targetChatId) {
      targetChatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      resolvedChatName = shortTitle;
      shouldUpdateName = true;
      const newSession: ChatSession = {
        id: targetChatId,
        name: shortTitle,
        messages: [userMsg],
      };
      setChats((prev) => [newSession, ...prev]);
      setCurrentChatId(targetChatId);
    } else {
      shouldUpdateName = existingMessages.length === 0;
      resolvedChatName = shouldUpdateName ? shortTitle : currentChat?.name || shortTitle;
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== targetChatId) return c;
          const nextName = c.messages.length === 0 ? shortTitle : c.name;
          return { ...c, name: nextName, messages: [...c.messages, userMsg] };
        })
      );
    }

    const saveUserPromise = googleUser
      ? saveAccountChatMessage(
          googleUser,
          targetChatId,
          resolvedChatName,
          userMsg,
          shouldUpdateName
        ).catch((err) => {
          console.warn('No se pudo guardar el mensaje en la cuenta:', err);
        })
      : Promise.resolve();

    setIsSendingChat(true);
    setChatError(null);

    try {
      const response = await fetch('/api/april/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          attachments: attachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
          })),
          history: existingMessages.slice(-8).map((m) => ({ role: m.role, text: m.text })),
          context: {
            todayIso,
            localTime: nowTime,
            userName: googleUser?.displayName || googleUser?.email || undefined,
            tasks: tasks.slice(0, 25).map((t) => ({
              id: t.id,
              title: t.title,
              completed: t.completed,
              dueDate: t.dueDate,
              dueTime: t.dueTime,
              priority: t.priority,
              category: t.category,
            })),
            calendarEvents: calendarEvents.slice(0, 12),
            emailInsights: emailInsights.slice(0, 5),
            whatsappContacts: prefs.whatsappContacts,
            connectedApps: {
              googleCalendar: googleConnected,
              googleTasks: googleConnected,
              gmail: googleConnected,
              spotify: Boolean(spotifySummary),
              whatsappOfficial: true,
              telegramOfficial: true,
            },
          },
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        actions?: ProposedAction[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Error al comunicar con April IA.');
      }

      const actions = data.actions ?? [];

      for (const act of actions) {
        if (act.type === 'create_task') {
          const p = act.payload;
          const rawPriority = String(p.priority || 'media').toLowerCase();
          const priority =
            rawPriority === 'alta' || rawPriority === 'baja' ? rawPriority : 'media';
          const rawCategory = String(p.category || 'Personal');
          const category = (['Trabajo', 'Personal', 'Hogar', 'Salud'].includes(rawCategory)
            ? rawCategory
            : 'Personal') as AprilTask['category'];

          createLocalTask({
            title: String(p.title || 'Nueva tarea'),
            dueDate: String(p.dueDate || todayIso),
            dueTime: p.dueTime ? String(p.dueTime) : undefined,
            priority,
            category,
            location: p.location ? String(p.location) : undefined,
            notes: p.notes ? String(p.notes) : undefined,
            source: 'april',
          });
        } else if (act.type === 'complete_task') {
          const q = String(act.payload.taskTitle || '').toLowerCase();
          const idMatch = act.payload.taskId ? String(act.payload.taskId) : null;
          setTasks((prev) =>
            prev.map((t) => {
              if (idMatch && t.id === idMatch) return { ...t, completed: true };
              if (q && t.title.toLowerCase().includes(q)) return { ...t, completed: true };
              return t;
            })
          );
        }
      }

      const modelMsg: ChatMessage = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_a`,
        role: 'model',
        text: data.reply || 'Listo.',
        timestamp: new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        actions,
      };

      const finalChatId = targetChatId;
      setChats((prev) =>
        prev.map((c) =>
          c.id === finalChatId ? { ...c, messages: [...c.messages, modelMsg] } : c
        )
      );

      if (googleUser) {
        await saveUserPromise;
        void saveAccountChatMessage(
          googleUser,
          finalChatId,
          resolvedChatName,
          modelMsg,
          false
        ).catch((err) => {
          console.warn('No se pudo guardar la respuesta en la cuenta:', err);
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado al contactar a April IA.';
      setChatError(message);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleTriggerProposedAction = (messageId: string, action: ProposedAction) => {
    const p = action.payload;
    const markExecuted = () => {
      const activeChat = chats.find((c) => c.id === currentChatId);
      const targetMessage = activeChat?.messages.find((m) => m.id === messageId);
      const updatedActions = targetMessage?.actions?.map((a) =>
        a.id === action.id ? { ...a, status: 'executed' as const } : a
      );

      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        actions: m.actions?.map((a) =>
                          a.id === action.id ? { ...a, status: 'executed' } : a
                        ),
                      }
                    : m
                ),
              }
            : c
        )
      );

      if (googleUser && currentChatId && updatedActions) {
        void updateAccountMessageActions(
          googleUser.uid,
          currentChatId,
          messageId,
          updatedActions
        ).catch((err) => {
          console.warn('No se pudo actualizar la acción en la cuenta:', err);
        });
      }
    };

    if (action.type === 'draft_calendar_event') {
      const event = {
        summary: String(p.summary || 'Evento April IA'),
        date: String(p.date || todayIso),
        startTime: String(p.startTime || '10:00'),
        endTime: p.endTime ? String(p.endTime) : undefined,
        location: p.location ? String(p.location) : undefined,
        description: p.description ? String(p.description) : undefined,
      };
      setConfirmation({
        title: 'Agendar en Google Calendar',
        description: '¿Confirmas crear este evento en tu calendario oficial de Google?',
        details: [
          `Evento: ${event.summary}`,
          `Fecha: ${event.date} · ${event.startTime}`,
          event.location ? `Lugar: ${event.location}` : '',
        ].filter(Boolean),
        confirmLabel: 'Agendar ahora',
        onConfirm: async () => {
          const token = await getAccessToken();
          if (!token) {
            setWorkspaceFeedback('Conéctate con Google en la pestaña Apps para agendar eventos.');
            setActiveTab('apps');
            return;
          }
          const created = await createGoogleCalendarEvent(token, event);
          setCalendarEvents((prev) => [...prev, created]);
          markExecuted();
        },
      });
    } else if (action.type === 'draft_google_task') {
      const gTask = {
        title: String(p.title || 'Tarea'),
        dueDate: p.dueDate ? String(p.dueDate) : undefined,
        notes: p.notes ? String(p.notes) : undefined,
      };
      setConfirmation({
        title: 'Guardar en Google Tasks',
        description: '¿Confirmas añadir esta tarea a Google Tasks oficial?',
        details: [`Título: ${gTask.title}`, gTask.dueDate ? `Fecha: ${gTask.dueDate}` : ''],
        confirmLabel: 'Guardar en Google Tasks',
        onConfirm: async () => {
          const token = await getAccessToken();
          if (!token) {
            setWorkspaceFeedback('Conéctate con Google en la pestaña Apps para usar Google Tasks.');
            setActiveTab('apps');
            return;
          }
          const listId = googleTaskLists[0]?.id || '@default';
          const created = await createGoogleTask(token, listId, gTask);
          setGoogleTasks((prev) => [created, ...prev]);
          markExecuted();
        },
      });
    } else if (action.type === 'draft_whatsapp_message') {
      const recipientName = String(p.recipientName || 'WhatsApp');
      const phone = p.phone ? String(p.phone) : prefs.whatsappSelfPhone;
      const message = String(p.message || '');
      setConfirmation({
        title: 'Abrir WhatsApp Oficial',
        description: `Se abrirá WhatsApp con este mensaje listo para ${recipientName}:`,
        details: [
          phone ? `Teléfono: +${phone.replace(/\D/g, '')}` : 'Destino: Seleccionar contacto en WhatsApp',
          `Mensaje: ${message}`,
        ],
        confirmLabel: 'Abrir WhatsApp',
        onConfirm: () => {
          openExternalOfficialUrl(buildWhatsAppUrl(phone, message));
          markExecuted();
        },
      });
    }
  };

  const navItems: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'april', label: 'Chat IA', icon: <MessageSquareText className="w-4 h-4 shrink-0" /> },
    { id: 'hoy', label: 'Hoy', icon: <CalendarCheck className="w-4 h-4 shrink-0" /> },
    { id: 'tareas', label: 'Tareas', icon: <ListTodo className="w-4 h-4 shrink-0" /> },
    { id: 'apps', label: 'Apps', icon: <Grid className="w-4 h-4 shrink-0" /> },
  ];

  const mobileNavItems: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'april', label: 'Chat IA', icon: <MessageSquareText className="w-[22px] h-[22px] shrink-0" /> },
    { id: 'hoy', label: 'Hoy', icon: <CalendarCheck className="w-[22px] h-[22px] shrink-0" /> },
    { id: 'tareas', label: 'Tareas', icon: <ListTodo className="w-[22px] h-[22px] shrink-0" /> },
    { id: 'apps', label: 'Apps', icon: <Grid className="w-[22px] h-[22px] shrink-0" /> },
  ];

  const activeSectionTitle =
    navItems.find((item) => item.id === activeTab)?.label ?? 'Chat IA';

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-[#08020f] text-white overflow-hidden">
      {/* Barra lateral */}
      <aside
        aria-label="Menú lateral"
        className={`fixed inset-y-0 left-0 z-40 w-[285px] max-w-[85vw] lg:static lg:w-[290px] lg:min-w-[240px] bg-[#10051d] border-r-2 border-[#8500ff] p-5 pt-safe pb-safe lg:p-6 flex flex-col shrink-0 transition-transform duration-200 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-start justify-between gap-2 pt-1 lg:pt-0">
          <div>
            <div className="font-display text-[30px] lg:text-[34px] font-bold leading-none tracking-tight">
              April <span className="text-[#c000ff]">AI</span>
            </div>
            <p className="text-[#c38bff] text-[13px] mt-1.5 mb-4 lg:mb-5">
              Asistente personal móvil.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú lateral"
            className="lg:hidden min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-xl text-[#c38bff] hover:bg-[#1b0b2d] active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          className="w-full min-h-[46px] bg-[#8500e8] hover:bg-[#a000ff] text-white py-3 px-4 rounded-[10px] text-[15px] font-medium mb-5 transition-colors"
        >
          Nuevo chat
        </button>

        {/* Pestañas */}
        <h3 className="text-[#c38bff] text-xs font-semibold uppercase tracking-wider mb-2.5">
          Secciones
        </h3>
        <nav className="grid grid-cols-2 gap-2 mb-5" aria-label="Pestañas de April AI">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMenuOpen(false);
                }}
                className={`min-h-[44px] px-3 py-2.5 rounded-[10px] text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#8500d9] text-white'
                    : 'bg-[#1b0b2d] text-[#d9b5ff] hover:bg-[#8500d9]/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <h3 className="text-[#c38bff] text-xs font-semibold uppercase tracking-wider mb-2.5">
          Chats
        </h3>
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto no-scrollbar pr-0.5">
          {chats.length === 0 ? (
            <p className="text-xs text-[#987cae] py-2">
              Tus conversaciones de esta sesión aparecerán aquí.
            </p>
          ) : (
            chats.map((chat) => {
              const isSelected = activeTab === 'april' && chat.id === currentChatId;
              return (
                <div
                  key={chat.id}
                  className={`group relative flex items-center rounded-[10px] transition-colors ${
                    isSelected
                      ? 'bg-[#8500d9] text-white'
                      : 'bg-[#1b0b2d] text-white hover:bg-[#8500d9]/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentChatId(chat.id);
                      setActiveTab('april');
                      setMenuOpen(false);
                    }}
                    className="flex-1 min-w-0 min-h-[46px] text-left px-3.5 py-3 pr-24 text-sm break-words"
                  >
                    {chat.name}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id);
                    }}
                    aria-label={`Eliminar chat ${chat.name}`}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#b91c1c] hover:bg-[#dc2626] text-white text-xs font-medium inline-flex items-center gap-1 shadow-md transition-opacity duration-150 ${
                      isSelected
                        ? 'opacity-100 pointer-events-auto lg:opacity-0 lg:pointer-events-none'
                        : 'opacity-100 pointer-events-auto lg:opacity-0 lg:pointer-events-none'
                    } lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto lg:group-focus-within:opacity-100 lg:group-focus-within:pointer-events-auto lg:focus:opacity-100 lg:focus:pointer-events-auto active:scale-95`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 space-y-3 shrink-0">
          {googleUser ? (
            <div className="rounded-[10px] bg-[#1b0b2d] border border-[#6500a8] p-2.5 flex items-center gap-2.5">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Cuenta Google'}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#8500e8] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(googleUser.displayName || googleUser.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">
                  {googleUser.displayName || 'Cuenta Google'}
                </p>
                <p className="text-[11px] text-[#c38bff] truncate">
                  {googleUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleConnectGoogle(false)}
                disabled={isLoggingInGoogle}
                title="Cambiar de cuenta Google"
                aria-label="Cambiar de cuenta Google"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#c38bff] hover:text-white hover:bg-[#6500a8]"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                title="Cerrar sesión de Google"
                aria-label="Cerrar sesión de Google"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#c38bff] hover:text-white hover:bg-[#6500a8]"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <GoogleSignInButton
              onClick={() => void handleConnectGoogle(false)}
              disabled={isLoggingInGoogle}
              label={isLoggingInGoogle ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}
              fullWidth
            />
          )}
          <PWAInstallButton compact />
          <div className="p-3.5 border border-[#8700ff] rounded-[10px] text-[#d9aaff] text-[13px] leading-relaxed">
            {googleUser ? (
              <>
                Chats guardados en tu cuenta.{' '}
                <small className="block text-[#c38bff] mt-0.5">
                  Tus conversaciones permanecen vinculadas únicamente a esta cuenta de Google.
                </small>
              </>
            ) : (
              <>
                Esta IA es de uso único sin sesión.{' '}
                <small className="block text-[#c38bff] mt-0.5">
                  Inicia sesión con Google para guardar tus chats en tu cuenta.
                </small>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Fondo menú móvil */}
      {menuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 bg-black/65 z-30 lg:hidden"
        />
      )}

      {/* Panel principal */}
      <main className="flex-1 min-w-0 flex flex-col h-full relative overflow-hidden">
        {/* Topbar móvil compacto (sin pestañas en zona superior) */}
        <header className="flex lg:hidden items-center justify-between gap-2 px-3 py-2 pt-safe bg-[#10051d] border-b border-[#8500ff]/70 shrink-0 min-h-[56px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menú y chats"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#1b0b2d] text-white border border-[#8500ff]/80 rounded-xl active:scale-95 transition-transform shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="font-display text-[20px] font-bold leading-tight whitespace-nowrap">
                April <span className="text-[#c000ff]">AI</span>
              </div>
              <p className="text-[11px] font-medium text-[#c38bff] leading-none truncate">
                {activeSectionTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (googleUser) {
                  setMenuOpen(true);
                } else {
                  void handleConnectGoogle(false);
                }
              }}
              aria-label={googleUser ? 'Cuenta de Google conectada' : 'Iniciar sesión con Google'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#6500a8] bg-[#1b0b2d] active:scale-95 transition-transform"
            >
              {googleUser?.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Cuenta Google'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : googleUser ? (
                <span className="w-7 h-7 rounded-full bg-[#8500e8] text-white flex items-center justify-center text-xs font-bold">
                  {(googleUser.displayName || googleUser.email || 'G')[0].toUpperCase()}
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#d9b5ff] px-1">Entrar</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setDrawerOpen(true);
              }}
              aria-label="Nueva tarea"
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#9900ed] hover:bg-[#c000ff] text-white flex items-center justify-center gap-1.5 text-xs font-medium active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline">Tarea</span>
            </button>
          </div>
        </header>

        {workspaceFeedback && (
          <div className="mx-4 sm:mx-8 mt-3 rounded-xl border border-[#8500ff] bg-[#1b0b2d] px-4 py-3 text-xs text-[#d9aaff] shrink-0 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium leading-relaxed">{workspaceFeedback}</p>
              <button
                type="button"
                onClick={() => {
                  setWorkspaceFeedback(null);
                  setGoogleAuthError(null);
                }}
                aria-label="Cerrar aviso"
                className="text-[#c38bff] hover:text-white shrink-0 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {(googleAuthError?.canRetryBasicSignIn ||
              googleAuthError?.isPopupBlocked ||
              googleAuthError?.code === 'auth/popup-closed-by-user') && (
              <div className="flex flex-wrap gap-2">
                {googleAuthError?.canRetryBasicSignIn && (
                  <button
                    type="button"
                    disabled={isLoggingInGoogle}
                    onClick={() => void handleConnectGoogle(false)}
                    className="min-h-[36px] px-3 rounded-lg bg-[#8500e8] hover:bg-[#a000ff] text-white text-xs font-medium transition-colors"
                  >
                    Solo iniciar sesión con Google
                  </button>
                )}
                {googleAuthError?.isPopupBlocked && (
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 rounded-lg border border-[#8500ff] bg-[#10051d] hover:bg-[#6500a8] text-[#d9b5ff] hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Abrir en nueva pestaña</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {googleAuthError?.code === 'auth/popup-closed-by-user' && (
                  <a
                    href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0620488202"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 rounded-lg border border-[#8500ff] bg-[#10051d] hover:bg-[#6500a8] text-[#d9b5ff] hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Configurar usuarios de prueba</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'april' && (
          <AprilChatView
            messages={currentChat?.messages ?? []}
            isSending={isSendingChat}
            errorBanner={chatError}
            googleUser={googleUser}
            isLoggingInGoogle={isLoggingInGoogle}
            onConnectGoogle={() => void handleConnectGoogle(false)}
            onSendMessage={sendAprilChatMessage}
            onTriggerProposedAction={handleTriggerProposedAction}
          />
        )}

        {activeTab === 'hoy' && (
          <TodayView
            tasks={tasks}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onQuickAddTask={handleQuickAddTask}
            onToggleTask={handleToggleTask}
            onEditTask={(task) => {
              setEditingTask(task);
              setDrawerOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onSendTaskWhatsApp={(task) =>
              requestSendWhatsApp(
                prefs.whatsappSelfPhone,
                'Tu chat de WhatsApp',
                `Recordatorio April AI: ${task.title}${task.dueTime ? ` (${task.dueTime})` : ''}${task.location ? ` · ${task.location}` : ''}`
              )
            }
            onAskAprilOrganize={() => {
              setActiveTab('april');
              void sendAprilChatMessage('Organiza mi día de hoy según mis tareas y calendario');
            }}
            onCreateTaskFromEmail={handleCreateTaskFromEmail}
            calendarEvents={calendarEvents}
            emailInsights={emailInsights}
            googleConnected={googleConnected}
            isSyncingGoogle={isSyncingGoogle}
            onConnectGoogle={() => void handleConnectGoogle(true)}
            onRefreshGoogle={handleRefreshGoogle}
          />
        )}

        {activeTab === 'tareas' && (
          <TasksView
            tasks={tasks}
            googleTasks={googleTasks}
            googleConnected={googleConnected}
            todayIso={todayIso}
            onNewTask={() => {
              setEditingTask(null);
              setDrawerOpen(true);
            }}
            onToggleTask={handleToggleTask}
            onEditTask={(task) => {
              setEditingTask(task);
              setDrawerOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onSendTaskWhatsApp={(task) =>
              requestSendWhatsApp(
                prefs.whatsappSelfPhone,
                'Tu chat de WhatsApp',
                `Recordatorio April AI: ${task.title} (${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''})`
              )
            }
            onSendDigestWhatsApp={(msg) =>
              requestSendWhatsApp(prefs.whatsappSelfPhone, 'Tu chat de WhatsApp', msg)
            }
            onSyncTaskToGoogleTasks={(task) =>
              requestSyncToGoogleTasks({
                title: task.title,
                dueDate: task.dueDate,
                notes: task.notes,
              })
            }
            onToggleRemoteGoogleTask={handleToggleRemoteGoogleTask}
            onDeleteRemoteGoogleTask={handleDeleteRemoteGoogleTask}
          />
        )}

        {activeTab === 'apps' && (
          <AppsHubView
            googleUser={googleUser}
            googleConnected={googleConnected}
            isLoggingInGoogle={isLoggingInGoogle}
            isSyncingGoogle={isSyncingGoogle}
            onConnectGoogle={() => void handleConnectGoogle(true)}
            onDisconnectGoogle={handleDisconnectGoogle}
            onRefreshGoogle={handleRefreshGoogle}
            spotifySummary={spotifySummary}
            isConnectingSpotify={isConnectingSpotify}
            spotifyError={spotifyError}
            spotifyCallbackUrl={spotifyCallbackUrl}
            onConnectSpotify={handleConnectSpotify}
            onDisconnectSpotify={handleDisconnectSpotify}
            onRefreshSpotify={() => void fetchSpotifySummary()}
            prefs={prefs}
            onUpdatePrefs={setPrefs}
            tasks={tasks}
            onSendWhatsAppWithConfirm={requestSendWhatsApp}
            onSendTelegramWithConfirm={requestSendTelegram}
          />
        )}
        {/* Barra de navegación inferior móvil (Thumb Zone) */}
        <nav
          aria-label="Navegación inferior móvil"
          className="lg:hidden shrink-0 bg-[#10051d]/95 backdrop-blur-md border-t border-[#8500ff]/60 pb-safe-only"
        >
          <div className="grid grid-cols-4">
            {mobileNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative min-h-[58px] flex flex-col items-center justify-center gap-1 py-1.5 transition-transform active:scale-95 ${
                    active ? 'text-white' : 'text-[#b58ae6]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 h-[3px] w-8 rounded-b-full transition-opacity ${
                      active ? 'bg-[#c000ff] opacity-100' : 'opacity-0'
                    }`}
                  />
                  <span className={active ? 'text-[#c000ff]' : 'text-[#b58ae6]'}>
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-medium leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </main>

      <OfflineIndicator />

      <TaskDrawer
        open={drawerOpen}
        initialTask={editingTask}
        defaultDate={selectedDate}
        googleConnected={googleConnected}
        onClose={() => {
          setDrawerOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTaskFromDrawer}
        onSyncToGoogleTasks={(task) =>
          requestSyncToGoogleTasks({
            title: task.title,
            dueDate: task.dueDate,
            notes: task.notes,
          })
        }
      />

      <ConfirmationModal
        request={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </div>
  );
}
