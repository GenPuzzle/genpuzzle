const DB_NAME = 'genpuzzle-image-to-ppt';
const DB_VERSION = 1;

type StoreName = 'originals' | 'previews' | 'thumbnails' | 'meta';

const memory = new Map<string, unknown>();

function memoryKey(store: StoreName, id: string): string {
  return `${store}:${id}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ['originals', 'previews', 'thumbnails', 'meta'] as StoreName[]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function putBlob(store: StoreName, id: string, blob: Blob): Promise<void> {
  memory.set(memoryKey(store, id), blob);
  try {
    const db = await openDb();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(blob, id);
    await txDone(tx);
  } catch {
    /* memory fallback */
  }
}

export async function getBlob(store: StoreName, id: string): Promise<Blob | undefined> {
  const cached = memory.get(memoryKey(store, id));
  if (cached instanceof Blob) return cached;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request = tx.objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}

export async function deletePageBlobs(id: string): Promise<void> {
  memory.delete(memoryKey('originals', id));
  memory.delete(memoryKey('previews', id));
  memory.delete(memoryKey('thumbnails', id));
  try {
    const db = await openDb();
    const tx = db.transaction(['originals', 'previews', 'thumbnails'], 'readwrite');
    tx.objectStore('originals').delete(id);
    tx.objectStore('previews').delete(id);
    tx.objectStore('thumbnails').delete(id);
    await txDone(tx);
  } catch {
    /* memory fallback */
  }
}

export async function putMeta<T>(key: string, value: T): Promise<void> {
  memory.set(memoryKey('meta', key), value);
  try {
    const db = await openDb();
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(value, key);
    await txDone(tx);
  } catch {
    /* memory fallback */
  }
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  if (memory.has(memoryKey('meta', key))) return memory.get(memoryKey('meta', key)) as T;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const request = tx.objectStore('meta').get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}

export async function copyBlob(store: StoreName, fromId: string, toId: string): Promise<void> {
  const blob = await getBlob(store, fromId);
  if (blob) await putBlob(store, toId, blob);
}
