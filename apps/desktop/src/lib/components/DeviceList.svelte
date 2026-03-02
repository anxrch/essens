<script lang="ts">
  import { devices, currentDevice, loadDevices, revokeDevice } from '$lib/stores/devices';

  let revoking = $state<string | null>(null);

  function truncateKey(key: string): string {
    return key.slice(0, 8) + '...' + key.slice(-8);
  }

  async function handleRevoke(deviceId: string, feedKey: string) {
    if (revoking) return;
    revoking = deviceId;
    try {
      await revokeDevice(deviceId, feedKey);
    } finally {
      revoking = null;
    }
  }
</script>

<div class="device-list">
  <h3>Devices</h3>
  {#if $devices.length === 0}
    <p class="empty">No devices announced yet.</p>
  {:else}
    <ul>
      {#each $devices as device}
        <li class="device" class:revoked={device.revoked}>
          <div class="device-info">
            <span class="device-id" title={device.deviceId}>
              {truncateKey(device.deviceId)}
              {#if $currentDevice && device.deviceId === $currentDevice.deviceId}
                <span class="badge current">this device</span>
              {/if}
              {#if device.revoked}
                <span class="badge revoked-badge">revoked</span>
              {/if}
            </span>
            {#if device.deviceName}
              <span class="device-name">{device.deviceName}</span>
            {/if}
            <span class="feed-key" title={device.feedKey}>
              feed: {truncateKey(device.feedKey)}
            </span>
          </div>
          {#if !device.revoked && (!$currentDevice || device.deviceId !== $currentDevice.deviceId)}
            <button
              class="revoke-btn"
              onclick={() => handleRevoke(device.deviceId, device.feedKey)}
              disabled={revoking === device.deviceId}
            >
              {revoking === device.deviceId ? 'Revoking...' : 'Revoke'}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .device-list {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    color: #888;
    font-weight: 500;
  }
  .empty {
    color: #666;
    font-size: 0.8125rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .device {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0.5rem;
    background: #1a1a1a;
    border-radius: 4px;
  }
  .device.revoked {
    opacity: 0.5;
  }
  .device-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .device-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: #ccc;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .device-name {
    font-size: 0.8125rem;
    color: #aaa;
  }
  .feed-key {
    font-family: monospace;
    font-size: 0.6875rem;
    color: #666;
  }
  .badge {
    font-size: 0.625rem;
    padding: 0.0625rem 0.25rem;
    border-radius: 3px;
    font-family: sans-serif;
  }
  .current {
    background: #2563eb;
    color: white;
  }
  .revoked-badge {
    background: #dc2626;
    color: white;
  }
  .revoke-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: transparent;
    border: 1px solid #dc2626;
    color: #dc2626;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }
  .revoke-btn:hover:not(:disabled) {
    background: #dc2626;
    color: white;
  }
  .revoke-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
