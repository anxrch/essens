<script lang="ts">
  import { createPost, type Visibility } from '$lib/stores/timeline';
  import { Globe, Lock } from 'lucide-svelte';

  let text = $state('');
  let visibility = $state<Visibility>('public');
  let posting = $state(false);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    posting = true;
    try {
      await createPost(trimmed, visibility);
      text = '';
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      posting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }

  function toggleVisibility() {
    visibility = visibility === 'public' ? 'private' : 'public';
  }
</script>

<div class="compose">
  <textarea
    bind:value={text}
    placeholder="Write something..."
    maxlength="500"
    rows="3"
    onkeydown={handleKeydown}
    disabled={posting}
  ></textarea>
  <div class="compose-footer">
    <div class="footer-left">
      <button class="visibility-btn" onclick={toggleVisibility} title={visibility === 'public' ? 'Public — visible to everyone' : 'Followers only'}>
        {#if visibility === 'public'}
          <Globe size={14} /> Public
        {:else}
          <Lock size={14} /> Followers
        {/if}
      </button>
      <span class="char-count">{text.length}/500</span>
    </div>
    <button class="post-btn" onclick={handleSubmit} disabled={!text.trim() || posting}>
      {posting ? 'Posting...' : 'Post'}
    </button>
  </div>
</div>

<style>
  .compose {
    padding: 1rem;
    border-bottom: 1px solid #333;
  }
  textarea {
    width: 100%;
    padding: 0.75rem;
    background: #222;
    border: 1px solid #444;
    color: #eee;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }
  textarea:focus {
    outline: none;
    border-color: #2563eb;
  }
  textarea:disabled {
    opacity: 0.6;
  }
  .compose-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }
  .footer-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .char-count {
    font-size: 0.75rem;
    color: #666;
  }
  .visibility-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #2a2a2a;
    border: 1px solid #444;
    color: #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s;
  }
  .visibility-btn:hover {
    background: #333;
    border-color: #555;
  }
  .post-btn {
    padding: 0.375rem 1rem;
    background: #2563eb;
    border: none;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  .post-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .post-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }
</style>
