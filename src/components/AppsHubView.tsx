import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  MapPin,
  MessageCircle,
  Music2,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AprilTask,
  OfficialAppPreferences,
  SpotifySummary,
  WhatsAppContact,
} from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallButton';
import {
  downloadTaskAsIcs,
  formatTasksDigestForMessaging,
  shareViaAndroidSheet,
} from '../services/officialIntegrations';

interface AppsHubViewProps {
  googleUser: User | null;
  googleConnected: boolean;
  isLoggingInGoogle: boolean;
  isSyncingGoogle: boolean;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onRefreshGoogle: () => void;
  spotifySummary: SpotifySummary | null;
  isConnectingSpotify: boolean;
  spotifyError: string | null;
  spotifyCallbackUrl?: string | null;
  onConnectSpotify: () => void;
  onDisconnectSpotify: () => void;
  onRefreshSpotify: () => void;
  prefs: OfficialAppPreferences;
  onUpdatePrefs: (next: OfficialAppPreferences) => void;
  tasks: AprilTask[];
  onSendWhatsAppWithConfirm: (phone: string | undefined, recipientName: string, message: string) => void;
  onSendTelegramWithConfirm: (message: string) => void;
}

export const AppsHubView: React.FC<AppsHubViewProps> = ({
  googleUser,
  googleConnected,
  isLoggingInGoogle,
  isSyncingGoogle,
  onConnectGoogle,
  onDisconnectGoogle,
  onRefreshGoogle,
  spotifySummary,
  isConnectingSpotify,
  spotifyError,
  spotifyCallbackUrl,
  onConnectSpotify,
  onDisconnectSpotify,
  onRefreshSpotify,
  prefs,
  onUpdatePrefs,
  tasks,
  onSendWhatsAppWithConfirm,
  onSendTelegramWithConfirm,
}) => {
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = contactPhone.replace(/\D/g, '');
    if (!contactName.trim() || cleanPhone.length < 7) return;
    const nextContact: WhatsAppContact = {
      id: `wa_${Date.now()}`,
      name: contactName.trim(),
      phone: cleanPhone,
    };
    onUpdatePrefs({
      ...prefs,
      whatsappContacts: [...prefs.whatsappContacts, nextContact],
    });
    setContactName('');
    setContactPhone('');
  };

  const handleRemoveContact = (id: string) => {
    onUpdatePrefs({
      ...prefs,
      whatsappContacts: prefs.whatsappContacts.filter((c) => c.id !== id),
    });
  };

  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
      setStatusNotice('Este navegador no soporta notificaciones locales.');
      return;
    }
    if (!prefs.notificationsEnabled) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        onUpdatePrefs({ ...prefs, notificationsEnabled: true });
        new Notification('April IA', {
          body: 'Recordatorios de tareas activados correctamente.',
        });
      } else {
        setStatusNotice('Permiso de notificaciones denegado en el navegador.');
      }
    } else {
      onUpdatePrefs({ ...prefs, notificationsEnabled: false });
    }
  };

  const handleShareAll = async () => {
    const digest = formatTasksDigestForMessaging(tasks);
    const ok = await shareViaAndroidSheet('Agenda April IA', digest).catch(() => false);
    if (!ok) {
      await navigator.clipboard?.writeText(digest).catch(() => undefined);
      setStatusNotice('Resumen copiado al portapapeles.');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleExportNextTaskIcs = () => {
    const nextTask = tasks.find((t) => !t.completed);
    if (!nextTask) {
      setStatusNotice('No hay tareas pendientes para exportar.');
      setTimeout(() => setStatusNotice(null), 3000);
      return;
    }
    downloadTaskAsIcs(nextTask);
  };

  return (
    <div className="flex-1 overflow-y-auto touch-scroll px-3.5 py-4 sm:px-8 sm:py-7 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Apps Oficiales vinculadas</h1>
        <p className="text-xs sm:text-sm text-[#c38bff] mt-0.5">
          Conecta tus cuentas y accesos oficiales para sincronizar eventos, tareas, música y mensajes desde tu móvil.
        </p>
      </div>

      {statusNotice && (
        <div className="rounded-xl border border-[#8500ff] bg-[#1b0b2d] px-4 py-2.5 text-xs font-medium text-[#d9aaff]">
          {statusNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 1. Google Calendar, Tasks y Gmail */}
        <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Google Calendar, Tasks y Gmail
              </h2>
              <p className="text-xs text-[#c38bff] mt-1">
                Conexión oficial directa con Google Workspace ·{' '}
                <span className={googleConnected ? 'text-[#d9aaff] font-medium' : ''}>
                  {googleConnected ? 'Vinculado' : 'Sin vincular'}
                </span>
              </p>
            </div>
            {googleConnected && <CheckCircle2 className="w-5 h-5 text-[#c000ff] shrink-0" />}
          </div>

          {googleConnected && googleUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-[#1b0b2d] p-3.5">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Usuario de Google'}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#8500e8] text-white flex items-center justify-center font-semibold shrink-0">
                    {(googleUser.displayName || 'G')[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {googleUser.displayName || 'Cuenta de Google'}
                  </p>
                  <p className="text-xs text-[#c38bff] truncate">{googleUser.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRefreshGoogle}
                  disabled={isSyncingGoogle}
                  className="min-h-[44px] px-4 rounded-[10px] bg-[#8500e8] hover:bg-[#a000ff] text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                  <span>{isSyncingGoogle ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
                </button>
                <button
                  type="button"
                  onClick={onConnectGoogle}
                  disabled={isLoggingInGoogle}
                  className="min-h-[44px] px-4 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span>Cambiar cuenta</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectGoogle}
                  className="min-h-[44px] px-4 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Desvincular</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {googleUser && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#1b0b2d] p-3 border border-[#6500a8]/60">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      Sesión activa: {googleUser.displayName || googleUser.email}
                    </p>
                    <p className="text-[11px] text-[#c38bff] truncate">{googleUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onDisconnectGoogle}
                    className="min-h-[44px] px-3 rounded-lg border border-[#6500a8] text-xs text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white shrink-0"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
              <p className="text-sm text-[#d9b5ff] leading-relaxed">
                Autoriza el acceso para que April IA muestre tu agenda de Google Calendar, sincronice tus listas de Google Tasks y detecte pendientes en Gmail.
              </p>
              <GoogleSignInButton
                onClick={onConnectGoogle}
                disabled={isLoggingInGoogle}
                label={isLoggingInGoogle ? 'Conectando...' : 'Vincular Calendar, Tasks y Gmail'}
                fullWidth
              />
            </div>
          )}
        </section>

        {/* 2. Spotify Oficial */}
        <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Spotify Oficial</h2>
              <p className="text-xs text-[#c38bff] mt-1">
                Perfil, canción actual y listas de enfoque ·{' '}
                <span className={spotifySummary ? 'text-[#d9aaff] font-medium' : ''}>
                  {spotifySummary ? 'Vinculado' : 'Sin vincular'}
                </span>
              </p>
            </div>
            {spotifySummary ? (
              <CheckCircle2 className="w-5 h-5 text-[#1DB954] shrink-0" />
            ) : (
              <Music2 className="w-5 h-5 text-[#1DB954] shrink-0" />
            )}
          </div>

          {spotifyError && (
            <div className="rounded-xl border border-[#ff4d8d]/45 bg-[#2a081d] px-3.5 py-3 text-xs text-[#ffb3cd] leading-relaxed space-y-2.5">
              <p className="font-medium">{spotifyError}</p>
              {spotifyCallbackUrl && (
                <div className="space-y-2 pt-1 border-t border-[#ff4d8d]/25 text-[#f7d4e2]">
                  <p>
                    1. Crea una app en{' '}
                    <a
                      href="https://developer.spotify.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold text-white hover:text-[#1DB954]"
                    >
                      Spotify Developer Dashboard
                    </a>{' '}
                    y agrega este Redirect URI exacto:
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-[#170925] border border-[#6500a8] px-2.5 py-2">
                    <code className="flex-1 min-w-0 truncate text-[11px] font-mono text-[#d9aaff]">
                      {spotifyCallbackUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(spotifyCallbackUrl);
                        setCopiedCallback(true);
                        setTimeout(() => setCopiedCallback(false), 2000);
                      }}
                      className="min-h-[38px] px-2.5 py-1 rounded bg-[#6500a8] hover:bg-[#8500e8] text-white text-xs inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedCallback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCallback ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p>
                    2. En AI Studio ve a <strong>Settings &gt; Secrets</strong> y agrega{' '}
                    <code className="font-mono text-white">SPOTIFY_CLIENT_ID</code> y{' '}
                    <code className="font-mono text-white">SPOTIFY_CLIENT_SECRET</code>.
                  </p>
                </div>
              )}
            </div>
          )}

          {spotifySummary ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-[#1b0b2d] p-3.5">
                {spotifySummary.profile.avatarUrl ? (
                  <img
                    src={spotifySummary.profile.avatarUrl}
                    alt={spotifySummary.profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center font-bold shrink-0">
                    {(spotifySummary.profile.displayName || 'S')[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {spotifySummary.profile.displayName}
                  </p>
                  <p className="text-xs text-[#c38bff] truncate">
                    {spotifySummary.profile.email || 'Cuenta Spotify'}
                    {spotifySummary.profile.product ? ` · ${spotifySummary.profile.product}` : ''}
                  </p>
                </div>
              </div>

              {spotifySummary.currentTrack && (
                <div className="rounded-xl border border-[#6500a8] bg-[#170925] px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#1DB954]">
                      {spotifySummary.currentTrack.isPlaying ? 'Reproduciendo ahora' : 'Última canción'}
                    </p>
                    <p className="text-xs font-medium text-white truncate">
                      {spotifySummary.currentTrack.name} · {spotifySummary.currentTrack.artists}
                    </p>
                  </div>
                  {spotifySummary.currentTrack.url && (
                    <a
                      href={spotifySummary.currentTrack.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir canción en Spotify"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#c38bff] hover:text-white"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              {spotifySummary.playlists.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[#c38bff]">Tus playlists</p>
                  <ul className="divide-y divide-[#6500a8]/40">
                    {spotifySummary.playlists.slice(0, 4).map((pl) => (
                      <li key={pl.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{pl.name}</p>
                          <p className="text-[11px] font-mono tabular-nums text-[#987cae]">
                            {pl.tracksCount} canciones
                          </p>
                        </div>
                        {pl.url && (
                          <a
                            href={pl.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] px-3 rounded-lg text-xs font-medium text-[#d9b5ff] bg-[#1b0b2d] border border-[#6500a8] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-1 shrink-0"
                          >
                            <span>Abrir</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRefreshSpotify}
                  className="min-h-[44px] px-4 rounded-[10px] bg-[#8500e8] hover:bg-[#a000ff] text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Actualizar Spotify</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectSpotify}
                  className="min-h-[44px] px-4 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Desvincular</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#d9b5ff] leading-relaxed">
                Vincula tu cuenta oficial de Spotify para consultar qué estás escuchando y abrir tus playlists de concentración desde April AI.
              </p>
              <button
                type="button"
                onClick={onConnectSpotify}
                disabled={isConnectingSpotify}
                className="w-full min-h-[44px] px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-60 text-black font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Music2 className="w-4 h-4" />
                <span>{isConnectingSpotify ? 'Conectando Spotify...' : 'Vincular con Spotify'}</span>
              </button>
            </div>
          )}
        </section>

        {/* 3. WhatsApp Oficial */}
        <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">WhatsApp Oficial</h2>
              <p className="text-xs text-[#c38bff] mt-1">
                Envío directo por enlace oficial de WhatsApp (wa.me / app Android)
              </p>
            </div>
            <MessageCircle className="w-5 h-5 text-[#c000ff] shrink-0" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#c38bff] mb-1.5">
              Tu número de WhatsApp (para auto-recordatorios, con código de país)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={prefs.whatsappSelfPhone}
                onChange={(e) =>
                  onUpdatePrefs({ ...prefs, whatsappSelfPhone: e.target.value })
                }
                placeholder="Ej. 5215512345678"
                className="flex-1 min-h-[44px] rounded-xl border border-[#8500ff] bg-[#170925] px-3.5 text-base sm:text-sm font-mono tabular-nums text-white placeholder:text-[#987cae] focus:outline-none focus:ring-2 focus:ring-[#c000ff]"
              />
              <button
                type="button"
                onClick={() =>
                  onSendWhatsAppWithConfirm(
                    prefs.whatsappSelfPhone,
                    'Tu chat de WhatsApp',
                    formatTasksDigestForMessaging(tasks)
                  )
                }
                className="min-h-[44px] px-4 rounded-[10px] bg-[#9900ed] hover:bg-[#c000ff] text-white text-xs font-medium whitespace-nowrap shrink-0 active:scale-95 transition-transform"
              >
                Enviar agenda
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[#6500a8]/50 space-y-3">
            <p className="text-xs font-medium text-[#c38bff]">Contactos rápidos de WhatsApp</p>
            <form onSubmit={handleAddContact} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nombre"
                className="sm:col-span-2 min-h-[44px] rounded-xl border border-[#6500a8] bg-[#170925] px-3 text-base sm:text-sm text-white placeholder:text-[#987cae]"
              />
              <input
                type="tel"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Teléfono (ej. 521...)"
                className="sm:col-span-2 min-h-[44px] rounded-xl border border-[#6500a8] bg-[#170925] px-3 text-base sm:text-sm font-mono tabular-nums text-white placeholder:text-[#987cae]"
              />
              <button
                type="submit"
                aria-label="Agregar contacto de WhatsApp"
                className="min-h-[44px] rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] hover:bg-[#6500a8] flex items-center justify-center gap-1 text-xs font-medium text-[#d9b5ff] hover:text-white active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span className="sm:hidden">Agregar</span>
              </button>
            </form>

            {prefs.whatsappContacts.length > 0 && (
              <ul className="divide-y divide-[#6500a8]/40">
                {prefs.whatsappContacts.map((c) => (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.name}</p>
                      <p className="text-xs font-mono tabular-nums text-[#c38bff]">+{c.phone}</p>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onSendWhatsAppWithConfirm(
                            c.phone,
                            c.name,
                            formatTasksDigestForMessaging(
                              tasks,
                              `Hola ${c.name}, te comparto esto desde April IA:`
                            )
                          )
                        }
                        className="min-h-[44px] px-3 rounded-lg text-xs font-medium text-[#d9aaff] hover:bg-[#6500a8] active:scale-95"
                      >
                        Enviar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(c.id)}
                        aria-label={`Eliminar a ${c.name}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#c38bff] hover:text-[#ff6ea0] active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 4. Telegram, Android PWA y Mapas */}
        <section className="rounded-2xl bg-[#10051d] border border-[#6500a8] p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Telegram, Android y Mapas
              </h2>
              <p className="text-xs text-[#c38bff] mt-1">
                Comparte en Telegram, instala en Android y activa avisos locales
              </p>
            </div>
            <Smartphone className="w-5 h-5 text-[#c000ff] shrink-0" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#c38bff] mb-1.5">
              Usuario de Telegram (opcional, ej. @tuusuario)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={prefs.telegramUsername}
                onChange={(e) =>
                  onUpdatePrefs({ ...prefs, telegramUsername: e.target.value })
                }
                placeholder="@usuario"
                className="flex-1 min-h-[44px] rounded-xl border border-[#8500ff] bg-[#170925] px-3.5 text-base sm:text-sm text-white placeholder:text-[#987cae]"
              />
              <button
                type="button"
                onClick={() => onSendTelegramWithConfirm(formatTasksDigestForMessaging(tasks))}
                className="min-h-[44px] px-4 rounded-[10px] bg-[#9900ed] hover:bg-[#c000ff] text-white text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleShareAll}
              className="min-h-[44px] px-4 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center justify-center gap-2 active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir con app</span>
            </button>
            <button
              type="button"
              onClick={handleExportNextTaskIcs}
              className="min-h-[44px] px-4 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] text-xs font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white inline-flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Exportar .ics</span>
            </button>
          </div>

          <div className="space-y-3 pt-1 border-t border-[#6500a8]/40">
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="w-4 h-4 text-[#c38bff] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Notificaciones del sistema</p>
                  <p className="text-xs text-[#987cae]">Avisos locales en Android y escritorio</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`min-h-[44px] px-4 rounded-[10px] text-xs font-medium transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                  prefs.notificationsEnabled
                    ? 'bg-[#8500e8] text-white'
                    : 'border border-[#6500a8] bg-[#1b0b2d] text-[#d9b5ff]'
                }`}
              >
                {prefs.notificationsEnabled ? 'Activadas' : 'Activar'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="w-4 h-4 text-[#c38bff] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">
                    Google Maps y Calendario nativo
                  </p>
                  <p className="text-xs text-[#987cae]">
                    Añade una dirección a cualquier tarea para navegar en 1 toque
                  </p>
                </div>
              </div>
              <Calendar className="w-4 h-4 text-[#987cae] shrink-0" />
            </div>

            <div className="pt-1">
              <PWAInstallButton />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
