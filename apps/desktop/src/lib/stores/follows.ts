import { writable } from 'svelte/store';
import { call } from '$lib/rpc-client';

export interface FollowEntry {
  author: string;
  target: string;
  since: string;
  eventId: string;
}

export const following = writable<FollowEntry[]>([]);

export async function loadFollowing(): Promise<void> {
  const result = await call<FollowEntry[]>('follow.list');
  following.set(result);
}

export async function followAuthor(target: string): Promise<void> {
  await call('follow.create', { target });
  await loadFollowing();
}

export async function unfollowAuthor(target: string): Promise<void> {
  await call('follow.remove', { target });
  await loadFollowing();
}
