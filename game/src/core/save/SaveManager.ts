// ============================================================
// SaveManager — reliable save/load with auto-save and rotation
// ============================================================

import type { SaveData } from '../types.ts';
import { MAX_SAVE_SLOTS, SAVE_VERSION } from '../constants.ts';

/** Abstract storage adapter */
interface StorageAdapter {
  save(key: string, data: string): Promise<void>;
  load(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
}

/** IndexedDB adapter for browser storage */
class IndexedDBAdapter implements StorageAdapter {
  private dbName = 'satisfactory-game';
  private storeName = 'saves';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
    });
  }

  async save(key: string, data: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(key: string): Promise<string | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async listKeys(prefix: string): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).getAllKeys();
      request.onsuccess = () => {
        const keys = (request.result as string[])
          .filter(k => typeof k === 'string' && k.startsWith(prefix));
        resolve(keys);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export class SaveManager {
  private adapter: StorageAdapter;
  private currentSlot = 0;

  constructor() {
    this.adapter = new IndexedDBAdapter();
  }

  /** Compute simple checksum for data integrity */
  private computeChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /** Save game data with rotation */
  async save(data: SaveData): Promise<void> {
    // Ensure version
    data.version = SAVE_VERSION;
    data.timestamp = Date.now();

    // Compute checksum (without checksum field)
    data.checksum = '';
    const jsonWithoutChecksum = JSON.stringify(data);
    data.checksum = this.computeChecksum(jsonWithoutChecksum);

    const json = JSON.stringify(data);

    // Save to current slot
    const slotKey = `save_slot_${this.currentSlot}`;
    await this.adapter.save(slotKey, json);

    // Also save a metadata entry
    await this.adapter.save('save_meta', JSON.stringify({
      lastSlot: this.currentSlot,
      lastTimestamp: data.timestamp,
      slots: MAX_SAVE_SLOTS,
    }));

    // Rotate to next slot
    this.currentSlot = (this.currentSlot + 1) % MAX_SAVE_SLOTS;

    console.log(`[SaveManager] Saved to slot ${slotKey}`);
  }

  /** Load the most recent valid save */
  async load(): Promise<SaveData | null> {
    // Try to read metadata first
    const metaJson = await this.adapter.load('save_meta');
    let startSlot = 0;

    if (metaJson) {
      try {
        const meta = JSON.parse(metaJson);
        startSlot = meta.lastSlot ?? 0;
      } catch {
        // Corrupted meta, start from 0
      }
    }

    // Try to load from the most recent slot backwards
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const slot = (startSlot - i + MAX_SAVE_SLOTS) % MAX_SAVE_SLOTS;
      const slotKey = `save_slot_${slot}`;

      try {
        const json = await this.adapter.load(slotKey);
        if (!json) continue;

        const data: SaveData = JSON.parse(json);

        // Verify checksum
        const savedChecksum = data.checksum;
        data.checksum = '';
        const computedChecksum = this.computeChecksum(JSON.stringify(data));

        if (savedChecksum !== computedChecksum) {
          console.warn(`[SaveManager] Checksum mismatch in slot ${slot}, trying next...`);
          continue;
        }

        // Restore checksum
        data.checksum = savedChecksum;

        // Version check
        if (data.version !== SAVE_VERSION) {
          console.warn(`[SaveManager] Version mismatch in slot ${slot} (${data.version} != ${SAVE_VERSION})`);
          // TODO: migration logic
        }

        console.log(`[SaveManager] Loaded from slot ${slotKey}`);
        this.currentSlot = (slot + 1) % MAX_SAVE_SLOTS;
        return data;
      } catch (err) {
        console.warn(`[SaveManager] Failed to load slot ${slot}:`, err);
      }
    }

    console.log('[SaveManager] No valid saves found');
    return null;
  }

  /** Delete all saves */
  async deleteAll(): Promise<void> {
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      await this.adapter.delete(`save_slot_${i}`);
    }
    await this.adapter.delete('save_meta');
    this.currentSlot = 0;
  }
}
