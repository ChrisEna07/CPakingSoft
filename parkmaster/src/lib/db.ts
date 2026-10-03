/** Almacenamiento clave-valor sobre IndexedDB (con respaldo en localStorage). */
const DB_NAME = 'parkmaster';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet<T>(key: string, def: T): Promise<T> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no idb');
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result === undefined ? def : (r.result as T));
      r.onerror = () => reject(r.error);
    });
  } catch {
    try { const raw = localStorage.getItem('pm:' + key); return raw === null ? def : (JSON.parse(raw) as T); } catch { return def; }
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no idb');
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try { localStorage.setItem('pm:' + key, JSON.stringify(value)); } catch { /* sin espacio */ }
  }
}
