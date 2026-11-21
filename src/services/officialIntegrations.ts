import type { AprilTask } from '../types';

export function buildWhatsAppUrl(phoneDigits: string | undefined, message: string): string {
  const cleanPhone = (phoneDigits ?? '').replace(/\D/g, '');
  const encodedText = encodeURIComponent(message);
  if (cleanPhone.length >= 7) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

export function buildTelegramShareUrl(message: string, username?: string): string {
  const cleanUser = (username ?? '').replace(/^@/, '').trim();
  if (cleanUser) {
    return `https://t.me/${encodeURIComponent(cleanUser)}?text=${encodeURIComponent(message)}`;
  }
  return `https://t.me/share/url?url=${encodeURIComponent('https://april-ia.app')}&text=${encodeURIComponent(message)}`;
}

export function buildGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function formatTasksDigestForMessaging(tasks: AprilTask[], heading = 'Resumen de tareas — April IA'): string {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) {
    return `${heading}\n\nNo tienes tareas pendientes por ahora.`;
  }
  const lines = pending.slice(0, 12).map((t, idx) => {
    const timePart = t.dueTime ? ` (${t.dueTime})` : '';
    const datePart = t.dueDate ? ` · ${t.dueDate}` : '';
    return `${idx + 1}. ${t.title}${timePart}${datePart}`;
  });
  return `${heading}\n\n${lines.join('\n')}`;
}

export function downloadTaskAsIcs(task: AprilTask): void {
  const dateCompact = task.dueDate.replace(/-/g, '');
  const timeParts = (task.dueTime || '09:00').split(':');
  const startH = timeParts[0].padStart(2, '0');
  const startM = (timeParts[1] || '00').padStart(2, '0');
  const endH = String((Number(startH) + 1) % 24).padStart(2, '0');

  const dtStart = `${dateCompact}T${startH}${startM}00`;
  const dtEnd = `${dateCompact}T${endH}${startM}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const escapeIcs = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//April IA//Personal Assistant//ES',
    'BEGIN:VEVENT',
    `UID:${task.id}@april-ia`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(task.title)}`,
    task.location ? `LOCATION:${escapeIcs(task.location)}` : '',
    task.notes ? `DESCRIPTION:${escapeIcs(task.notes)}` : 'DESCRIPTION:Recordatorio creado con April IA',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `april-ia-${task.id.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareViaAndroidSheet(title: string, text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title, text });
    return true;
  }
  return false;
}
