<script lang="ts">
  import { following, unfollowAuthor } from '$lib/stores/follows';
  import { loadTimeline } from '$lib/stores/timeline';

  let unfollowing = $state<string | null>(null);

  function truncateKey(key: string): string {
    return key.slice(0, 8) + '...' + key.slice(-8);
  }

  async function handleUnfollow(target: string) {
    if (unfollowing) return;
    unfollowing = target;
    try {
      await unfollowAuthor(target);
      await loadTimeline();
    } catch (err) {
      console.error('Failed to unfollow:', err);
    } finally {
      unfollowing = null;
    }
  }
</script>

{#if $following.length > 0}
  <div class="following-list">
    <h3>Following ({$following.length})</h3>
    <ul>
      {#each $following as entry}
        <li>
          <span class="key" title={entry.target}>{truncateKey(entry.target)}</span>
          <button
            class="unfollow-btn"
            onclick={() => handleUnfollow(entry.target)}
            disabled={unfollowing === entry.target}
          >
            {unfollowing === entry.target ? '...' : 'Unfollow'}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .following-list {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
    color: #888;
    font-weight: 500;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0;
  }
  .key {
    font-family: monospace;
    font-size: 0.75rem;
    color: #2563eb;
  }
  .unfollow-btn {
    font-size: 0.7rem;
    color: #888;
    background: transparent;
    border: 1px solid #444;
    border-radius: 3px;
    padding: 0.125rem 0.375rem;
    cursor: pointer;
  }
  .unfollow-btn:hover:not(:disabled) {
    color: #ef4444;
    border-color: #ef4444;
  }
  .unfollow-btn:disabled {
    opacity: 0.5;
  }
</style>
