<script lang="ts">
  import { identity } from '$lib/stores/identity';
  import { profile, updateProfile } from '$lib/stores/profile';
  import { currentDevice } from '$lib/stores/devices';

  let editing = $state(false);
  let editName = $state('');
  let editBio = $state('');

  function startEdit() {
    editName = $profile?.displayName ?? '';
    editBio = $profile?.bio ?? '';
    editing = true;
  }

  async function saveEdit() {
    const fields: { displayName?: string; bio?: string } = {};
    if (editName.trim()) fields.displayName = editName.trim();
    if (editBio.trim()) fields.bio = editBio.trim();
    if (Object.keys(fields).length > 0) {
      await updateProfile(fields);
    }
    editing = false;
  }

  function truncateKey(key: string): string {
    return key.slice(0, 8) + '...' + key.slice(-8);
  }
</script>

<header class="profile-header">
  <div class="identity">
    <span class="pubkey" title={$identity?.author}>
      {$identity ? truncateKey($identity.author) : '...'}
    </span>
    {#if $currentDevice}
      <span class="device-id" title={$currentDevice.deviceId}>
        device: {truncateKey($currentDevice.deviceId)}
      </span>
    {/if}
  </div>

  {#if editing}
    <div class="edit-form">
      <input
        type="text"
        placeholder="Display name"
        bind:value={editName}
        maxlength="50"
      />
      <input
        type="text"
        placeholder="Bio"
        bind:value={editBio}
        maxlength="160"
      />
      <div class="edit-actions">
        <button onclick={saveEdit}>Save</button>
        <button onclick={() => (editing = false)}>Cancel</button>
      </div>
    </div>
  {:else}
    <div class="profile-info">
      <span class="display-name">
        {$profile?.displayName ?? 'Anonymous'}
      </span>
      {#if $profile?.bio}
        <span class="bio">{$profile.bio}</span>
      {/if}
      <button class="edit-btn" onclick={startEdit}>Edit Profile</button>
    </div>
  {/if}
</header>

<style>
  .profile-header {
    padding: 1rem;
    border-bottom: 1px solid #333;
    background: #1a1a1a;
  }
  .identity {
    margin-bottom: 0.5rem;
  }
  .pubkey {
    font-family: monospace;
    font-size: 0.75rem;
    color: #888;
    cursor: help;
  }
  .device-id {
    font-family: monospace;
    font-size: 0.6875rem;
    color: #666;
    margin-left: 0.5rem;
  }
  .profile-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .display-name {
    font-size: 1.1rem;
    font-weight: 600;
  }
  .bio {
    color: #aaa;
    font-size: 0.875rem;
  }
  .edit-btn {
    margin-left: auto;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    background: transparent;
    border: 1px solid #555;
    color: #ccc;
    border-radius: 4px;
    cursor: pointer;
  }
  .edit-btn:hover {
    border-color: #888;
  }
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .edit-form input {
    padding: 0.375rem 0.5rem;
    background: #222;
    border: 1px solid #444;
    color: #eee;
    border-radius: 4px;
    font-size: 0.875rem;
  }
  .edit-actions {
    display: flex;
    gap: 0.5rem;
  }
  .edit-actions button {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    border: 1px solid #555;
    background: #333;
    color: #eee;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .edit-actions button:first-child {
    background: #2563eb;
    border-color: #2563eb;
  }
</style>
