<script lang="ts">
  import { identity } from '$lib/stores/identity';
  import { profile } from '$lib/stores/profile';
  import { networkStatus, loadNetworkStatus } from '$lib/stores/network';
  import { onMount, onDestroy } from 'svelte';

  let { ontoggle }: { ontoggle: () => void } = $props();

  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    interval = setInterval(loadNetworkStatus, 5000);
  });

  onDestroy(() => {
    clearInterval(interval);
  });
</script>

<header class="topbar">
  <div class="left">
    <span class="name">{$profile?.displayName ?? $identity?.author?.slice(0, 8) ?? '...'}</span>
  </div>

  <div class="center">
    <span class="dot" class:online={$networkStatus.running}></span>
    <span class="status-text">
      {$networkStatus.running ? 'Online' : 'Offline'}
    </span>
    {#if $networkStatus.peerCount > 0}
      <span class="peers">
        · {$networkStatus.peerCount} peer{$networkStatus.peerCount !== 1 ? 's' : ''}
      </span>
    {/if}
  </div>

  <button class="settings-btn" onclick={ontoggle} title="Settings">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </button>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    height: 44px;
    background: #1a1a1a;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }
  .left {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 0.9375rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .center {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #888;
    flex-shrink: 0;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ef4444;
    flex-shrink: 0;
  }
  .dot.online {
    background: #22c55e;
  }
  .status-text {
    color: #aaa;
  }
  .peers {
    color: #666;
  }
  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: 0.75rem;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .settings-btn:hover {
    background: #333;
    color: #eee;
  }
</style>
