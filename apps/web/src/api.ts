import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import type { SemanticMap, ScoreBundle, InvestigationResult } from '../../../packages/contracts';

export type Bundle = {
  map: SemanticMap;
  score: ScoreBundle;
  sources: Record<string, string>;
  sample_id?: string;
  investigation?: InvestigationResult;
  trace?: { seq: number; type: string; timestamp: string; payload: Record<string, any> }[];
};
export type PublicConfig = {
  live_enabled: boolean;
  firebase: { apiKey: string; authDomain: string; projectId: string; appId: string };
  model_id: string;
};
let firebase: FirebaseApp | undefined;
export let currentUser: User | null = null;
export async function setupAuth(config: PublicConfig, onUser: (user: User | null) => void) {
  if (!config.firebase.apiKey) return;
  firebase = initializeApp(config.firebase);
  const auth = getAuth(firebase);
  await setPersistence(auth, browserSessionPersistence);
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    onUser(user);
  });
}
export async function login(email: string, password: string) {
  if (!firebase) throw new Error('認証設定を準備中です。サンプルの再生は利用できます。');
  await signInWithEmailAndPassword(getAuth(firebase), email, password);
}
export async function logout() {
  if (firebase) await signOut(getAuth(firebase));
}
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (currentUser) headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['Idempotency-Key'] = crypto.randomUUID();
  }
  const response = await fetch(`/api/v1${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? `接続エラー (${response.status})`);
  return result.data;
}
