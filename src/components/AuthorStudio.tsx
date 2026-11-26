import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Eye,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  createPost,
  createWork,
  deletePost,
  deleteWork,
  saveProfile,
  seedInauguralContent,
  updatePost,
  type PostDraftInput,
} from '../services/blogService';
import {
  BLUEPRINT_CONSTRAINTS,
  EDITORIAL_COVER_OPTIONS,
  estimateReadingMinutes,
  POST_CATEGORIES,
  slugifyTitle,
  type AuthorProfile,
  type BlogPost,
  type PortfolioWork,
  type PostCategory,
  type PostStatus,
} from '../types/blog';
import { EditorialImage } from './EditorialImage';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AuthorStudioProps {
  user: User;
  posts: BlogPost[];
  works: PortfolioWork[];
  profile: AuthorProfile;
  initialEditPost: BlogPost | null;
  onClearInitialEdit: () => void;
  onViewPost: (post: BlogPost) => void;
  onSignOut: () => void;
}

type StudioTab = 'articles' | 'compose' | 'works' | 'profile';

const EMPTY_POST_DRAFT: PostDraftInput = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: 'Engineering',
  coverImageUrl: EDITORIAL_COVER_OPTIONS[0].url,
  coverCaption: EDITORIAL_COVER_OPTIONS[0].defaultCaption,
  readingMinutes: 4,
  status: 'published',
  featured: false,
};

export function AuthorStudio({
  user,
  posts,
  works,
  profile,
  initialEditPost,
  onClearInitialEdit,
  onViewPost,
  onSignOut,
}: AuthorStudioProps) {
  const [tab, setTab] = useState<StudioTab>(initialEditPost ? 'compose' : 'articles');
  const [editingPostId, setEditingPostId] = useState<string | null>(initialEditPost?.id ?? null);
  const [draft, setDraft] = useState<PostDraftInput>(() =>
    initialEditPost
      ? {
          title: initialEditPost.title,
          slug: initialEditPost.slug,
          excerpt: initialEditPost.excerpt,
          content: initialEditPost.content,
          category: initialEditPost.category,
          coverImageUrl: initialEditPost.coverImageUrl,
          coverCaption: initialEditPost.coverCaption,
          readingMinutes: initialEditPost.readingMinutes,
          status: initialEditPost.status,
          featured: initialEditPost.featured,
        }
      : EMPTY_POST_DRAFT
  );
  const [slugLocked, setSlugLocked] = useState(Boolean(initialEditPost));
  const [showPreview, setShowPreview] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [postFeedback, setPostFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);

  // Portfolio Work form
  const [workTitle, setWorkTitle] = useState('');
  const [workDiscipline, setWorkDiscipline] = useState('');
  const [workYear, setWorkYear] = useState('2026');
  const [workSummary, setWorkSummary] = useState('');
  const [workOutcome, setWorkOutcome] = useState('');
  const [workLink, setWorkLink] = useState('');
  const [savingWork, setSavingWork] = useState(false);
  const [workFeedback, setWorkFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Profile form
  const [profileForm, setProfileForm] = useState<AuthorProfile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    setProfileForm(profile);
  }, [profile]);

  useEffect(() => {
    if (initialEditPost) {
      setTab('compose');
      setEditingPostId(initialEditPost.id);
      setDraft({
        title: initialEditPost.title,
        slug: initialEditPost.slug,
        excerpt: initialEditPost.excerpt,
        content: initialEditPost.content,
        category: initialEditPost.category,
        coverImageUrl: initialEditPost.coverImageUrl,
        coverCaption: initialEditPost.coverCaption,
        readingMinutes: initialEditPost.readingMinutes,
        status: initialEditPost.status,
        featured: initialEditPost.featured,
      });
      setSlugLocked(true);
      onClearInitialEdit();
    }
  }, [initialEditPost, onClearInitialEdit]);

  const startNewArticle = () => {
    setEditingPostId(null);
    setDraft(EMPTY_POST_DRAFT);
    setSlugLocked(false);
    setPostFeedback(null);
    setTab('compose');
  };

  const loadArticleForEdit = (post: BlogPost) => {
    setEditingPostId(post.id);
    setDraft({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      coverImageUrl: post.coverImageUrl,
      coverCaption: post.coverCaption,
      readingMinutes: post.readingMinutes,
      status: post.status,
      featured: post.featured,
    });
    setSlugLocked(true);
    setPostFeedback(null);
    setTab('compose');
  };

  const handleSavePost = async (targetStatus: PostStatus) => {
    setPostFeedback(null);
    setSavingPost(true);
    const payload: PostDraftInput = {
      ...draft,
      status: targetStatus,
      readingMinutes: estimateReadingMinutes(draft.content),
    };

    try {
      if (editingPostId) {
        await updatePost(editingPostId, payload);
        setPostFeedback({
          type: 'ok',
          text: targetStatus === 'published' ? 'Article updated and published.' : 'Draft updated.',
        });
      } else {
        const newId = await createPost(payload, user);
        setEditingPostId(newId);
        setSlugLocked(true);
        setPostFeedback({
          type: 'ok',
          text: targetStatus === 'published' ? 'New article published live.' : 'Draft saved.',
        });
      }
      setDraft(payload);
    } catch (err) {
      setPostFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save article.',
      });
    } finally {
      setSavingPost(false);
    }
  };

  const handleTogglePostStatus = async (post: BlogPost) => {
    const nextStatus: PostStatus = post.status === 'published' ? 'draft' : 'published';
    await updatePost(post.id, {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      coverImageUrl: post.coverImageUrl,
      coverCaption: post.coverCaption,
      readingMinutes: post.readingMinutes,
      status: nextStatus,
      featured: post.featured,
    });
  };

  const handleAddWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkFeedback(null);
    setSavingWork(true);
    try {
      await createWork(
        {
          title: workTitle,
          discipline: workDiscipline,
          year: workYear,
          summary: workSummary,
          outcome: workOutcome,
          linkUrl: workLink,
          orderIndex: works.length + 1,
        },
        user
      );
      setWorkTitle('');
      setWorkDiscipline('');
      setWorkSummary('');
      setWorkOutcome('');
      setWorkLink('');
      setWorkFeedback({ type: 'ok', text: 'Portfolio work added.' });
    } catch (err) {
      setWorkFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not add portfolio work.',
      });
    } finally {
      setSavingWork(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    setSavingProfile(true);
    try {
      await saveProfile(profileForm, user);
      setProfileFeedback({ type: 'ok', text: 'Portfolio profile saved.' });
    } catch (err) {
      setProfileFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not save profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSeedStarterContent = async () => {
    setSeeding(true);
    setPostFeedback(null);
    try {
      const res = await seedInauguralContent(user, posts, works);
      setPostFeedback({
        type: 'ok',
        text: `Published ${res.postsCreated} starter essays and ${res.worksCreated} portfolio works.`,
      });
    } catch (err) {
      setPostFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to publish starter content.',
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <p className="text-xs font-mono text-zinc-500 mb-1">Publishing Desk</p>
          <h1 className="font-serif text-3xl font-semibold text-zinc-950">Author Studio</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-zinc-500">{user.email}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Starter Seed Prompt when empty */}
      {(posts.length === 0 || works.length === 0) && (
        <div className="mt-6 bg-white border border-zinc-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-950">
              Initialize your portfolio blog with sample essays and works
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              Publish 4 curated architectural essays and 3 portfolio case studies directly to your Firestore database, or compose your own from scratch.
            </p>
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedStarterContent}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{seeding ? 'Publishing...' : 'Publish Starter Essays'}</span>
          </button>
        </div>
      )}

      {/* Segmented Navigation Tabs + New Article CTA */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 border border-zinc-200 overflow-x-auto">
          {(
            [
              ['articles', `Articles (${posts.length})`],
              ['compose', editingPostId ? 'Edit Essay' : 'Compose Essay'],
              ['works', `Selected Works (${works.length})`],
              ['profile', 'Portfolio Bio'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                tab === key
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={startNewArticle}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New Article</span>
        </button>
      </div>

      {postFeedback && tab !== 'works' && tab !== 'profile' && (
        <div
          role="status"
          className={`mt-5 px-4 py-3 text-xs border ${
            postFeedback.type === 'ok'
              ? 'bg-white border-[#1E3A8A]/30 text-[#1E3A8A]'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {postFeedback.text}
        </div>
      )}

      {/* TAB 1: ARTICLES LIST */}
      {tab === 'articles' && (
        <div className="mt-6 bg-white border border-zinc-200">
          {posts.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-serif text-lg text-zinc-900 mb-2">No articles created yet</p>
              <p className="text-xs text-zinc-500 mb-5">
                Start writing a new essay or publish the starter essays above.
              </p>
              <button
                type="button"
                onClick={startNewArticle}
                className="px-4 py-2 text-xs font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Write First Article
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-500 mb-1.5 tabular-nums">
                      <span
                        className={
                          post.status === 'published'
                            ? 'text-[#1E3A8A] font-medium'
                            : 'text-zinc-500'
                        }
                      >
                        {post.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{post.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.readingMinutes} min read</span>
                      {post.featured && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-zinc-900 font-medium">Lead Feature</span>
                        </>
                      )}
                    </div>
                    <h2 className="font-serif text-lg font-medium text-zinc-950 truncate">
                      {post.title}
                    </h2>
                    <p className="text-xs text-zinc-500 line-clamp-1 mt-1">{post.excerpt}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {post.status === 'published' && (
                      <button
                        type="button"
                        onClick={() => onViewPost(post)}
                        className="px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                      >
                        Read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTogglePostStatus(post)}
                      className="px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                    >
                      {post.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => loadArticleForEdit(post)}
                      className="px-3 py-1.5 text-xs font-medium border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 cursor-pointer"
                    >
                      Edit
                    </button>
                    {confirmDeletePostId === post.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await deletePost(post.id);
                            setConfirmDeletePostId(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium bg-red-700 text-white hover:bg-red-800 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePostId(null)}
                          className="px-2.5 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePostId(post.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-700 cursor-pointer"
                        aria-label={`Delete ${post.title}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPOSE / EDIT ESSAY */}
      {tab === 'compose' && (
        <div className="mt-6 bg-white border border-zinc-200 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-200 mb-6">
            <h2 className="font-serif text-xl font-semibold text-zinc-950">
              {editingPostId ? 'Edit Essay' : 'Compose New Essay'}
            </h2>
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showPreview ? 'Back to Editor' : 'Preview Essay'}</span>
            </button>
          </div>

          {showPreview ? (
            <div className="max-w-3xl mx-auto py-4">
              <p className="text-xs font-mono text-[#1E3A8A] mb-2">
                {draft.category} · {estimateReadingMinutes(draft.content)} min read
              </p>
              <h1 className="font-serif text-3xl font-semibold text-zinc-950 mb-3">
                {draft.title || 'Untitled Essay'}
              </h1>
              <p className="text-base text-zinc-600 mb-6">{draft.excerpt}</p>
              <EditorialImage
                src={draft.coverImageUrl}
                alt={draft.title || 'Article cover'}
                aspectClass="aspect-[16/9]"
                className="mb-8 border border-zinc-200"
              />
              <MarkdownRenderer content={draft.content || 'Start writing to preview prose.'} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="post-title"
                    className="block text-xs font-medium text-zinc-700 mb-1.5"
                  >
                    Article Title ({draft.title.length}/{BLUEPRINT_CONSTRAINTS.post.title.maxLength})
                  </label>
                  <input
                    id="post-title"
                    type="text"
                    value={draft.title}
                    maxLength={BLUEPRINT_CONSTRAINTS.post.title.maxLength}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        title: val,
                        slug: slugLocked ? prev.slug : slugifyTitle(val),
                      }));
                    }}
                    placeholder="Designing Systems That Scale Quietly"
                    className="w-full border border-zinc-300 bg-[#FAFAFA] px-3.5 py-2 text-sm text-zinc-950 focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="post-slug"
                    className="block text-xs font-medium text-zinc-700 mb-1.5"
                  >
                    URL Slug
                  </label>
                  <input
                    id="post-slug"
                    type="text"
                    value={draft.slug}
                    maxLength={BLUEPRINT_CONSTRAINTS.post.slug.maxLength}
                    onChange={(e) => {
                      setSlugLocked(true);
                      setDraft((prev) => ({
                        ...prev,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      }));
                    }}
                    placeholder="designing-systems-that-scale"
                    className="w-full border border-zinc-300 bg-[#FAFAFA] px-3.5 py-2 text-sm font-mono text-zinc-900 focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label
                    htmlFor="post-category"
                    className="block text-xs font-medium text-zinc-700 mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="post-category"
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        category: e.target.value as PostCategory,
                      }))
                    }
                    className="w-full border border-zinc-300 bg-[#FAFAFA] px-3.5 py-2 text-sm text-zinc-950 focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                  >
                    {POST_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="post-cover-preset"
                    className="block text-xs font-medium text-zinc-700 mb-1.5"
                  >
                    Editorial Cover Artwork
                  </label>
                  <select
                    id="post-cover-preset"
                    value={
                      EDITORIAL_COVER_OPTIONS.some((o) => o.url === draft.coverImageUrl)
                        ? draft.coverImageUrl
                        : 'custom'
                    }
                    onChange={(e) => {
                      const found = EDITORIAL_COVER_OPTIONS.find((o) => o.url === e.target.value);
                      if (found) {
                        setDraft((prev) => ({
                          ...prev,
                          coverImageUrl: found.url,
                          coverCaption: found.defaultCaption,
                        }));
                      }
                    }}
                    className="w-full border border-zinc-300 bg-[#FAFAFA] px-3.5 py-2 text-sm text-zinc-950 focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                  >
                    {EDITORIAL_COVER_OPTIONS.map((opt) => (
                      <option key={opt.url} value={opt.url}>
                        {opt.label}
                      </option>
                    ))}
                    <option value="custom">Custom Image URL</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2.5 text-sm text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.featured}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, featured: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#1E3A8A]"
                    />
                    <span>Feature as Lead Essay</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="post-cover-url"
                    className="block text-xs font-medium text-zinc-700 mb-1.5"
                  >
                    Cover Image Path or URL
                  </label>
                  <input
                    id="post-cover-url"
                    type="text"
                    value={draft.coverImageUrl}
                    maxLength={BLUEPRINT_CONSTRAINTS.post.coverImageUrl.maxLength}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, coverImageUrl: e.target.value }))
                    }
                    className="w-full border border-zinc-300 bg-[#FAFAFA] px-3.5 py-2 text-xs font-mono text-zinc-900 focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="post-caption"
                    className="block text-xs font-medium text-zinc-700 mb-1.5"
                  >
                    Figure Caption
                  </label>
                  <input
                    id="post-caption"
                    type="text"
                    value={draft.coverCaption}
                    maxLength={BLUEPRINT_CONSTRAINTS.post.coverCaption.maxLength}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, coverCaption: e.target.value }))
                    }
                    className="w-full border border-zinc-300 bg-[#FAFAFA] px-3.5 py-2 text-sm text-zinc-900 focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="post-excerpt"
                  className="block text-xs font-medium text-zinc-700 mb-1.5"
                >
                  Summary / Deck ({draft.excerpt.length}/{BLUEPRINT_CONSTRAINTS.post.excerpt.maxLength})
                </label>
                <textarea
                  id="post-excerpt"
                  rows={2}
                  value={draft.excerpt}
                  maxLength={BLUEPRINT_CONSTRAINTS.post.excerpt.maxLength}
                  onChange={(e) => setDraft((prev) => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="A concise two-sentence overview displayed on the journal front page."
                  className="w-full border border-zinc-300 bg-[#FAFAFA] px-3.5 py-2 text-sm text-zinc-950 focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="post-content" className="text-xs font-medium text-zinc-700">
                    Markdown Body
                  </label>
                  <span className="text-xs font-mono text-zinc-500 tabular-nums">
                    ~{estimateReadingMinutes(draft.content)} min read · {draft.content.length}/
                    {BLUEPRINT_CONSTRAINTS.post.content.maxLength}
                  </span>
                </div>
                <textarea
                  id="post-content"
                  rows={14}
                  value={draft.content}
                  maxLength={BLUEPRINT_CONSTRAINTS.post.content.maxLength}
                  onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your essay using Markdown (## headings, > pull quotes, ``` code blocks, **bold**, *italic*)..."
                  className="w-full border border-zinc-300 bg-[#FAFAFA] px-4 py-3 text-sm font-mono text-zinc-900 leading-relaxed focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={savingPost}
                  onClick={() => handleSavePost('draft')}
                  className="px-4 py-2 text-xs sm:text-sm font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={savingPost}
                  onClick={() => handleSavePost('published')}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>{editingPostId ? 'Update & Publish' : 'Publish Article'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SELECTED PORTFOLIO WORKS */}
      {tab === 'works' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <form
            onSubmit={handleAddWork}
            className="bg-white border border-zinc-200 p-6 space-y-4"
          >
            <h2 className="font-serif text-xl font-semibold text-zinc-950">
              Add Selected Work
            </h2>

            {workFeedback && (
              <p
                className={`text-xs px-3 py-2 border ${
                  workFeedback.type === 'ok'
                    ? 'border-[#1E3A8A]/30 text-[#1E3A8A]'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {workFeedback.text}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Project Title</label>
              <input
                type="text"
                required
                value={workTitle}
                maxLength={BLUEPRINT_CONSTRAINTS.work.title.maxLength}
                onChange={(e) => setWorkTitle(e.target.value)}
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Discipline</label>
                <input
                  type="text"
                  required
                  value={workDiscipline}
                  maxLength={BLUEPRINT_CONSTRAINTS.work.discipline.maxLength}
                  onChange={(e) => setWorkDiscipline(e.target.value)}
                  placeholder="Systems Engineering"
                  className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Year</label>
                <input
                  type="text"
                  required
                  value={workYear}
                  maxLength={4}
                  onChange={(e) => setWorkYear(e.target.value)}
                  className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Summary</label>
              <textarea
                rows={3}
                required
                value={workSummary}
                maxLength={BLUEPRINT_CONSTRAINTS.work.summary.maxLength}
                onChange={(e) => setWorkSummary(e.target.value)}
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Measured Outcome
              </label>
              <input
                type="text"
                required
                value={workOutcome}
                maxLength={BLUEPRINT_CONSTRAINTS.work.outcome.maxLength}
                onChange={(e) => setWorkOutcome(e.target.value)}
                placeholder="Reduced latency by 45% across core endpoints"
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Project Link (optional)
              </label>
              <input
                type="url"
                value={workLink}
                maxLength={BLUEPRINT_CONSTRAINTS.work.linkUrl.maxLength}
                onChange={(e) => setWorkLink(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <button
              type="submit"
              disabled={savingWork}
              className="px-4 py-2 text-xs font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
            >
              {savingWork ? 'Saving...' : 'Add Portfolio Work'}
            </button>
          </form>

          <div className="bg-white border border-zinc-200 divide-y divide-zinc-200">
            {works.length === 0 ? (
              <p className="p-6 text-sm text-zinc-500">No portfolio works added yet.</p>
            ) : (
              works.map((work) => (
                <div key={work.id} className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono text-zinc-500 mb-1">
                      {work.discipline} · {work.year}
                    </p>
                    <h3 className="font-serif text-base font-medium text-zinc-950">
                      {work.title}
                    </h3>
                    <p className="text-xs text-zinc-600 mt-1">{work.outcome}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteWork(work.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-700 cursor-pointer"
                    aria-label={`Remove ${work.title}`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PORTFOLIO PROFILE */}
      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="mt-6 bg-white border border-zinc-200 p-6 sm:p-8 max-w-2xl space-y-5"
        >
          <h2 className="font-serif text-xl font-semibold text-zinc-950">
            Portfolio Identity & Bio
          </h2>

          {profileFeedback && (
            <p
              className={`text-xs px-3 py-2 border ${
                profileFeedback.type === 'ok'
                  ? 'border-[#1E3A8A]/30 text-[#1E3A8A]'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {profileFeedback.text}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={profileForm.displayName}
                maxLength={BLUEPRINT_CONSTRAINTS.profile.displayName.maxLength}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, displayName: e.target.value }))
                }
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Role / Title</label>
              <input
                type="text"
                required
                value={profileForm.role}
                maxLength={BLUEPRINT_CONSTRAINTS.profile.role.maxLength}
                onChange={(e) => setProfileForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Masthead Headline
            </label>
            <input
              type="text"
              required
              value={profileForm.headline}
              maxLength={BLUEPRINT_CONSTRAINTS.profile.headline.maxLength}
              onChange={(e) => setProfileForm((p) => ({ ...p, headline: e.target.value }))}
              className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Biography</label>
            <textarea
              rows={4}
              required
              value={profileForm.bio}
              maxLength={BLUEPRINT_CONSTRAINTS.profile.bio.maxLength}
              onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
              className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Location</label>
              <input
                type="text"
                required
                value={profileForm.location}
                maxLength={BLUEPRINT_CONSTRAINTS.profile.location.maxLength}
                onChange={(e) => setProfileForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">GitHub URL</label>
              <input
                type="url"
                value={profileForm.githubUrl}
                maxLength={BLUEPRINT_CONSTRAINTS.profile.githubUrl.maxLength}
                onChange={(e) => setProfileForm((p) => ({ ...p, githubUrl: e.target.value }))}
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">LinkedIn URL</label>
              <input
                type="url"
                value={profileForm.linkedinUrl}
                maxLength={BLUEPRINT_CONSTRAINTS.profile.linkedinUrl.maxLength}
                onChange={(e) => setProfileForm((p) => ({ ...p, linkedinUrl: e.target.value }))}
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Website URL</label>
              <input
                type="url"
                value={profileForm.websiteUrl}
                maxLength={BLUEPRINT_CONSTRAINTS.profile.websiteUrl.maxLength}
                onChange={(e) => setProfileForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                className="w-full border border-zinc-300 bg-[#FAFAFA] px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2 text-xs sm:text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Portfolio Profile'}
          </button>
        </form>
      )}
    </section>
  );
}
