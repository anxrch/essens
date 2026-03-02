import { writable } from 'svelte/store';
import { call } from '$lib/rpc-client';

export interface TimelineEntry {
  key: string;
  eventId: string;
  author: string;
  seq: number;
  createdAt: string;
  kind: string;
}

export interface PostEvent {
  id: string;
  author: string;
  seq: number;
  createdAt: string;
  kind: string;
  body: { text: string; tags?: string[] };
}

export const timelineEntries = writable<PostEvent[]>([]);

export async function loadTimeline(limit = 50): Promise<void> {
  const entries = await call<TimelineEntry[]>('timeline.recent', { limit });
  const posts: PostEvent[] = [];
  for (const entry of entries) {
    const event = await call<PostEvent>('timeline.event', {
      eventId: entry.eventId,
    });
    if (event && event.kind === 'post.create') {
      posts.push(event);
    }
  }
  timelineEntries.set(posts);
}

export async function createPost(text: string): Promise<void> {
  await call('feed.append', {
    kind: 'post.create',
    body: { text },
  });
  await loadTimeline();
}

export async function deletePost(eventId: string): Promise<void> {
  await call('feed.append', {
    kind: 'post.delete_tombstone',
    body: { target: eventId },
  });
  await loadTimeline();
}
