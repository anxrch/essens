<script lang="ts">
  import { createPost } from '$lib/stores/timeline';

  let text = $state('');
  let posting = $state(false);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    posting = true;
    try {
      await createPost(trimmed);
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
    <span class="char-count">{text.length}/500</span>
    <button onclick={handleSubmit} disabled={!text.trim() || posting}>
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
  .char-count {
    font-size: 0.75rem;
    color: #666;
  }
  button {
    padding: 0.375rem 1rem;
    background: #2563eb;
    border: none;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:hover:not(:disabled) {
    background: #1d4ed8;
  }
</style>
