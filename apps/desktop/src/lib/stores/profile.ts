import { writable } from 'svelte/store';
import { call } from '$lib/rpc-client';
import type { TimelineEntry, PostEvent } from './timeline';

export interface ProfileSnapshot {
  author: string;
  displayName?: string;
  bio?: string;
  updatedAt: string;
  seq: number;
}

export interface AuthorProfileData {
  author: string;
  profile: ProfileSnapshot | null;
  posts: TimelineEntry[];
  isFollowing: boolean;
  isSelf: boolean;
}

// Current user's profile
export const profile = writable<ProfileSnapshot | null>(null);

// Viewed author profile (for profile page)
export const viewingAuthor = writable<string | null>(null);
export const viewingAuthorData = writable<AuthorProfileData | null>(null);
export const viewingAuthorPosts = writable<PostEvent[]>([]);
export const viewingAuthorLoading = writable(false);

export async function loadProfile(): Promise<void> {
  const result = await call<ProfileSnapshot | null>('profile.get');
  profile.set(result);
}

export async function updateProfile(fields: {
  displayName?: string;
  bio?: string;
}): Promise<void> {
  await call('feed.append', {
    kind: 'profile.update',
    body: fields,
  });
  await loadProfile();
}

export async function loadAuthorProfile(authorHex: string): Promise<void> {
  viewingAuthor.set(authorHex);
  viewingAuthorLoading.set(true);
  try {
    const data = await call<AuthorProfileData>('author.posts', {
      author: authorHex,
    });
    viewingAuthorData.set(data);

    // Resolve full post events from timeline entries
    const posts: PostEvent[] = [];
    for (const entry of data.posts) {
      const event = await call<PostEvent>('timeline.event', {
        eventId: entry.eventId,
      });
      if (event && event.kind === 'post.create') {
        posts.push(event);
      }
    }
    viewingAuthorPosts.set(posts);
  } catch (err) {
    console.error('Failed to load author profile:', err);
    viewingAuthorData.set(null);
    viewingAuthorPosts.set([]);
  } finally {
    viewingAuthorLoading.set(false);
  }
}

export function clearViewingAuthor(): void {
  viewingAuthor.set(null);
  viewingAuthorData.set(null);
  viewingAuthorPosts.set([]);
}
