<script lang="ts">
  import { deletePost, type PostEvent } from '$lib/stores/timeline';
  import { identity } from '$lib/stores/identity';
  import { Lock } from 'lucide-svelte';

  interface Props {
    post: PostEvent;
    onauthorclick?: (author: string) => void;
  }

  let { post, onauthorclick }: Props = $props();
  let deleting = $state(false);

  const isOwn = $derived($identity?.author === post.author);
  const isPrivate = $derived(post.body.visibility === 'private');

  async function handleDelete() {
    if (deleting) return;
    deleting = true;
    try {
      await deletePost(post.id);
    } catch (err) {
      console.error('Failed to delete post:', err);
      deleting = false;
    }
  }

  function handleAuthorClick() {
    onauthorclick?.(post.author);
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  }

  function truncateKey(key: string): string {
    return key.slice(0, 8) + '...';
  }
</script>

<article class="post-card">
  <div class="post-header">
    <div class="header-left">
      <button class="author" title={post.author} onclick={handleAuthorClick}>
        {truncateKey(post.author)}
      </button>
      {#if isPrivate}
        <span class="private-badge" title="Followers only"><Lock size={12} /></span>
      {/if}
    </div>
    <span class="time">{formatTime(post.createdAt)}</span>
  </div>
  <p class="text">{post.body.text}</p>
  {#if post.body.tags && post.body.tags.length > 0}
    <div class="tags">
      {#each post.body.tags as tag}
        <span class="tag">#{tag}</span>
      {/each}
    </div>
  {/if}
  {#if isOwn}
    <div class="post-actions">
      <button class="delete-btn" onclick={handleDelete} disabled={deleting}>
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  {/if}
</article>

<style>
  .post-card {
    padding: 1rem;
    border-bottom: 1px solid #2a2a2a;
  }
  .post-card:hover {
    background: #1c1c1c;
  }
  .post-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.375rem;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  .author {
    font-family: monospace;
    font-size: 0.75rem;
    color: #2563eb;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .author:hover {
    text-decoration: underline;
    color: #3b82f6;
  }
  .private-badge {
    display: flex;
    align-items: center;
    color: #888;
  }
  .time {
    font-size: 0.75rem;
    color: #666;
  }
  .text {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .tags {
    margin-top: 0.375rem;
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }
  .tag {
    font-size: 0.75rem;
    color: #2563eb;
    background: #1e293b;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
  }
  .post-actions {
    margin-top: 0.375rem;
  }
  .delete-btn {
    font-size: 0.7rem;
    color: #666;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.125rem 0.25rem;
  }
  .delete-btn:hover:not(:disabled) {
    color: #ef4444;
  }
  .delete-btn:disabled {
    opacity: 0.5;
  }
</style>
