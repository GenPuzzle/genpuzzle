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

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`gp-auth-v1:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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
