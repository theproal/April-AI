import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { app, auth } from './googleAuth';
import type { ChatMessage, ChatSession, ProposedAction } from '../types';

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `${prefix}_${Date.now()}`;
}

function sanitizePayloadMap(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (typeof v === 'string') {
      out[k] = v.slice(0, 2000);
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 10).map((item) => (typeof item === 'string' ? item.slice(0, 500) : String(item)));
    } else {
      out[k] = String(v).slice(0, 1000);
    }
  }
  return out;
}

function sanitizeActions(actions?: ProposedAction[]): Array<{
  id: string;
  type: ProposedAction['type'];
  payload: Record<string, unknown>;
  status: 'pending' | 'executed';
}> {
  if (!actions || actions.length === 0) return [];
  return actions.slice(0, 5).map((act) => ({
    id: sanitizeId(act.id, 'act'),
    type: act.type,
    payload: sanitizePayloadMap(act.payload ?? {}),
    status: act.status === 'executed' ? 'executed' : 'pending',
  }));
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (!user.emailVerified) {
    return;
  }
  const uid = sanitizeId(user.uid, 'user');
  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  try {
    const existingSnap = await getDoc(userRef);
    const displayName = (user.displayName || '').trim().slice(0, 120);
    const batch = writeBatch(db);

    if (!existingSnap.exists()) {
      const accountData: Record<string, unknown> = {
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (displayName) accountData.displayName = displayName;
      batch.set(userRef, accountData);
    } else {
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (displayName) updateData.displayName = displayName;
      batch.update(userRef, updateData);
    }

    if (user.email && user.email.length >= 3 && user.email.length <= 254) {
      batch.set(privateRef, {
        ownerId: uid,
        email: user.email,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export function subscribeUserChats(
  uid: string,
  onChats: (chats: Array<{ id: string; name: string; updatedAtMs: number }>) => void,
  onError: (err: unknown) => void
): () => void {
  const chatsPath = `users/${uid}/chats`;
  const q = query(collection(db, 'users', uid, 'chats'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => {
        const data = d.data() as { id?: string; name?: string; updatedAt?: unknown };
        return {
          id: data.id || d.id,
          name: data.name || 'Nuevo chat',
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onChats(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, chatsPath);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeChatMessages(
  uid: string,
  chatId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (err: unknown) => void
): () => void {
  const messagesPath = `users/${uid}/chats/${chatId}/messages`;
  const q = query(
    collection(db, 'users', uid, 'chats', chatId, 'messages'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => {
          const data = d.data() as {
            id?: string;
            role?: 'user' | 'model';
            text?: string;
            timestamp?: string;
            attachmentNames?: string[];
            actions?: ProposedAction[];
            createdAt?: unknown;
          };
          return {
            createdAtMs: toMillis(data.createdAt),
            msg: {
              id: data.id || d.id,
              role: data.role === 'model' ? 'model' : 'user',
              text: data.text || '',
              timestamp: data.timestamp || '',
              attachments: data.attachmentNames?.map((name) => ({
                name,
                kind: 'file' as const,
              })),
              actions: data.actions,
            } satisfies ChatMessage,
          };
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs || a.msg.id.localeCompare(b.msg.id))
        .map((item) => item.msg);
      onMessages(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, messagesPath);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function createAccountChatSession(
  user: User,
  chatId: string,
  name: string
): Promise<void> {
  const uid = sanitizeId(user.uid, 'user');
  const safeChatId = sanitizeId(chatId, 'chat');
  const safeName = (name.trim() || 'Nuevo chat').slice(0, 120);
  const chatPath = `users/${uid}/chats/${safeChatId}`;

  try {
    await ensureUserProfile(user);
    const chatRef = doc(db, 'users', uid, 'chats', safeChatId);
    const existing = await getDoc(chatRef);
    if (!existing.exists()) {
      const batch = writeBatch(db);
      batch.set(chatRef, {
        id: safeChatId,
        ownerId: uid,
        name: safeName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, chatPath);
  }
}

export async function saveAccountChatMessage(
  user: User,
  chatId: string,
  chatName: string,
  message: ChatMessage,
  shouldUpdateChatName: boolean
): Promise<void> {
  const uid = sanitizeId(user.uid, 'user');
  const safeChatId = sanitizeId(chatId, 'chat');
  const safeMsgId = sanitizeId(message.id, 'msg');
  const safeChatName = (chatName.trim() || 'Nuevo chat').slice(0, 120);
  const msgPath = `users/${uid}/chats/${safeChatId}/messages/${safeMsgId}`;

  try {
    await ensureUserProfile(user);
    const chatRef = doc(db, 'users', uid, 'chats', safeChatId);
    const msgRef = doc(db, 'users', uid, 'chats', safeChatId, 'messages', safeMsgId);
    const chatSnap = await getDoc(chatRef);

    const batch = writeBatch(db);
    if (!chatSnap.exists()) {
      batch.set(chatRef, {
        id: safeChatId,
        ownerId: uid,
        name: safeChatName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (shouldUpdateChatName) {
      batch.update(chatRef, {
        name: safeChatName,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(chatRef, {
        updatedAt: serverTimestamp(),
      });
    }

    const msgPayload: Record<string, unknown> = {
      id: safeMsgId,
      ownerId: uid,
      chatId: safeChatId,
      role: message.role,
      text: (message.text || '').slice(0, 20000),
      timestamp: (message.timestamp || '').slice(0, 24),
      createdAt: serverTimestamp(),
    };

    if (message.attachments && message.attachments.length > 0) {
      msgPayload.attachmentNames = message.attachments
        .slice(0, 3)
        .map((a) => (a.name || 'archivo').slice(0, 200));
    }

    const sanitizedActions = sanitizeActions(message.actions);
    if (sanitizedActions.length > 0) {
      msgPayload.actions = sanitizedActions;
    }

    batch.set(msgRef, msgPayload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }
}

export async function updateAccountMessageActions(
  uid: string,
  chatId: string,
  messageId: string,
  actions: ProposedAction[]
): Promise<void> {
  const safeUid = sanitizeId(uid, 'user');
  const safeChatId = sanitizeId(chatId, 'chat');
  const safeMsgId = sanitizeId(messageId, 'msg');
  const msgPath = `users/${safeUid}/chats/${safeChatId}/messages/${safeMsgId}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', safeUid, 'chats', safeChatId, 'messages', safeMsgId), {
      actions: sanitizeActions(actions),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, msgPath);
  }
}

export async function deleteAccountChat(uid: string, chatId: string): Promise<void> {
  const safeUid = sanitizeId(uid, 'user');
  const safeChatId = sanitizeId(chatId, 'chat');
  const chatPath = `users/${safeUid}/chats/${safeChatId}`;

  try {
    const msgsQuery = query(
      collection(db, 'users', safeUid, 'chats', safeChatId, 'messages'),
      where('ownerId', '==', safeUid)
    );
    const msgsSnap = await getDocs(msgsQuery);

    const refs = msgsSnap.docs.map((d) => d.ref);
    // Delete in batches of <= 400 + parent chat at the end
    for (let i = 0; i < refs.length; i += 400) {
      const chunk = refs.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      if (i + 400 >= refs.length) {
        batch.delete(doc(db, 'users', safeUid, 'chats', safeChatId));
      }
      await batch.commit();
    }

    if (refs.length === 0) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', safeUid, 'chats', safeChatId));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, chatPath);
  }
}

export function mergeChatMessages(
  session: ChatSession,
  messages: ChatMessage[]
): ChatSession {
  return {
    ...session,
    messages,
  };
}
