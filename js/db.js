const DB_NAME = 'bwf-workout-db';
const DB_VERSION = 1;
const STORES = ['settings', 'progressions', 'active', 'workouts'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('progressions')) {
        db.createObjectStore('progressions', { keyPath: 'exerciseId' });
      }
      if (!db.objectStoreNames.contains('active')) {
        db.createObjectStore('active', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('workouts')) {
        const s = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
        s.createIndex('byDate', 'date');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet(store, key) {
  const db = await openDB();
  return requestToPromise(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function dbPut(store, value) {
  const db = await openDB();
  return requestToPromise(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function dbAdd(store, value) {
  const db = await openDB();
  return requestToPromise(db.transaction(store, 'readwrite').objectStore(store).add(value));
}

export async function dbDel(store, key) {
  const db = await openDB();
  return requestToPromise(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

export async function dbAll(store) {
  const db = await openDB();
  return requestToPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function dbClear(store) {
  const db = await openDB();
  return requestToPromise(db.transaction(store, 'readwrite').objectStore(store).clear());
}
