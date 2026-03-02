<script lang="ts">
  import { onMount } from 'svelte';
  import { initRpc } from '$lib/rpc-client';
  import { loadIdentity } from '$lib/stores/identity';
  import { loadProfile } from '$lib/stores/profile';
  import { loadTimeline } from '$lib/stores/timeline';
  import { loadFollowing } from '$lib/stores/follows';
  import { loadNetworkStatus } from '$lib/stores/network';
  import { loadCurrentDevice, loadDevices } from '$lib/stores/devices';
  import TopBar from '$lib/components/TopBar.svelte';
  import SettingsPanel from '$lib/components/SettingsPanel.svelte';
  import ComposePost from '$lib/components/ComposePost.svelte';
  import Timeline from '$lib/components/Timeline.svelte';

  let ready = $state(false);
  let error = $state<string | null>(null);
  let settingsOpen = $state(false);

  onMount(async () => {
    try {
      await initRpc();
      await new Promise((r) => setTimeout(r, 500));
      await loadIdentity();
      await loadProfile();
      await loadCurrentDevice();
      await loadDevices();
      await loadTimeline();
      await loadFollowing();
      await loadNetworkStatus();
      ready = true;
    } catch (err) {
      error = String(err);
      console.error('Initialization failed:', err);
    }
  });
</script>

<div class="app">
  {#if error}
    <div class="error">
      <p>Failed to connect to sidecar: {error}</p>
    </div>
  {:else if !ready}
    <div class="loading">
      <p>Starting essens...</p>
    </div>
  {:else}
    <TopBar ontoggle={() => (settingsOpen = !settingsOpen)} />
    <main class="main">
      <ComposePost />
      <Timeline />
    </main>
    <SettingsPanel open={settingsOpen} onclose={() => (settingsOpen = false)} />
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #111;
    color: #eee;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .loading,
  .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: #888;
  }
  .error {
    color: #ef4444;
  }
</style>
