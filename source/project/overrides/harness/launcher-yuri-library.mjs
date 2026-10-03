// Read only the required cache records; never load MIX packages into memory.
// The manifest is generated from the pinned runtime's source during preparation.
export async function hasCachedYuriLibrary(manifest) {
  if (!manifest || !Array.isArray(manifest.required) || !manifest.required.length) return false;
  if (typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases();
    if (!databases.some(database => database.name === manifest.database)) return false;
  }
  return new Promise(resolve => {
    const request = indexedDB.open(manifest.database);
    // Browsers without databases(): abort an absent DB rather than seeding it.
    request.onupgradeneeded = () => request.transaction.abort();
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(manifest.store)) {
        database.close();
        resolve(false);
        return;
      }
      const transaction = database.transaction(manifest.store, 'readonly');
      const store = transaction.objectStore(manifest.store);
      let complete = true;
      const probes = [];
      for (const filename of manifest.required) {
        const record = store.get(manifest.prefix + filename);
        record.onsuccess = () => {
          const value = record.result;
          const size = value instanceof Blob ? value.size : value instanceof Uint8Array ? value.byteLength : 0;
          if (!size) complete = false;
          // Check readability through a one-byte slice, preserving large files.
          if (value instanceof Blob && size) probes.push(value.slice(0, 1).arrayBuffer());
        };
      }
      transaction.oncomplete = async () => {
        database.close();
        try { await Promise.all(probes); resolve(complete); }
        catch { resolve(false); }
      };
      transaction.onabort = transaction.onerror = () => { database.close(); resolve(false); };
    };
  });
}
