import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'it-advisory-device-id';

/**
 * Reads the persisted anonymous device id or creates one on first launch.
 */
export async function readOrCreateDeviceId(): Promise<string> {
  const existingDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existingDeviceId !== null && existingDeviceId.length > 0) {
    return existingDeviceId;
  }
  const nextDeviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, nextDeviceId);
  return nextDeviceId;
}
