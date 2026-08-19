// lib/offline/device.ts

import { localDb, STORES } from './indexeddb';

const DEVICE_STORE = STORES.DEVICE;
const DEVICE_KEY = 'current_device';

interface DeviceRecord {
  id: string;
  deviceId: string;
}

// Fallback UUID generator if crypto.randomUUID is not supported by mobile browser
function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  
  // Custom RFC4122 version 4 UUID fallback generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Mendapatkan deviceId dari IndexedDB lokal, atau membuat baru jika belum terdaftar.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const record = await localDb.get<DeviceRecord>(DEVICE_STORE, DEVICE_KEY);
    if (record && record.deviceId) {
      return record.deviceId;
    }

    // Generate deviceId baru dengan prefix 'dev_'
    const newId = `dev_${generateUUID().replace(/-/g, '')}`;
    await localDb.put<DeviceRecord>(DEVICE_STORE, {
      id: DEVICE_KEY,
      deviceId: newId,
    });

    return newId;
  } catch (error) {
    console.warn('Failed to read/write deviceId in IndexedDB, using fallback ephemeral deviceId:', error);
    // Ephemeral fallback deviceId if IndexedDB fails (e.g. private browsing mode)
    return `dev_fallback_${Date.now()}`;
  }
}
