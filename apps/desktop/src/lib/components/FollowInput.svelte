<script lang="ts">
  import { followAuthor } from '$lib/stores/follows';
  import { loadTimeline } from '$lib/stores/timeline';

  let target = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  const HEX_64 = /^[0-9a-f]{64}$/;

  async function handleSubmit() {
    error = null;
    const trimmed = target.trim().toLowerCase();
    if (!HEX_64.test(trimmed)) {
      error = 'Enter a valid 64-character hex public key';
      return;
    }
    if (submitting) return;
    submitting = true;
    try {
      await followAuthor(trimmed);
      await loadTimeline();
      target = '';
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      submitting = false;
    }
  }
</script>

<div class="follow-input">
  <div class="input-row">
    <input
      type="text"
      bind:value={target}
      placeholder="Paste a public key to follow (64 hex chars)"
      maxlength="64"
      disabled={submitting}
    />
    <button onclick={handleSubmit} disabled={!target.trim() || submitting}>
      {submitting ? 'Following...' : 'Follow'}
    </button>
  </div>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .follow-input {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
  }
  .input-row {
    display: flex;
    gap: 0.5rem;
  }
  input {
    flex: 1;
    padding: 0.375rem 0.5rem;
    background: #222;
    border: 1px solid #444;
    color: #eee;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8125rem;
  }
  input:focus {
    outline: none;
    border-color: #2563eb;
  }
  input:disabled {
    opacity: 0.6;
  }
  button {
    padding: 0.375rem 0.75rem;
    background: #2563eb;
    border: none;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8125rem;
    white-space: nowrap;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .error {
    margin: 0.375rem 0 0;
    font-size: 0.75rem;
    color: #ef4444;
  }
</style>
