<script lang="ts">
  import { timelineEntries } from '$lib/stores/timeline';
  import PostCard from './PostCard.svelte';

  interface Props {
    onauthorclick?: (author: string) => void;
  }

  let { onauthorclick }: Props = $props();
</script>

<div class="timeline">
  {#if $timelineEntries.length === 0}
    <div class="empty">
      <p>No posts yet. Write something above!</p>
    </div>
  {:else}
    {#each $timelineEntries as post (post.id)}
      <PostCard {post} {onauthorclick} />
    {/each}
  {/if}
</div>

<style>
  .timeline {
    flex: 1;
    overflow-y: auto;
  }
  .empty {
    padding: 2rem;
    text-align: center;
    color: #666;
  }
</style>
