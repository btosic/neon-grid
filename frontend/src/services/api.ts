import { useAuthStore } from '../stores/authStore';
import { GameListItem } from '../types/game';

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface AuthResponse {
  access_token: string;
  userId: string;
  email: string;
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  listGames: () => request<GameListItem[]>('/games'),

  createGame: () => request<GameListItem>('/games', { method: 'POST' }),

  joinGame: (id: string) =>
    request<GameListItem>(`/games/${id}/join`, { method: 'POST' }),

  getReplay: (id: string) => request<unknown[]>(`/games/${id}/replay`),
};
