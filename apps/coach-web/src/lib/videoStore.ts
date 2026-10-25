/** This browser's own copies of chat videos, keyed by message id. The server
 *  deletes video files 7 days after sending; a clip downloaded (or sent) here
 *  keeps playing from IndexedDB. Best effort: browsers can evict it, and every
 *  call resolves (never throws) when storage is unavailable. */

const DB = 'recbuddy-chat-videos'
const STORE = 'videos'

let opening: Promise<IDBDatabase | null> | null = null
function open(): Promise<IDBDatabase | null> {
  if (opening) return opening
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return open().then((db) => new Promise<T | null>((resolve) => {
    if (!db) return resolve(null)
    try {
      const req = op(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  }))
}

// Stored as bytes + type rather than a Blob: Safari has a history of failing
// to persist Blobs in IndexedDB, and bytes clone the same everywhere.
type Stored = { type: string; data: ArrayBuffer }

export async function getVideo(messageId: string): Promise<Blob | null> {
  const row = await run<Stored>('readonly', (s) => s.get(messageId))
  return row ? new Blob([row.data], { type: row.type }) : null
}

/** Whether this browser has a copy, without reading the bytes into memory. */
export async function hasVideo(messageId: string): Promise<boolean> {
  return ((await run<number>('readonly', (s) => s.count(messageId))) ?? 0) > 0
}

export async function putVideo(messageId: string, blob: Blob): Promise<void> {
  const data = await blobBytes(blob)
  await run('readwrite', (s) => s.put({ type: blob.type, data } satisfies Stored, messageId))
}

function blobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(blob)
  })
}

let persisted = false
/** Ask the browser not to evict our storage. Once per session; never throws. */
export async function requestPersistence(): Promise<void> {
  if (persisted) return
  persisted = true
  try { await navigator.storage?.persist?.() } catch { /* best effort */ }
}
