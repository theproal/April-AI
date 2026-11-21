# April IA

Asistente personal móvil (PWA / Android TWA) con chat inteligente usando Gemini, gestión de tareas, Google Workspace (Calendar, Tasks y Gmail), Spotify, WhatsApp y Telegram.

## Requisitos

- Node.js 22+
- Variables de entorno configuradas según `.env.example`

## Desarrollo local

```bash
npm install
npm run dev
```

## Compilar y ejecutar en producción

```bash
npm install
npm run build
npm start
```

## Variables de entorno (`.env.example`)

- `GEMINI_API_KEY`: Clave de API de Google Gemini en el servidor.
- `APP_URL`: URL pública HTTPS del servidor desplegado.
- `PORT`: Puerto HTTP (por defecto `3000`; Cloud Run/Render/Railway lo asignan automáticamente).
- `NODE_ENV`: `production` en servidor desplegado.
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`: Credenciales OAuth de Spotify.
- `ANDROID_PACKAGE_NAME` / `ANDROID_SHA256_FINGERPRINT`: Opcional para verificación Digital Asset Links (`/.well-known/assetlinks.json`) en Android TWA/PWABuilder.
