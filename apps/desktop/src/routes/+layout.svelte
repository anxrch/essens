<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>Essens</title>
</svelte:head>

{@render children()}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen, Ubuntu, sans-serif;
    background: #111;
    color: #eee;
  }

  :global(*) {
    box-sizing: border-box;
  }
</style>
