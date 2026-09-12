export interface StoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  role: 'admin' | 'user';
}

const USERS_KEY = 'gp-auth-users';
const SESSION_KEY = 'gp-auth-session';
const EDITOR_KEY = 'gp-in-editor';

export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'bra071992';

/**
 * UUID helper that works outside secure contexts (e.g. phone on http://192.168.x.x).
 * `crypto.randomUUID` is missing there on many mobile browsers.
 */
function createId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Minimal SHA-256 for insecure contexts where `crypto.subtle` is unavailable. */
function sha256Fallback(message: string): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const totalLen = ((bytes.length + 1 + 8 + 63) >> 6) << 6;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  // SHA-256 length is 64-bit big-endian; for short passwords high word is 0.
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let i = 0; i < totalLen; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      const s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return bytesToHex(out);
}

async function hashPassword(password: string): Promise<string> {
  const payload = `gp-auth-v1:${password}`;
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle?.digest) {
    try {
      const data = new TextEncoder().encode(payload);
      const digest = await subtle.digest('SHA-256', data);
      return bytesToHex(new Uint8Array(digest));
    } catch {
      // Insecure context (LAN HTTP) — fall through.
    }
  }
  return sha256Fallback(payload);
}

function readUsers(): StoredUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function ensureDefaultAdminUser(): Promise<void> {
  const users = readUsers();
  if (users.some((user) => user.username === DEFAULT_ADMIN_USERNAME)) return;

  const admin: StoredUser = {
    id: createId(),
    username: DEFAULT_ADMIN_USERNAME,
    email: 'admin@genpuzzle.local',
    passwordHash: await hashPassword(DEFAULT_ADMIN_PASSWORD),
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  writeUsers([admin, ...users]);
}

export function readAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession | null): void {
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readEditorEntered(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(EDITOR_KEY) === '1';
}

export function writeEditorEntered(entered: boolean): void {
  if (entered) {
    sessionStorage.setItem(EDITOR_KEY, '1');
  } else {
    sessionStorage.removeItem(EDITOR_KEY);
  }
}

export async function registerUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();

  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
  if (!input.password || input.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const users = readUsers();
  if (users.some((user) => user.username === username)) {
    throw new Error('This username is already taken.');
  }
  if (users.some((user) => user.email === email)) {
    throw new Error('This email is already registered.');
  }

  const user: StoredUser = {
    id: createId(),
    username,
    email,
    passwordHash: await hashPassword(input.password),
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  writeUsers([...users, user]);

  const session: AuthSession = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };
  writeAuthSession(session);
  return session;
}

export async function loginUser(username: string, password: string): Promise<AuthSession> {
  const normalized = username.trim().toLowerCase();
  const users = readUsers();
  const user = users.find((entry) => entry.username === normalized);

  if (!user) {
    throw new Error('Invalid username or password.');
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.passwordHash) {
    throw new Error('Invalid username or password.');
  }

  const session: AuthSession = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };
  writeAuthSession(session);
  return session;
}

export function logoutUser(): void {
  writeAuthSession(null);
  writeEditorEntered(false);
}
