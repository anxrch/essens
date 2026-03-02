import { writable } from 'svelte/store';
import { call } from '$lib/rpc-client';

export interface Identity {
  author: string;
  displayName?: string;
  bio?: string;
}

export const identity = writable<Identity | null>(null);

export async function loadIdentity(): Promise<void> {
  const result = await call<Identity>('identity.get');
  identity.set(result);
}
