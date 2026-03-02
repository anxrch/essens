import { writable } from 'svelte/store';
import { call } from '$lib/rpc-client';
import { invoke } from '@tauri-apps/api/core';

export interface DeviceInfo {
  deviceId: string;
  feedKey: string;
  author: string;
}

export interface DeviceRecord {
  deviceId: string;
  feedKey: string;
  deviceName?: string;
  announcedAt: string;
  revoked: boolean;
  revokedAt?: string;
}

export const currentDevice = writable<DeviceInfo | null>(null);
export const devices = writable<DeviceRecord[]>([]);

export async function loadCurrentDevice(): Promise<void> {
  const result = await call<DeviceInfo>('device.current');
  currentDevice.set(result);
}

export async function loadDevices(author?: string): Promise<void> {
  const result = await call<DeviceRecord[]>('device.list', author ? { author } : {});
  devices.set(result);
}

export async function announceDevice(deviceName?: string): Promise<void> {
  await call('device.announce', deviceName ? { deviceName } : {});
  await loadDevices();
}

export async function revokeDevice(deviceId: string, feedKey: string): Promise<void> {
  await call('device.revoke', { deviceId, feedKey });
  await loadDevices();
}

export async function exportIdentity(passphrase: string): Promise<string> {
  const result = await call<{ encrypted: string }>('identity.export', { passphrase });
  return result.encrypted;
}

export async function importIdentity(
  encrypted: string,
  passphrase: string,
): Promise<{ success: boolean; requiresRestart: boolean }> {
  return call('identity.import', { encrypted, passphrase });
}

export async function hasPasskey(): Promise<boolean> {
  return invoke<boolean>('passkey_has_key');
}

export async function exportIdentityWithPasskey(): Promise<string> {
  const key = await invoke<string>('passkey_generate_key');
  const result = await call<{ encrypted: string }>('identity.exportWithKey', { key });
  return result.encrypted;
}

export async function importIdentityWithPasskey(
  encrypted: string,
): Promise<{ success: boolean; requiresRestart: boolean }> {
  const key = await invoke<string>('passkey_get_key');
  return call('identity.importWithKey', { encrypted, key });
}
