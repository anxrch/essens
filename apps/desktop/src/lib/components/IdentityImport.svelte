<script lang="ts">
  import { importIdentity, importIdentityWithPasskey, hasPasskey } from '$lib/stores/devices';

  let mode = $state<'passphrase' | 'passkey'>('passphrase');
  let encrypted = $state('');
  let passphrase = $state('');
  let error = $state<string | null>(null);
  let importing = $state(false);
  let success = $state(false);
  let passkeyAvailable = $state(false);

  $effect(() => {
    hasPasskey().then(v => { passkeyAvailable = v; }).catch(() => {});
  });

  async function handleImport() {
    error = null;
    if (!encrypted.trim()) {
      error = 'Paste the encrypted identity string';
      return;
    }
    importing = true;
    try {
      if (mode === 'passkey') {
        const result = await importIdentityWithPasskey(encrypted.trim());
        if (result.requiresRestart) success = true;
      } else {
        if (!passphrase.trim()) {
          error = 'Enter a passphrase';
          importing = false;
          return;
        }
        const result = await importIdentity(encrypted.trim(), passphrase.trim());
        if (result.requiresRestart) success = true;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      importing = false;
    }
  }
</script>

<div class="import-section">
  <h3>Import Identity</h3>
  <p class="desc">Paste an encrypted identity string from another device.</p>

  {#if success}
    <div class="success-msg">
      <p>Identity imported. Please restart the app to use the new identity.</p>
    </div>
  {:else}
    <div class="mode-toggle">
      <button
        class="mode-btn"
        class:active={mode === 'passphrase'}
        onclick={() => { mode = 'passphrase'; error = null; }}
      >Passphrase</button>
      <button
        class="mode-btn"
        class:active={mode === 'passkey'}
        onclick={() => { mode = 'passkey'; error = null; }}
      >Passkey</button>
    </div>

    <div class="form">
      <textarea
        bind:value={encrypted}
        placeholder="Paste encrypted identity string"
        disabled={importing}
      ></textarea>

      {#if mode === 'passphrase'}
        <input
          type="password"
          bind:value={passphrase}
          placeholder="Enter passphrase"
          disabled={importing}
        />
        <button onclick={handleImport} disabled={!encrypted.trim() || !passphrase.trim() || importing}>
          {importing ? 'Importing...' : 'Import'}
        </button>
      {:else}
        {#if !passkeyAvailable}
          <p class="hint warn">No passkey found in OS keychain. Export with passkey on the source device first.</p>
        {/if}
        <button class="passkey-btn" onclick={handleImport} disabled={!encrypted.trim() || !passkeyAvailable || importing}>
          {importing ? 'Importing...' : 'Import with Passkey'}
        </button>
      {/if}
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .import-section {
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
  .mode-toggle {
    display: flex;
    gap: 0;
    margin-bottom: 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    overflow: hidden;
  }
  .mode-btn {
    flex: 1;
    padding: 0.3rem 0.5rem;
    background: #222;
    border: none;
    color: #888;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .mode-btn:first-child {
    border-right: 1px solid #444;
  }
  .mode-btn.active {
    background: #2563eb;
    color: white;
  }
  .mode-btn:hover:not(.active) {
    background: #333;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
  input {
    padding: 0.375rem 0.5rem;
    background: #222;
    border: 1px solid #444;
    color: #eee;
    border-radius: 4px;
    font-size: 0.8125rem;
  }
  input:focus,
  textarea:focus {
    outline: none;
    border-color: #2563eb;
  }
  .hint {
    margin: 0;
    font-size: 0.7rem;
    color: #666;
    line-height: 1.3;
  }
  .hint.warn {
    color: #eab308;
  }
  .passkey-btn {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: #7c3aed;
    border: none;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8125rem;
  }
  .passkey-btn:hover:not(:disabled) {
    background: #6d28d9;
  }
  .passkey-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button {
    padding: 0.375rem 0.75rem;
    background: #2563eb;
    border: none;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8125rem;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .success-msg {
    padding: 0.5rem;
    background: #16a34a22;
    border: 1px solid #16a34a;
    border-radius: 4px;
  }
  .success-msg p {
    margin: 0;
    font-size: 0.8125rem;
    color: #16a34a;
  }
  .error {
    margin: 0.375rem 0 0;
    font-size: 0.75rem;
    color: #ef4444;
  }
</style>
