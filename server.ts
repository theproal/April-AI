import 'dotenv/config';
import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, type FunctionDeclaration, type Content, type Part } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const aprilTools: FunctionDeclaration[] = [
  {
    name: 'create_task',
    description: 'Crea una nueva tarea en la lista personal del usuario en April IA.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título claro y conciso de la tarea.' },
        dueDate: { type: Type.STRING, description: 'Fecha límite en formato YYYY-MM-DD.' },
        dueTime: { type: Type.STRING, description: 'Hora opcional en formato HH:MM (24h).' },
        priority: { type: Type.STRING, description: 'Prioridad: alta, media o baja.' },
        category: { type: Type.STRING, description: 'Categoría: Trabajo, Personal, Hogar o Salud.' },
        location: { type: Type.STRING, description: 'Dirección o lugar opcional para abrir en Google Maps.' },
        notes: { type: Type.STRING, description: 'Notas breves o detalles adicionales.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: 'Marca como completada una tarea existente por su ID o título aproximado.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING, description: 'ID exacto de la tarea si está disponible.' },
        taskTitle: { type: Type.STRING, description: 'Título de la tarea a completar.' },
      },
      required: ['taskTitle'],
    },
  },
  {
    name: 'draft_calendar_event',
    description: 'Prepara un borrador de evento en Google Calendar. El usuario deberá confirmarlo antes de guardarlo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Nombre del evento en Google Calendar.' },
        date: { type: Type.STRING, description: 'Fecha en formato YYYY-MM-DD.' },
        startTime: { type: Type.STRING, description: 'Hora de inicio HH:MM (24h).' },
        endTime: { type: Type.STRING, description: 'Hora de fin HH:MM (24h).' },
        location: { type: Type.STRING, description: 'Lugar o enlace de reunión opcional.' },
        description: { type: Type.STRING, description: 'Descripción breve del evento.' },
      },
      required: ['summary', 'date', 'startTime'],
    },
  },
  {
    name: 'draft_google_task',
    description: 'Prepara una tarea para enviar a la cuenta oficial de Google Tasks del usuario previa confirmación.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Título de la tarea en Google Tasks.' },
        dueDate: { type: Type.STRING, description: 'Fecha en formato YYYY-MM-DD.' },
        notes: { type: Type.STRING, description: 'Notas de la tarea.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'draft_whatsapp_message',
    description: 'Prepara un mensaje oficial de WhatsApp (enlace wa.me) para enviar recordatorio o mensaje previa confirmación del usuario.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        recipientName: { type: Type.STRING, description: 'Nombre del contacto o "Mí mismo".' },
        phone: { type: Type.STRING, description: 'Número telefónico con código de país (sin + ni espacios) si se conoce.' },
        message: { type: Type.STRING, description: 'Texto del mensaje de WhatsApp listo para enviar.' },
      },
      required: ['message'],
    },
  },
];

interface ProposedAction {
  id: string;
  type: 'create_task' | 'complete_task' | 'draft_calendar_event' | 'draft_google_task' | 'draft_whatsapp_message';
  payload: Record<string, unknown>;
}

interface SpotifySession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const spotifyOAuthStates = new Map<string, number>();
const spotifySessions = new Map<string, SpotifySession>();

function getSpotifyRedirectUri(req?: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL') {
    return `${configured.replace(/\/$/, '')}/auth/spotify/callback`;
  }
  const host = req?.get('host');
  if (req && host) {
    const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol || 'https';
    return `${proto}://${host}/auth/spotify/callback`;
  }
  return `http://localhost:${PORT}/auth/spotify/callback`;
}

function getCookieValue(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

async function refreshSpotifyToken(session: SpotifySession): Promise<string> {
  if (Date.now() < session.expiresAt - 60000) {
    return session.accessToken;
  }
  if (!session.refreshToken) {
    throw new Error('SPOTIFY_TOKEN_EXPIRED');
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CREDENTIALS_MISSING');
  }
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error('SPOTIFY_TOKEN_EXPIRED');
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  session.accessToken = data.access_token;
  session.expiresAt = Date.now() + data.expires_in * 1000;
  if (data.refresh_token) session.refreshToken = data.refresh_token;
  return session.accessToken;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'April IA' });
  });

  app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
    const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
    const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINT || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!packageName || fingerprints.length === 0) {
      res.json([]);
      return;
    }
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ]);
  });

  app.get('/api/spotify/auth-url', (req: Request, res: Response) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
    const redirectUri = getSpotifyRedirectUri(req);

    if (
      !clientId ||
      !clientSecret ||
      clientId === 'MY_SPOTIFY_CLIENT_ID' ||
      clientSecret === 'MY_SPOTIFY_CLIENT_SECRET'
    ) {
      res.json({
        configured: false,
        error: 'SPOTIFY_CREDENTIALS_MISSING',
        callbackUrl: redirectUri,
      });
      return;
    }

    const state = crypto.randomBytes(16).toString('hex');
    spotifyOAuthStates.set(state, Date.now() + 10 * 60 * 1000);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
      scope: 'user-read-private user-read-email user-read-currently-playing user-read-playback-state playlist-read-private',
    });

    res.json({
      configured: true,
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
    });
  });

  const handleSpotifyCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    if (oauthError) {
      res.status(400).send(`
        <html><body style="background:#08020f;color:#fff;font-family:sans-serif;padding:24px;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: ${JSON.stringify(oauthError)} }, '*');
              window.close();
            }
          </script>
          <p>Autorización cancelada (${oauthError}). Puedes cerrar esta ventana.</p>
        </body></html>
      `);
      return;
    }

    const expiresAt = spotifyOAuthStates.get(state);
    spotifyOAuthStates.delete(state);
    if (!code || !expiresAt || Date.now() > expiresAt) {
      res.status(400).send('Estado OAuth de Spotify inválido o expirado.');
      return;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).send('Faltan credenciales de Spotify en el servidor.');
      return;
    }

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getSpotifyRedirectUri(req),
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        throw new Error(`Spotify token error: ${errBody}`);
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      const sessionId = crypto.randomBytes(24).toString('hex');
      spotifySessions.set(sessionId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      });

      const isHttps = req.secure || req.protocol === 'https';
      res.cookie('april_spotify_session', sessionId, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.send(`
        <html>
          <body style="background:#08020f;color:#fff;font-family:sans-serif;padding:24px;">
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', sessionId: ${JSON.stringify(sessionId)} }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Cuenta de Spotify vinculada correctamente. Esta ventana se cerrará automáticamente.</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('Spotify callback error:', err);
      res.status(500).send('Error al vincular tu cuenta de Spotify.');
    }
  };

  app.get(['/auth/spotify/callback', '/auth/spotify/callback/'], handleSpotifyCallback);

  app.get('/api/spotify/summary', async (req: Request, res: Response) => {
    const headerSession = typeof req.headers['x-spotify-session'] === 'string' ? req.headers['x-spotify-session'] : '';
    const cookieSession = getCookieValue(req, 'april_spotify_session') || '';
    const sessionId = headerSession || cookieSession;

    if (!sessionId || !spotifySessions.has(sessionId)) {
      res.json({ connected: false, summary: null });
      return;
    }

    const session = spotifySessions.get(sessionId)!;
    try {
      const accessToken = await refreshSpotifyToken(session);
      const headers = { Authorization: `Bearer ${accessToken}` };

      const [meRes, playingRes, playlistsRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me', { headers }),
        fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers }),
        fetch('https://api.spotify.com/v1/me/playlists?limit=6', { headers }),
      ]);

      if (!meRes.ok) {
        throw new Error('SPOTIFY_PROFILE_FAILED');
      }

      const me = (await meRes.json()) as {
        id: string;
        display_name?: string;
        email?: string;
        product?: string;
        images?: Array<{ url: string }>;
        external_urls?: { spotify?: string };
      };

      let currentTrack = null;
      if (playingRes.status === 200) {
        const playing = (await playingRes.json()) as {
          is_playing?: boolean;
          item?: {
            name?: string;
            artists?: Array<{ name: string }>;
            external_urls?: { spotify?: string };
          };
        };
        if (playing?.item?.name) {
          currentTrack = {
            name: playing.item.name,
            artists: (playing.item.artists ?? []).map((a) => a.name).join(', '),
            isPlaying: Boolean(playing.is_playing),
            url: playing.item.external_urls?.spotify,
          };
        }
      }

      let playlists: Array<{ id: string; name: string; tracksCount: number; url?: string }> = [];
      if (playlistsRes.ok) {
        const plData = (await playlistsRes.json()) as {
          items?: Array<{
            id: string;
            name?: string;
            tracks?: { total?: number };
            external_urls?: { spotify?: string };
          }>;
        };
        playlists = (plData.items ?? []).map((pl) => ({
          id: pl.id,
          name: pl.name || 'Playlist',
          tracksCount: pl.tracks?.total ?? 0,
          url: pl.external_urls?.spotify,
        }));
      }

      res.json({
        connected: true,
        profile: {
          id: me.id,
          displayName: me.display_name || me.id,
          email: me.email,
          avatarUrl: me.images?.[0]?.url,
          product: me.product,
          profileUrl: me.external_urls?.spotify,
        },
        currentTrack,
        playlists,
      });
    } catch (err) {
      console.error('Spotify summary error:', err);
      spotifySessions.delete(sessionId);
      res.json({ connected: false, summary: null, expired: true });
    }
  });

  app.post('/api/spotify/disconnect', (req: Request, res: Response) => {
    const headerSession = typeof req.headers['x-spotify-session'] === 'string' ? req.headers['x-spotify-session'] : '';
    const cookieSession = getCookieValue(req, 'april_spotify_session') || '';
    const sessionId = headerSession || cookieSession;
    if (sessionId) spotifySessions.delete(sessionId);
    const isHttps = req.secure || req.protocol === 'https';
    res.clearCookie('april_spotify_session', {
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    });
    res.json({ ok: true });
  });

  app.post('/api/april/chat', async (req: Request, res: Response) => {
    try {
      const { message, history, context, attachments } = req.body ?? {};
      const hasMessage = typeof message === 'string' && message.trim().length > 0;
      const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
      if (!hasMessage && !hasAttachments) {
        res.status(400).json({ error: 'El mensaje o un archivo adjunto es obligatorio.' });
        return;
      }

      const ai = getGeminiClient();

      const todayIso = context?.todayIso || new Date().toISOString().slice(0, 10);
      const localTime = context?.localTime || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const userName = typeof context?.userName === 'string' && context.userName.trim() ? context.userName.trim() : null;
      const tasksSummary = JSON.stringify(context?.tasks ?? []);
      const calendarSummary = JSON.stringify(context?.calendarEvents ?? []);
      const emailSummary = JSON.stringify(context?.emailInsights ?? []);
      const contactsSummary = JSON.stringify(context?.whatsappContacts ?? []);
      const connectedApps = JSON.stringify(context?.connectedApps ?? {});

      const systemInstruction = `Eres April IA, una asistente personal de productividad diseñada especialmente para ser clara, serena, práctica y fácil de usar desde Android y escritorio.
Responde siempre en español natural, directo y cálido. Evita tecnicismos innecesarios y respuestas largas: ve al grano con listas claras y pasos accionables.

Contexto actual del usuario:
${userName ? `- Usuario autenticado con Google: ${userName}` : '- Usuario invitado (sin sesión Google)'}
- Fecha de hoy: ${todayIso}
- Hora local: ${localTime}
- Apps vinculadas: ${connectedApps}
- Tareas actuales en April IA: ${tasksSummary}
- Próximos eventos de Google Calendar: ${calendarSummary}
- Correos recientes detectados en Gmail: ${emailSummary}
- Contactos guardados de WhatsApp: ${contactsSummary}

Reglas de comportamiento:
1. Cuando el usuario pida crear, anotar o recordar una tarea (o envíe una imagen/archivo con pendientes), llama a la herramienta \`create_task\`.
2. Cuando pida marcar una tarea como hecha, llama a \`complete_task\`.
3. Cuando pida agendar una cita o evento en su calendario, llama a \`draft_calendar_event\` (explícale que preparaste la propuesta para que la confirme con un toque).
4. Cuando pida guardar en Google Tasks, llama a \`draft_google_task\`.
5. Cuando pida mandar un mensaje o recordatorio por WhatsApp, llama a \`draft_whatsapp_message\` usando el número del contacto guardado si coincide por nombre (explícale que el borrador está listo para confirmar y abrir WhatsApp oficial).
6. Si pide organizar su día, analiza sus tareas pendientes, eventos de Google Calendar y correos recientes de Gmail para proponer un plan horario realista (mañana, tarde, noche) sin saturarlo.
7. Nunca inventes eventos, correos ni contactos que no estén en el contexto.`;

      const contents: Content[] = [];
      if (Array.isArray(history)) {
        for (const item of history.slice(-10)) {
          if (item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string') {
            contents.push({
              role: item.role,
              parts: [{ text: item.text }],
            });
          }
        }
      }

      const userParts: Part[] = [];
      if (hasAttachments) {
        for (const att of attachments.slice(0, 3)) {
          if (att && typeof att.dataBase64 === 'string' && typeof att.mimeType === 'string' && att.dataBase64.length > 0) {
            userParts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.dataBase64,
              },
            });
          } else if (att && typeof att.name === 'string') {
            userParts.push({ text: `[Archivo adjunto: ${att.name}]` });
          }
        }
      }
      userParts.push({
        text: hasMessage ? message : 'Analiza el archivo adjunto y ayúdame a organizarlo en tareas o recordatorios.',
      });

      contents.push({
        role: 'user',
        parts: userParts,
      });

      const response1 = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: aprilTools }],
        },
      });

      const proposedActions: ProposedAction[] = [];
      const functionCalls = response1.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const previousContent = response1.candidates?.[0]?.content;
        const responseParts: Part[] = [];

        for (const fc of functionCalls) {
          const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const name = fc.name as ProposedAction['type'];
          const args = (fc.args ?? {}) as Record<string, unknown>;

          if (
            name === 'create_task' ||
            name === 'complete_task' ||
            name === 'draft_calendar_event' ||
            name === 'draft_google_task' ||
            name === 'draft_whatsapp_message'
          ) {
            proposedActions.push({
              id: actionId,
              type: name,
              payload: args,
            });
          }

          responseParts.push({
            functionResponse: {
              id: fc.id,
              name: fc.name ?? 'action',
              response: {
                status: name === 'create_task' || name === 'complete_task' ? 'executed_locally' : 'awaiting_user_confirmation',
                args,
              },
            },
          });
        }

        if (previousContent) {
          const response2 = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: [
              ...contents,
              previousContent,
              {
                role: 'user',
                parts: responseParts,
              },
            ],
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: aprilTools }],
            },
          });

          res.json({
            reply: response2.text ?? 'Listo, preparé las acciones para ti.',
            actions: proposedActions,
          });
          return;
        }
      }

      res.json({
        reply: response1.text ?? '¿En qué te puedo ayudar hoy con tus tareas?',
        actions: proposedActions,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      console.error('Error in /api/april/chat:', err);

      if (err?.message === 'GEMINI_API_KEY_MISSING') {
        res.status(503).json({
          error: 'No se detectó la clave del servicio de IA en el servidor. Configura GEMINI_API_KEY en Settings > Secrets.',
        });
        return;
      }

      if (err?.status === 403 || err?.status === 400) {
        res.status(err.status).json({
          error: 'La clave de Gemini API es inválida o no tiene permisos. Verifica Settings > Secrets.',
        });
        return;
      }

      if (err?.status === 429) {
        res.status(429).json({
          error: 'Se alcanzó el límite temporal de solicitudes. Intenta de nuevo en unos segundos.',
        });
        return;
      }

      res.status(500).json({
        error: 'No pude procesar tu solicitud en este momento. Intenta nuevamente.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/manifest.webmanifest', (_req: Request, res: Response) => {
      res.type('application/manifest+json').json({
        id: '/',
        name: 'April IA',
        short_name: 'April IA',
        description: 'Asistente personal inteligente para Android y escritorio que organiza tus tareas y vincula tus apps oficiales.',
        lang: 'es',
        dir: 'ltr',
        theme_color: '#10051d',
        background_color: '#08020f',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['productivity', 'utilities'],
        prefer_related_applications: false,
        start_url: '/',
        scope: '/',
        shortcuts: [
          {
            name: 'Chat con April',
            short_name: 'Chat IA',
            description: 'Habla con April IA',
            url: '/?tab=april',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Agenda de hoy',
            short_name: 'Hoy',
            description: 'Revisa tus tareas y eventos de hoy',
            url: '/?tab=hoy',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Mis tareas',
            short_name: 'Tareas',
            description: 'Organiza todos tus pendientes',
            url: '/?tab=tareas',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Apps oficiales',
            short_name: 'Apps',
            description: 'Conecta Google, Spotify y WhatsApp',
            url: '/?tab=apps',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      });
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.use('/api', (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Ruta de API no encontrada.' });
    });
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`April IA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
