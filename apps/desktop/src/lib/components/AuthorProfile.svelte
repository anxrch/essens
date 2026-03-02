<script lang="ts">
  import {
    viewingAuthorData,
    viewingAuthorPosts,
    viewingAuthorLoading,
    clearViewingAuthor,
    loadAuthorProfile,
  } from '$lib/stores/profile';
  import { followAuthor, unfollowAuthor } from '$lib/stores/follows';
  import PostCard from './PostCard.svelte';

  let toggling = $state(false);

  function truncateKey(key: string): string {
    return key.slice(0, 12) + '...' + key.slice(-8);
  }

  function goBack() {
    clearViewingAuthor();
  }

  async function handleToggleFollow() {
    if (!$viewingAuthorData || toggling) return;
    toggling = true;
    try {
      if ($viewingAuthorData.isFollowing) {
        await unfollowAuthor($viewingAuthorData.author);
      } else {
        await followAuthor($viewingAuthorData.author);
      }
      // Reload the profile to reflect updated follow state
      await loadAuthorProfile($viewingAuthorData.author);
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    } finally {
      toggling = false;
    }
  }

  function handleAuthorClick(author: string) {
    loadAuthorProfile(author);
  }
</script>

<div class="author-profile">
  <div class="profile-header">
    <button class="back-btn" onclick={goBack}>← Back</button>
  </div>

  {#if $viewingAuthorLoading}
    <div class="loading">
      <p>Loading profile...</p>
    </div>
  {:else if $viewingAuthorData}
    <div class="profile-info">
      <div class="profile-name">
        {#if $viewingAuthorData.profile?.displayName}
          <h2>{$viewingAuthorData.profile.displayName}</h2>
        {:else}
          <h2 class="mono">{truncateKey($viewingAuthorData.author)}</h2>
        {/if}
        {#if $viewingAuthorData.isSelf}
          <span class="self-badge">You</span>
        {/if}
      </div>

      <p class="pubkey" title={$viewingAuthorData.author}>
        {truncateKey($viewingAuthorData.author)}
      </p>

      {#if $viewingAuthorData.profile?.bio}
        <p class="bio">{$viewingAuthorData.profile.bio}</p>
      {/if}

      {#if !$viewingAuthorData.isSelf}
        <button
          class="follow-btn"
          class:following={$viewingAuthorData.isFollowing}
          onclick={handleToggleFollow}
          disabled={toggling}
        >
          {#if toggling}
            ...
          {:else if $viewingAuthorData.isFollowing}
            Unfollow
          {:else}
            Follow
          {/if}
        </button>
      {/if}
    </div>

    <div class="posts-section">
      <h3>Posts</h3>
      {#if $viewingAuthorPosts.length === 0}
        <div class="empty">
          <p>No posts to show.</p>
        </div>
      {:else}
        {#each $viewingAuthorPosts as post (post.id)}
          <PostCard {post} onauthorclick={handleAuthorClick} />
        {/each}
      {/if}
    </div>
  {:else}
    <div class="empty">
      <p>Profile not found.</p>
    </div>
  {/if}
</div>

<style>
  .author-profile {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }
  .profile-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
  }
  .back-btn {
    background: none;
    border: none;
    color: #2563eb;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.25rem 0;
  }
  .back-btn:hover {
    color: #3b82f6;
  }
  .loading,
  .empty {
    padding: 2rem;
    text-align: center;
    color: #666;
  }
  .profile-info {
    padding: 1rem;
    border-bottom: 1px solid #333;
  }
  .profile-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .profile-name h2 {
    margin: 0;
    font-size: 1.125rem;
    color: #eee;
  }
  .profile-name h2.mono {
    font-family: monospace;
    font-size: 0.875rem;
  }
  .self-badge {
    font-size: 0.65rem;
    background: #2563eb;
    color: white;
    padding: 0.1rem 0.375rem;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pubkey {
    font-family: monospace;
    font-size: 0.7rem;
    color: #666;
    margin: 0.25rem 0 0;
  }
  .bio {
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
    color: #bbb;
    line-height: 1.4;
  }
  .follow-btn {
    margin-top: 0.75rem;
    padding: 0.375rem 1.25rem;
    border: 1px solid #2563eb;
    background: #2563eb;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8125rem;
    transition: all 0.15s;
  }
  .follow-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .follow-btn.following {
    background: transparent;
    color: #2563eb;
  }
  .follow-btn.following:hover:not(:disabled) {
    background: #1c1c1c;
    color: #ef4444;
    border-color: #ef4444;
  }
  .follow-btn:disabled {
    opacity: 0.5;
  }
  .posts-section {
    flex: 1;
  }
  .posts-section h3 {
    margin: 0;
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #2a2a2a;
  }
</style>
