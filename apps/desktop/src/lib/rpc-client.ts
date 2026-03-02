import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

let requestId = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>();

let initialized = false;

export async function initRpc(): Promise<void> {
  if (initialized) return;
  initialized = true;

  await listen<string>('sidecar-stdout', (event) => {
    try {
      const msg = JSON.parse(event.payload) as JsonRpcResponse;
      // Handle notifications (no id)
      if (msg.id == null) {
        if ((msg as any).method === 'system.ready') {
          console.log('[sidecar] ready');
        }
        return;
      }
      const p = pending.get(msg.id as number);
      if (p) {
        pending.delete(msg.id as number);
        if (msg.error) {
          p.reject(new Error(msg.error.message));
        } else {
          p.resolve(msg.result);
        }
      }
    } catch {
      // ignore non-JSON
    }
  });
}

export function call<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
    });
    const request = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    invoke('rpc_call', { request }).catch((err) => {
      pending.delete(id);
      reject(new Error(String(err)));
    });
  });
}
