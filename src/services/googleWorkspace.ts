import type {
  CalendarEventItem,
  EmailInsight,
  GoogleTaskList,
  GoogleTaskRemote,
} from '../types';

async function googleFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new Error('TOKEN_EXPIRED');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google API error (${res.status}): ${text || res.statusText}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

export async function fetchUpcomingCalendarEvents(
  accessToken: string,
  daysAhead = 7
): Promise<CalendarEventItem[]> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const maxDate = new Date(now.getTime() + daysAhead * 86400000).toISOString();

  const params = new URLSearchParams({
    timeMin: startOfToday,
    timeMax: maxDate,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  });

  const data = await googleFetch<{
    items?: Array<{
      id: string;
      summary?: string;
      location?: string;
      description?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, accessToken);

  return (data.items ?? []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || '(Sin título)',
    start: ev.start?.dateTime || ev.start?.date || '',
    end: ev.end?.dateTime || ev.end?.date,
    location: ev.location,
    description: ev.description,
    htmlLink: ev.htmlLink,
    allDay: Boolean(ev.start?.date && !ev.start?.dateTime),
  }));
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime?: string; // HH:MM
    location?: string;
    description?: string;
  }
): Promise<CalendarEventItem> {
  const tzOffsetMin = -new Date().getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(tzOffsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  const offsetStr = `${sign}${hh}:${mm}`;

  const startIso = `${event.date}T${event.startTime}:00${offsetStr}`;
  let endTime = event.endTime;
  if (!endTime) {
    const [hStr, mStr] = event.startTime.split(':');
    const nextH = (Number(hStr) + 1) % 24;
    endTime = `${String(nextH).padStart(2, '0')}:${mStr || '00'}`;
  }
  const endIso = `${event.date}T${endTime}:00${offsetStr}`;

  const created = await googleFetch<{
    id: string;
    summary?: string;
    location?: string;
    description?: string;
    htmlLink?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
  }>('https://www.googleapis.com/calendar/v3/calendars/primary/events', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      summary: event.summary,
      location: event.location || undefined,
      description: event.description || 'Agendado desde April IA',
      start: { dateTime: startIso },
      end: { dateTime: endIso },
    }),
  });

  return {
    id: created.id,
    summary: created.summary || event.summary,
    start: created.start?.dateTime || startIso,
    end: created.end?.dateTime || endIso,
    location: created.location,
    description: created.description,
    htmlLink: created.htmlLink,
  };
}

export async function fetchGoogleTasks(accessToken: string): Promise<{
  lists: GoogleTaskList[];
  tasks: GoogleTaskRemote[];
}> {
  const listsData = await googleFetch<{
    items?: Array<{ id: string; title?: string }>;
  }>('https://tasks.googleapis.com/tasks/v1/users/@me/lists', accessToken);

  const lists: GoogleTaskList[] = (listsData.items ?? []).map((l) => ({
    id: l.id,
    title: l.title || 'Mis tareas',
  }));

  if (lists.length === 0) {
    return { lists: [], tasks: [] };
  }

  const primaryList = lists[0];
  const tasksData = await googleFetch<{
    items?: Array<{
      id: string;
      title?: string;
      status?: 'needsAction' | 'completed';
      due?: string;
      notes?: string;
    }>;
  }>(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(primaryList.id)}/tasks?showCompleted=true&maxResults=40`,
    accessToken
  );

  const tasks: GoogleTaskRemote[] = (tasksData.items ?? [])
    .filter((t) => Boolean(t.title))
    .map((t) => ({
      id: t.id,
      title: t.title || '',
      status: t.status === 'completed' ? 'completed' : 'needsAction',
      due: t.due ? t.due.slice(0, 10) : undefined,
      notes: t.notes,
      listId: primaryList.id,
      listTitle: primaryList.title,
    }));

  return { lists, tasks };
}

export async function createGoogleTask(
  accessToken: string,
  listId: string,
  task: { title: string; dueDate?: string; notes?: string }
): Promise<GoogleTaskRemote> {
  const body: Record<string, string> = { title: task.title };
  if (task.notes) body.notes = task.notes;
  if (task.dueDate) body.due = `${task.dueDate}T00:00:00.000Z`;

  const created = await googleFetch<{
    id: string;
    title: string;
    status: 'needsAction' | 'completed';
    due?: string;
    notes?: string;
  }>(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    id: created.id,
    title: created.title,
    status: created.status,
    due: created.due ? created.due.slice(0, 10) : undefined,
    notes: created.notes,
    listId,
    listTitle: 'Google Tasks',
  };
}

export async function toggleGoogleTaskStatus(
  accessToken: string,
  listId: string,
  taskId: string,
  completed: boolean
): Promise<void> {
  await googleFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: completed ? 'completed' : 'needsAction',
      }),
    }
  );
}

export async function deleteGoogleTask(
  accessToken: string,
  listId: string,
  taskId: string
): Promise<void> {
  await googleFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}

export async function fetchRecentGmailInsights(accessToken: string): Promise<EmailInsight[]> {
  const listData = await googleFetch<{
    messages?: Array<{ id: string }>;
  }>('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=6&q=in:inbox', accessToken);

  const ids = (listData.messages ?? []).slice(0, 6);
  if (ids.length === 0) return [];

  const details = await Promise.all(
    ids.map((m) =>
      googleFetch<{
        id: string;
        snippet?: string;
        payload?: { headers?: Array<{ name: string; value: string }> };
      }>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        accessToken
      ).catch(() => null)
    )
  );

  return details
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((d) => {
      const headers = d.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
      return {
        id: d.id,
        subject: getHeader('Subject') || '(Sin asunto)',
        from: getHeader('From').replace(/<.*?>/g, '').trim() || 'Remitente',
        snippet: d.snippet || '',
        date: getHeader('Date'),
      };
    });
}
