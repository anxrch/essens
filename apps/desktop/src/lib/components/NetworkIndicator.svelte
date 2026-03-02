<script lang="ts">
  import { networkStatus, loadNetworkStatus } from '$lib/stores/network';
  import { onMount, onDestroy } from 'svelte';

  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    interval = setInterval(loadNetworkStatus, 5000);
  });

  onDestroy(() => {
    clearInterval(interval);
  });
</script>

<div class="network-indicator">
  <span class="dot" class:online={$networkStatus.running}></span>
  <span class="label">
    {$networkStatus.running ? 'Online' : 'Offline'}
  </span>
  {#if $networkStatus.peerCount > 0}
    <span class="peers">{$networkStatus.peerCount} peer{$networkStatus.peerCount !== 1 ? 's' : ''}</span>
  {/if}
</div>

<style>
  .network-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 1rem;
    font-size: 0.75rem;
    color: #888;
    border-bottom: 1px solid #333;
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
  .label {
    color: #aaa;
  }
  .peers {
    color: #666;
    margin-left: 0.25rem;
  }
</style>
