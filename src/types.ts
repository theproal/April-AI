export type TaskPriority = 'alta' | 'media' | 'baja';
export type TaskCategory = 'Trabajo' | 'Personal' | 'Hogar' | 'Salud';
export type TabId = 'april' | 'hoy' | 'tareas' | 'apps';

export interface AprilTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority: TaskPriority;
  category: TaskCategory;
  location?: string;
  notes?: string;
  source?: 'april' | 'google_tasks' | 'gmail';
  googleTaskId?: string;
  googleTaskListId?: string;
  createdAt: string;
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  allDay?: boolean;
}

export interface GoogleTaskList {
  id: string;
  title: string;
}

export interface GoogleTaskRemote {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;
  notes?: string;
  listId: string;
  listTitle: string;
}

export interface EmailInsight {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

export interface SpotifyProfile {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  product?: string;
  profileUrl?: string;
}

export interface SpotifyTrackItem {
  name: string;
  artists: string;
  isPlaying: boolean;
  url?: string;
}

export interface SpotifyPlaylistItem {
  id: string;
  name: string;
  tracksCount: number;
  url?: string;
}

export interface SpotifySummary {
  profile: SpotifyProfile;
  currentTrack: SpotifyTrackItem | null;
  playlists: SpotifyPlaylistItem[];
}

export interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  relation?: string;
}

export interface OfficialAppPreferences {
  whatsappSelfPhone: string;
  whatsappContacts: WhatsAppContact[];
  telegramUsername: string;
  notificationsEnabled: boolean;
}

export interface ProposedAction {
  id: string;
  type:
    | 'create_task'
    | 'complete_task'
    | 'draft_calendar_event'
    | 'draft_google_task'
    | 'draft_whatsapp_message';
  payload: Record<string, unknown>;
  status?: 'pending' | 'executed' | 'dismissed';
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: 'file' | 'image' | 'video';
  dataBase64: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  attachments?: Array<{ name: string; kind: 'file' | 'image' | 'video' }>;
  actions?: ProposedAction[];
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
}

export interface ConfirmationRequest {
  title: string;
  description: string;
  details: string[];
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}
