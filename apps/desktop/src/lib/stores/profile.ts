import { writable } from 'svelte/store';
import { call } from '$lib/rpc-client';

export interface ProfileSnapshot {
  author: string;
  displayName?: string;
  bio?: string;
  updatedAt: string;
  seq: number;
}

export const profile = writable<ProfileSnapshot | null>(null);

export async function loadProfile(): Promise<void> {
  const result = await call<ProfileSnapshot | null>('profile.get');
  profile.set(result);
}

export async function updateProfile(fields: {
  displayName?: string;
  bio?: string;
}): Promise<void> {
  await call('feed.append', {
    kind: 'profile.update',
    body: fields,
  });
  await loadProfile();
}
