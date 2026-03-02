<script lang="ts">
  import ProfileHeader from './ProfileHeader.svelte';
  import NetworkIndicator from './NetworkIndicator.svelte';
  import DeviceList from './DeviceList.svelte';
  import IdentityExport from './IdentityExport.svelte';
  import IdentityImport from './IdentityImport.svelte';
  import FollowInput from './FollowInput.svelte';
  import FollowingList from './FollowingList.svelte';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" role="presentation" onclick={onclose}></div>
{/if}

<aside class="panel" class:open>
  <div class="panel-header">
    <span class="panel-title">Settings</span>
    <button class="close-btn" onclick={onclose} title="Close settings">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
  <div class="panel-body">
    <ProfileHeader />
    <NetworkIndicator />
    <DeviceList />
    <IdentityExport />
    <IdentityImport />
    <FollowInput />
    <FollowingList />
  </div>
</aside>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 90;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100vh;
    background: #1a1a1a;
    border-left: 1px solid #333;
    z-index: 100;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s ease;
  }
  .panel.open {
    transform: translateX(0);
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }
  .panel-title {
    font-size: 0.9375rem;
    font-weight: 600;
  }
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    border-radius: 4px;
  }
  .close-btn:hover {
    background: #333;
    color: #eee;
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
  }
</style>
