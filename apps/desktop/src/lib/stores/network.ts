import { writable } from 'svelte/store';
import { call } from '$lib/rpc-client';

export interface NetworkStatus {
  running: boolean;
  peerCount: number;
  trackedAuthors: string[];
}

export const networkStatus = writable<NetworkStatus>({
  running: false,
  peerCount: 0,
  trackedAuthors: [],
});

export async function loadNetworkStatus(): Promise<void> {
  const result = await call<NetworkStatus>('network.status');
  networkStatus.set(result);
}
