// All blobs and analyses stay in the browser's IndexedDB. No network client here.
const DB_NAME = 'offbeat-bass-mirror';
const STORE = 'sessions';
const VERSION = 1;

function dbOpen() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Local saving is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => reject(new Error('Close other Offbeat tabs to update your saved library.'));
  });
}

async function transact(mode, operation) {
  const db = await dbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error || new Error('Local storage transaction failed.'));
    });
  } finally { db.close(); }
}

export async function saveSession({ title, reference, take, selection, comparison }) {
  if (!take?.analysis && !reference?.analysis) throw new Error('Analyze a recording before saving.');
  const make = clip => clip ? {
    name: clip.name, mime: clip.file.type || 'application/octet-stream',
    blob: clip.file, analysis: clip.analysis || null,
  } : null;
  const entry = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    title: String(title || 'Untitled phrase').trim().slice(0, 90) || 'Untitled phrase',
    schema_version: 'offbeat.session.v1', reference: make(reference), take: make(take),
    selection: { start: selection.start, end: selection.end }, comparison: comparison || null,
  };
  await transact('readwrite', store => store.put(entry));
  return entry;
}
export async function listSessions() {
  const all = await transact('readonly', store => store.getAll());
  return all.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function removeSession(id) { await transact('readwrite', store => store.delete(id)); }
export async function clearSessions() { await transact('readwrite', store => store.clear()); }
export function restoreClip(entry) {
  if (!entry) return null;
  const file = new File([entry.blob], entry.name, { type: entry.mime });
  return { name: entry.name, file, analysis: entry.analysis, url: URL.createObjectURL(file) };
}
