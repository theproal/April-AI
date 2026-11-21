import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let isSigningIn = false;
// In-memory access token cache only (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export interface GoogleSignInOptions {
  includeWorkspaceScopes?: boolean;
}

export const googleSignIn = async (
  options?: GoogleSignInOptions
): Promise<{ user: User; accessToken: string | null }> => {
  const includeWorkspaceScopes = options?.includeWorkspaceScopes ?? true;
  const provider = new GoogleAuthProvider();
  if (includeWorkspaceScopes) {
    for (const scope of SCOPES) {
      provider.addScope(scope);
    }
  }
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken ?? null;
    cachedAccessToken = includeWorkspaceScopes ? accessToken : null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export interface GoogleAuthErrorInfo {
  code: string;
  message: string;
  canRetryBasicSignIn: boolean;
  isPopupBlocked: boolean;
  usedWorkspaceScopes: boolean;
}

export function formatGoogleAuthError(
  err: unknown,
  usedWorkspaceScopes = true
): GoogleAuthErrorInfo {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const rawMessage = err instanceof Error ? err.message : '';

  switch (code) {
    case 'auth/popup-blocked':
      return {
        code,
        message:
          'Tu navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes o abre April AI en una pestaña nueva.',
        canRetryBasicSignIn: false,
        isPopupBlocked: true,
        usedWorkspaceScopes,
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        message: usedWorkspaceScopes
          ? 'Se cerró la ventana de Google antes de finalizar. Si Google bloqueó los permisos de Calendar/Gmail para esa cuenta, prueba iniciar sesión solo con la cuenta Google.'
          : 'Se cerró la ventana antes de finalizar. Si Google mostró "Acceso bloqueado" para otra cuenta, agrégala como Usuario de prueba (Test user) o publica la app en Google Cloud Console.',
        canRetryBasicSignIn: usedWorkspaceScopes,
        isPopupBlocked: false,
        usedWorkspaceScopes,
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        message: `El dominio actual (${window.location.hostname}) no está autorizado en Firebase Auth.`,
        canRetryBasicSignIn: false,
        isPopupBlocked: false,
        usedWorkspaceScopes,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        message:
          'El proveedor de Google no está habilitado en Firebase Auth para este proyecto.',
        canRetryBasicSignIn: false,
        isPopupBlocked: false,
        usedWorkspaceScopes,
      };
    case 'auth/network-request-failed':
      return {
        code,
        message:
          'No se pudo conectar con los servidores de Google. Revisa tu conexión a internet e intenta otra vez.',
        canRetryBasicSignIn: false,
        isPopupBlocked: false,
        usedWorkspaceScopes,
      };
    case 'auth/internal-error':
      return {
        code,
        message:
          'Error al abrir el acceso de Google (posible bloqueo de cookies de terceros o ventana emergente). Prueba abrir en pestaña nueva.',
        canRetryBasicSignIn: usedWorkspaceScopes,
        isPopupBlocked: true,
        usedWorkspaceScopes,
      };
    default:
      return {
        code: code || 'unknown',
        message: code
          ? `No se completó el inicio de sesión con Google (${code}).`
          : rawMessage || 'No se completó el inicio de sesión con Google.',
        canRetryBasicSignIn: usedWorkspaceScopes,
        isPopupBlocked: false,
        usedWorkspaceScopes,
      };
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};
