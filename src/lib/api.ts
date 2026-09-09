const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

// For web development this is the Spring Boot default. Set EXPO_PUBLIC_API_URL
// to a LAN/hosted URL when running the app on a physical device.
export const apiUrl = (configuredApiUrl || 'http://localhost:4000').replace(/\/$/, '');

export type User = { id: string; name: string; email: string; createdAt: string };
export type AuthSession = { user: User; token: string; expiresAt: string };
export type InstagramAccount = { id: string; username: string; isDefault: boolean };
export type Asset = { id: string; originalName: string; kind: 'image' | 'video'; publicUrl: string };
export type Post = { id: string; status: string; instagramMediaId?: string; scheduledFor?: string | null };

type ApiErrorBody = { message?: string };

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Could not reach the API at ${apiUrl}. Start the Instapost backend and check EXPO_PUBLIC_API_URL.`);
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & ApiErrorBody) : ({} as T & ApiErrorBody);
  if (!response.ok) throw new Error(body.message || `API request failed (${response.status}).`);
  return body;
}

export function login(email: string, password: string) {
  return request<AuthSession>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function signup(name: string, email: string, password: string) {
  return request<AuthSession>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
}

export function logout(token: string) {
  return request<void>('/api/auth/logout', { method: 'POST' }, token);
}

export async function ensureInstagramAccount(token: string): Promise<InstagramAccount> {
  const current = await request<{ accounts: InstagramAccount[] }>('/api/integrations/instagram/accounts', {}, token);
  const existing = current.accounts.find((account) => account.isDefault) || current.accounts[0];
  if (existing) return existing;
  const connected = await request<{ account: InstagramAccount }>('/api/integrations/instagram/accounts/mock', { method: 'POST' }, token);
  return connected.account;
}

export function uploadAsset(token: string, file: File) {
  const data = new FormData();
  data.append('file', file);
  return request<{ asset: Asset }>('/api/assets', { method: 'POST', body: data }, token);
}

export function createPost(token: string, input: { instagramAccountId: string; assetId: string; caption: string }) {
  return request<{ post: Post }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({
      instagramAccountId: input.instagramAccountId,
      type: 'image',
      media: [{ assetId: input.assetId }],
      caption: input.caption,
    }),
  }, token);
}

export function publishPost(token: string, postId: string) {
  return request<{ post: Post }>('/api/posts/' + postId + '/publish', {
    method: 'POST',
    headers: { 'Idempotency-Key': `publish-${postId}-${Date.now()}` },
  }, token);
}
