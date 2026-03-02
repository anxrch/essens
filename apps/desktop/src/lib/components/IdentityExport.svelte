<script lang="ts">
  import { exportIdentity } from '$lib/stores/devices';

  let passphrase = $state('');
  let encrypted = $state<string | null>(null);
  let error = $state<string | null>(null);
  let exporting = $state(false);
  let copied = $state(false);

  async function handleExport() {
    error = null;
    encrypted = null;
    if (!passphrase.trim()) {
      error = 'Enter a passphrase';
      return;
    }
    exporting = true;
    try {
      encrypted = await exportIdentity(passphrase.trim());
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      exporting = false;
    }
  }

  async function copyToClipboard() {
    if (!encrypted) return;
    try {
      await navigator.clipboard.writeText(encrypted);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      error = 'Failed to copy to clipboard';
    }
  }
</script>

<div class="export-section">
  <h3>Export Identity</h3>
  <p class="desc">Encrypt your identity with a passphrase to transfer to another device.</p>

  {#if !encrypted}
    <div class="input-row">
      <input
        type="password"
        bind:value={passphrase}
        placeholder="Enter passphrase"
        disabled={exporting}
      />
      <button onclick={handleExport} disabled={!passphrase.trim() || exporting}>
        {exporting ? 'Encrypting...' : 'Export'}
      </button>
    </div>
  {:else}
    <div class="result">
      <textarea readonly value={encrypted}></textarea>
      <button class="copy-btn" onclick={copyToClipboard}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <button class="reset-btn" onclick={() => { encrypted = null; passphrase = ''; }}>
        Done
      </button>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .export-section {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
  }
  h3 {
    margin: 0 0 0.25rem;
    font-size: 0.875rem;
    color: #888;
    font-weight: 500;
  }
  .desc {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: #666;
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
    font-size: 0.8125rem;
  }
  input:focus {
    outline: none;
    border-color: #2563eb;
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
  .result {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  textarea {
    width: 100%;
    min-height: 60px;
    padding: 0.375rem 0.5rem;
    background: #222;
    border: 1px solid #444;
    color: #eee;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.6875rem;
    resize: vertical;
    box-sizing: border-box;
  }
  .copy-btn {
    background: #16a34a;
  }
  .copy-btn:hover:not(:disabled) {
    background: #15803d;
  }
  .reset-btn {
    background: #555;
  }
  .reset-btn:hover {
    background: #666;
  }
  .error {
    margin: 0.375rem 0 0;
    font-size: 0.75rem;
    color: #ef4444;
  }
</style>
