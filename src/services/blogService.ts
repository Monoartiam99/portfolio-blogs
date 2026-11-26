import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ADMIN_EMAIL,
  BLUEPRINT_CONSTRAINTS,
  DEFAULT_AUTHOR_PROFILE,
  STARTER_ESSAYS,
  STARTER_WORKS,
  type AuthorProfile,
  type BlogComment,
  type BlogPost,
  type PortfolioWork,
  type PostCategory,
  type PostStatus,
} from '../types/blog';

export function isValidHttpOrAssetUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/src/assets/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === ADMIN_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists() && snap.data()?.role === 'admin';
  } catch {
    return false;
  }
}

export function subscribeToPublishedPosts(
  onData: (posts: BlogPost[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'posts';
  const q = query(collection(db, path), where('status', '==', 'published'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<BlogPost, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis() ?? 0;
        const tb = b.createdAt?.toMillis() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToAllPostsAdmin(
  onData: (posts: BlogPost[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'posts';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<BlogPost, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToComments(
  postId: string,
  onData: (comments: BlogComment[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `posts/${postId}/comments`;
  const q = query(collection(db, 'posts', postId, 'comments'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<BlogComment, 'id'>),
      }));
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis() ?? Date.now();
        const tb = b.createdAt?.toMillis() ?? Date.now();
        return ta - tb;
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function fetchCommentCounts(postIds: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    postIds.map(async (postId) => {
      try {
        const q = query(
          collection(db, 'posts', postId, 'comments'),
          where('isPublic', '==', true)
        );
        const snap = await getCountFromServer(q);
        return [postId, snap.data().count] as const;
      } catch {
        return [postId, 0] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

export interface PostDraftInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: PostCategory;
  coverImageUrl: string;
  coverCaption: string;
  readingMinutes: number;
  status: PostStatus;
  featured: boolean;
}

export function validatePostInput(input: PostDraftInput): string | null {
  const c = BLUEPRINT_CONSTRAINTS.post;
  const title = input.title.trim();
  const slug = input.slug.trim();
  const excerpt = input.excerpt.trim();
  const content = input.content.trim();
  const cover = input.coverImageUrl.trim();
  const caption = input.coverCaption.trim();

  if (title.length < c.title.minLength || title.length > c.title.maxLength) {
    return `Title must be between ${c.title.minLength} and ${c.title.maxLength} characters.`;
  }
  if (
    slug.length < c.slug.minLength ||
    slug.length > c.slug.maxLength ||
    !c.slug.pattern.test(slug)
  ) {
    return 'Slug must use lowercase letters, numbers, and hyphens only (3–120 chars).';
  }
  if (excerpt.length < c.excerpt.minLength || excerpt.length > c.excerpt.maxLength) {
    return `Excerpt must be between ${c.excerpt.minLength} and ${c.excerpt.maxLength} characters.`;
  }
  if (content.length < c.content.minLength || content.length > c.content.maxLength) {
    return `Article body must be between ${c.content.minLength} and ${c.content.maxLength} characters.`;
  }
  if (cover.length < c.coverImageUrl.minLength || cover.length > c.coverImageUrl.maxLength) {
    return 'Cover image path or URL is required (max 500 chars).';
  }
  if (!isValidHttpOrAssetUrl(cover)) {
    return 'Cover image URL must use https://, http://, or a local asset path.';
  }
  if (caption.length > c.coverCaption.maxLength) {
    return `Cover caption must be ${c.coverCaption.maxLength} characters or fewer.`;
  }
  return null;
}

export async function createPost(input: PostDraftInput, user: User): Promise<string> {
  const validationError = validatePostInput(input);
  if (validationError) throw new Error(validationError);

  const postId = generateId('post');
  const path = `posts/${postId}`;
  const authorName = (user.displayName || 'Monojit Nandy').trim().slice(0, 80);

  try {
    await setDoc(doc(db, 'posts', postId), {
      title: input.title.trim(),
      slug: input.slug.trim(),
      excerpt: input.excerpt.trim(),
      content: input.content.trim(),
      category: input.category,
      coverImageUrl: input.coverImageUrl.trim(),
      coverCaption: input.coverCaption.trim(),
      readingMinutes: Math.min(120, Math.max(1, Math.round(input.readingMinutes))),
      status: input.status,
      featured: Boolean(input.featured),
      authorId: user.uid,
      authorName,
      commentCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return postId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePost(postId: string, input: PostDraftInput): Promise<void> {
  const validationError = validatePostInput(input);
  if (validationError) throw new Error(validationError);

  const path = `posts/${postId}`;
  try {
    await updateDoc(doc(db, 'posts', postId), {
      title: input.title.trim(),
      slug: input.slug.trim(),
      excerpt: input.excerpt.trim(),
      content: input.content.trim(),
      category: input.category,
      coverImageUrl: input.coverImageUrl.trim(),
      coverCaption: input.coverCaption.trim(),
      readingMinutes: Math.min(120, Math.max(1, Math.round(input.readingMinutes))),
      status: input.status,
      featured: Boolean(input.featured),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePost(postId: string): Promise<void> {
  const path = `posts/${postId}`;
  try {
    await deleteDoc(doc(db, 'posts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createComment(
  postId: string,
  body: string,
  user: User,
  isAuthorReply: boolean
): Promise<string> {
  const trimmed = body.trim();
  const c = BLUEPRINT_CONSTRAINTS.comment;
  if (trimmed.length < c.body.minLength || trimmed.length > c.body.maxLength) {
    throw new Error(`Comment must be between ${c.body.minLength} and ${c.body.maxLength} characters.`);
  }

  const commentId = generateId('cmt');
  const path = `posts/${postId}/comments/${commentId}`;
  const authorName = (user.displayName || 'Reader').trim().slice(0, c.authorName.maxLength);
  const authorPhotoUrl =
    user.photoURL && isValidHttpOrAssetUrl(user.photoURL)
      ? user.photoURL.slice(0, c.authorPhotoUrl.maxLength)
      : '';

  try {
    await setDoc(doc(db, 'posts', postId, 'comments', commentId), {
      postId,
      authorId: user.uid,
      authorName,
      authorPhotoUrl,
      isAuthorReply: Boolean(isAuthorReply),
      body: trimmed,
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return commentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateComment(
  postId: string,
  commentId: string,
  body: string
): Promise<void> {
  const trimmed = body.trim();
  const c = BLUEPRINT_CONSTRAINTS.comment;
  if (trimmed.length < c.body.minLength || trimmed.length > c.body.maxLength) {
    throw new Error(`Comment must be between ${c.body.minLength} and ${c.body.maxLength} characters.`);
  }

  const path = `posts/${postId}/comments/${commentId}`;
  try {
    await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
      body: trimmed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  const path = `posts/${postId}/comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToWorks(
  onData: (works: PortfolioWork[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'works';
  const q = query(
    collection(db, path),
    where('orderIndex', '>=', 0),
    orderBy('orderIndex', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PortfolioWork, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export interface WorkInput {
  title: string;
  discipline: string;
  year: string;
  summary: string;
  outcome: string;
  linkUrl: string;
  orderIndex: number;
}

export function validateWorkInput(input: WorkInput): string | null {
  const c = BLUEPRINT_CONSTRAINTS.work;
  const title = input.title.trim();
  const discipline = input.discipline.trim();
  const year = input.year.trim();
  const summary = input.summary.trim();
  const outcome = input.outcome.trim();
  const linkUrl = input.linkUrl.trim();

  if (title.length < c.title.minLength || title.length > c.title.maxLength) {
    return `Project title must be ${c.title.minLength}–${c.title.maxLength} characters.`;
  }
  if (discipline.length < c.discipline.minLength || discipline.length > c.discipline.maxLength) {
    return `Discipline must be ${c.discipline.minLength}–${c.discipline.maxLength} characters.`;
  }
  if (!c.year.pattern.test(year)) {
    return 'Year must be a 4-digit year (e.g. 2026).';
  }
  if (summary.length < c.summary.minLength || summary.length > c.summary.maxLength) {
    return `Summary must be ${c.summary.minLength}–${c.summary.maxLength} characters.`;
  }
  if (outcome.length < c.outcome.minLength || outcome.length > c.outcome.maxLength) {
    return `Outcome must be ${c.outcome.minLength}–${c.outcome.maxLength} characters.`;
  }
  if (linkUrl.length > c.linkUrl.maxLength || !isValidHttpOrAssetUrl(linkUrl)) {
    return 'Project URL must be a valid https:// or http:// link (max 300 chars).';
  }
  return null;
}

export async function createWork(input: WorkInput, user: User): Promise<string> {
  const validationError = validateWorkInput(input);
  if (validationError) throw new Error(validationError);

  const workId = generateId('work');
  const path = `works/${workId}`;
  try {
    await setDoc(doc(db, 'works', workId), {
      title: input.title.trim(),
      discipline: input.discipline.trim(),
      year: input.year.trim(),
      summary: input.summary.trim(),
      outcome: input.outcome.trim(),
      linkUrl: input.linkUrl.trim(),
      orderIndex: Math.min(1000, Math.max(0, Math.round(input.orderIndex))),
      authorId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return workId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteWork(workId: string): Promise<void> {
  const path = `works/${workId}`;
  try {
    await deleteDoc(doc(db, 'works', workId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToProfile(
  onData: (profile: AuthorProfile) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'profile/owner';
  return onSnapshot(
    doc(db, 'profile', 'owner'),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as AuthorProfile);
      } else {
        onData(DEFAULT_AUTHOR_PROFILE);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveProfile(profile: AuthorProfile, user: User): Promise<void> {
  const c = BLUEPRINT_CONSTRAINTS.profile;
  const displayName = profile.displayName.trim();
  const role = profile.role.trim();
  const headline = profile.headline.trim();
  const bio = profile.bio.trim();
  const location = profile.location.trim();
  const avatarUrl = profile.avatarUrl.trim();
  const githubUrl = profile.githubUrl.trim();
  const linkedinUrl = profile.linkedinUrl.trim();
  const websiteUrl = profile.websiteUrl.trim();

  if (displayName.length < c.displayName.minLength || displayName.length > c.displayName.maxLength) {
    throw new Error('Display name must be 2–80 characters.');
  }
  if (role.length < c.role.minLength || role.length > c.role.maxLength) {
    throw new Error('Role must be 2–100 characters.');
  }
  if (headline.length < c.headline.minLength || headline.length > c.headline.maxLength) {
    throw new Error('Headline must be 10–220 characters.');
  }
  if (bio.length < c.bio.minLength || bio.length > c.bio.maxLength) {
    throw new Error('Bio must be 20–1200 characters.');
  }
  if (location.length < c.location.minLength || location.length > c.location.maxLength) {
    throw new Error('Location must be 2–80 characters.');
  }
  if (
    !isValidHttpOrAssetUrl(avatarUrl) ||
    !isValidHttpOrAssetUrl(githubUrl) ||
    !isValidHttpOrAssetUrl(linkedinUrl) ||
    !isValidHttpOrAssetUrl(websiteUrl)
  ) {
    throw new Error('Profile URLs must use https://, http://, or valid asset paths.');
  }

  const path = 'profile/owner';
  try {
    await setDoc(doc(db, 'profile', 'owner'), {
      displayName,
      role,
      headline,
      bio,
      location,
      avatarUrl: avatarUrl.slice(0, c.avatarUrl.maxLength),
      githubUrl: githubUrl.slice(0, c.githubUrl.maxLength),
      linkedinUrl: linkedinUrl.slice(0, c.linkedinUrl.maxLength),
      websiteUrl: websiteUrl.slice(0, c.websiteUrl.maxLength),
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedInauguralContent(
  user: User,
  existingPosts: BlogPost[],
  existingWorks: PortfolioWork[]
): Promise<{ postsCreated: number; worksCreated: number }> {
  let postsCreated = 0;
  let worksCreated = 0;

  if (existingPosts.length === 0) {
    for (const essay of STARTER_ESSAYS) {
      await createPost(
        {
          ...essay,
          status: 'published',
        },
        user
      );
      postsCreated += 1;
    }
  }

  if (existingWorks.length === 0) {
    for (const work of STARTER_WORKS) {
      await createWork(work, user);
      worksCreated += 1;
    }
  }

  return { postsCreated, worksCreated };
}
