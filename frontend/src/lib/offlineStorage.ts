/**
 * IndexedDB storage helper for offline draft preservation during document review.
 */

const DB_NAME = "DocIntelOfflineDB";
const STORE_NAME = "review_drafts";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject("IndexedDB not supported");
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "documentId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveReviewDraft(documentId: string, fields: Record<string, any>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({
      documentId,
      fields,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed to save draft to IndexedDB:", err);
  }
}

export async function loadReviewDraft(documentId: string): Promise<Record<string, any> | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const request = store.get(documentId);
      request.onsuccess = () => {
        resolve(request.result ? request.result.fields : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("Failed to load draft from IndexedDB:", err);
    return null;
  }
}

export async function clearReviewDraft(documentId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(documentId);
  } catch (err) {
    console.warn("Failed to clear draft from IndexedDB:", err);
  }
}
