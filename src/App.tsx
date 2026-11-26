import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  MessageSquare,
  Search,
  Volume2,
} from 'lucide-react';
import { ArticleReader } from './components/ArticleReader';
import { AuthorStudio } from './components/AuthorStudio';
import { EditorialImage } from './components/EditorialImage';
import { TopBar } from './components/TopBar';
import { auth, googleProvider } from './firebase';
import {
  checkIsAdminUser,
  fetchCommentCounts,
  isValidHttpOrAssetUrl,
  seedInauguralContent,
  subscribeToAllPostsAdmin,
  subscribeToProfile,
  subscribeToPublishedPosts,
  subscribeToWorks,
} from './services/blogService';
import {
  DEFAULT_AUTHOR_PROFILE,
  GENERATED_ASSETS,
  POST_CATEGORIES,
  type AuthorProfile,
  type BlogPost,
  type PortfolioWork,
  type PostCategory,
} from './types/blog';

type RouteState =
  | { view: 'home' }
  | { view: 'article'; slug: string }
  | { view: 'studio' };

function parseHashRoute(): RouteState {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/post/')) {
    const slug = decodeURIComponent(hash.slice('#/post/'.length)).trim();
    if (slug) return { view: 'article', slug };
  }
  if (hash === '#/studio') {
    return { view: 'studio' };
  }
  return { view: 'home' };
}

function formatShortDate(ts: BlogPost['createdAt']): string {
  if (!ts) return 'Recent';
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [publishedPosts, setPublishedPosts] = useState<BlogPost[]>([]);
  const [adminPosts, setAdminPosts] = useState<BlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const [works, setWorks] = useState<PortfolioWork[]>([]);
  const [profile, setProfile] = useState<AuthorProfile>(DEFAULT_AUTHOR_PROFILE);

  const [route, setRoute] = useState<RouteState>(() => parseHashRoute());
  const [studioEditPost, setStudioEditPost] = useState<BlogPost | null>(null);

  // Archive filters
  const [selectedCategory, setSelectedCategory] = useState<'All' | PostCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'discussed'>('newest');
  const [seedingQuick, setSeedingQuick] = useState(false);

  // Listen to browser hash navigation
  useEffect(() => {
    const onHashChange = () => setRoute(parseHashRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const adminFlag = await checkIsAdminUser(nextUser);
        setIsAdmin(adminFlag);
      } else {
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public Firestore subscriptions
  useEffect(() => {
    setPostsLoading(true);
    const unsubPosts = subscribeToPublishedPosts((items) => {
      setPublishedPosts(items);
      setPostsLoading(false);
    });
    const unsubWorks = subscribeToWorks((items) => setWorks(items));
    const unsubProfile = subscribeToProfile((p) => setProfile(p));

    return () => {
      unsubPosts();
      unsubWorks();
      unsubProfile();
    };
  }, []);

  // Admin full posts subscription (includes drafts)
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setAdminPosts([]);
      return;
    }
    const unsub = subscribeToAllPostsAdmin((items) => setAdminPosts(items));
    return () => unsub();
  }, [authReady, isAdmin]);

  // Fetch accurate comment counts for published posts
  useEffect(() => {
    if (publishedPosts.length === 0) {
      setCommentCounts({});
      return;
    }
    let active = true;
    void fetchCommentCounts(publishedPosts.map((p) => p.id)).then((counts) => {
      if (active) setCommentCounts(counts);
    });
    return () => {
      active = false;
    };
  }, [publishedPosts]);

  const handleSignIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      setAuthError('Google sign-in could not be completed. Please allow popups and try again.');
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
    if (route.view === 'studio') {
      window.location.hash = '#/';
    }
  }, [route.view]);

  const navigateHome = useCallback((sectionId?: string) => {
    window.location.hash = '#/';
    if (sectionId) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const openArticle = useCallback((post: BlogPost) => {
    window.location.hash = `#/post/${encodeURIComponent(post.slug)}`;
  }, []);

  const openStudio = useCallback((postToEdit?: BlogPost) => {
    setStudioEditPost(postToEdit ?? null);
    window.location.hash = '#/studio';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const clearInitialEdit = useCallback(() => setStudioEditPost(null), []);

  // Derive 3-tier editorial posts
  const leadPost = useMemo(() => {
    if (publishedPosts.length === 0) return null;
    return publishedPosts.find((p) => p.featured) || publishedPosts[0];
  }, [publishedPosts]);

  const secondaryPosts = useMemo(() => {
    if (!leadPost) return [];
    return publishedPosts.filter((p) => p.id !== leadPost.id).slice(0, 3);
  }, [publishedPosts, leadPost]);

  const filteredArchivePosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = publishedPosts.filter((post) => {
      const matchesCat = selectedCategory === 'All' || post.category === selectedCategory;
      const matchesQuery =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });

    if (sortBy === 'discussed') {
      return [...list].sort(
        (a, b) => (commentCounts[b.id] ?? 0) - (commentCounts[a.id] ?? 0)
      );
    }
    return list;
  }, [publishedPosts, selectedCategory, searchQuery, sortBy, commentCounts]);

  const totalComments = useMemo(
    () => Object.values(commentCounts).reduce((acc, n) => acc + n, 0),
    [commentCounts]
  );

  const activeArticle = useMemo(() => {
    if (route.view !== 'article') return null;
    const allSearchable = isAdmin && adminPosts.length > 0 ? adminPosts : publishedPosts;
    return allSearchable.find((p) => p.slug === route.slug || p.id === route.slug) || null;
  }, [route, publishedPosts, adminPosts, isAdmin]);

  const handleQuickSeed = async () => {
    if (!user || !isAdmin) return;
    setSeedingQuick(true);
    try {
      await seedInauguralContent(user, adminPosts, works);
    } finally {
      setSeedingQuick(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#09090B]">
      <TopBar
        brandName={profile.displayName}
        user={user}
        isAdmin={isAdmin}
        activeView={route.view}
        onNavigateHome={navigateHome}
        onOpenStudio={() => openStudio()}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {authError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 px-4 sm:px-8 py-2.5 text-xs text-red-800 flex items-center justify-between max-w-full"
        >
          <span>{authError}</span>
          <button
            type="button"
            onClick={() => setAuthError(null)}
            className="underline cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1">
        {/* VIEW 1: AUTHOR STUDIO */}
        {route.view === 'studio' && (
          isAdmin && user ? (
            <AuthorStudio
              user={user}
              posts={adminPosts}
              works={works}
              profile={profile}
              initialEditPost={studioEditPost}
              onClearInitialEdit={clearInitialEdit}
              onViewPost={openArticle}
              onSignOut={handleSignOut}
            />
          ) : (
            <section className="max-w-xl mx-auto px-4 py-24 text-center">
              <p className="text-xs font-mono text-zinc-500 mb-2">Author Access</p>
              <h1 className="font-serif text-3xl font-semibold text-zinc-950 mb-3">
                Publishing Desk Restricted
              </h1>
              <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                {user
                  ? 'Your current account is signed in as a reader and can comment on any article. Only the portfolio owner can publish or edit posts.'
                  : 'Sign in with the portfolio owner Google account to publish or edit articles.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {!user && (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="px-4 py-2 text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    Sign in with Google
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigateHome()}
                  className="px-4 py-2 text-sm font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                >
                  Back to Journal
                </button>
              </div>
            </section>
          )
        )}

        {/* VIEW 2: ARTICLE READER */}
        {route.view === 'article' && (
          postsLoading ? (
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-16 animate-pulse">
              <div className="h-4 w-32 bg-zinc-200 mb-6" />
              <div className="h-10 w-3/4 bg-zinc-200 mb-4" />
              <div className="h-5 w-1/2 bg-zinc-100 mb-8" />
              <div className="aspect-[16/9] bg-zinc-200" />
            </div>
          ) : activeArticle ? (
            <ArticleReader
              post={activeArticle}
              profile={profile}
              user={user}
              isAdmin={isAdmin}
              onBack={() => navigateHome('journal')}
              onSignIn={handleSignIn}
              onEditPost={(p) => openStudio(p)}
            />
          ) : (
            <section className="max-w-xl mx-auto px-4 py-24 text-center">
              <p className="text-xs font-mono text-zinc-500 mb-2">404</p>
              <h1 className="font-serif text-3xl font-semibold text-zinc-950 mb-3">
                Article not found
              </h1>
              <p className="text-sm text-zinc-600 mb-6">
                This essay may have been moved, unpublished, or removed by the author.
              </p>
              <button
                type="button"
                onClick={() => navigateHome('journal')}
                className="px-4 py-2 text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Return to Journal
              </button>
            </section>
          )
        )}

        {/* VIEW 3: PORTFOLIO & JOURNAL FRONT PAGE */}
        {route.view === 'home' && (
          <>
            {/* TIER 1: HERO / LEAD FEATURE */}
            <section id="journal" className="border-b border-zinc-200 bg-white">
              <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 lg:py-16">
                {postsLoading ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
                    <div className="lg:col-span-6 space-y-4">
                      <div className="h-3 w-40 bg-zinc-200" />
                      <div className="h-12 w-full bg-zinc-200" />
                      <div className="h-20 w-5/6 bg-zinc-100" />
                      <div className="h-10 w-36 bg-zinc-200" />
                    </div>
                    <div className="lg:col-span-6 aspect-[16/10] bg-zinc-200" />
                  </div>
                ) : leadPost ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                    <div className="lg:col-span-6 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-mono text-zinc-500 mb-4">
                          {profile.role} · {profile.location}
                        </p>
                        <p className="text-sm text-zinc-600 leading-relaxed mb-8 pb-6 border-b border-zinc-200 max-w-xl">
                          {profile.headline}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-500 mb-3 tabular-nums">
                          <span className="text-[#1E3A8A] font-medium">Lead Feature</span>
                          <span aria-hidden="true">·</span>
                          <span>{leadPost.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatShortDate(leadPost.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{leadPost.readingMinutes} min read</span>
                        </div>

                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold text-zinc-950 leading-[1.14] tracking-tight mb-4">
                          <button
                            type="button"
                            onClick={() => openArticle(leadPost)}
                            className="text-left hover:text-[#1E3A8A] transition-colors cursor-pointer"
                          >
                            {leadPost.title}
                          </button>
                        </h1>

                        <p className="text-base text-zinc-600 leading-relaxed mb-8 max-w-xl">
                          {leadPost.excerpt}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openArticle(leadPost)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>Read Article</span>
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openArticle(leadPost)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer tabular-nums"
                        >
                          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Audio &amp; {commentCounts[leadPost.id] ?? 0} comments</span>
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-6">
                      <button
                        type="button"
                        onClick={() => openArticle(leadPost)}
                        className="block w-full h-full text-left cursor-pointer group"
                        aria-label={`Read ${leadPost.title}`}
                      >
                        <EditorialImage
                          src={leadPost.coverImageUrl}
                          alt={leadPost.title}
                          aspectClass="aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[380px]"
                          className="border border-zinc-200 transition-opacity duration-200 group-hover:opacity-95"
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Inaugural Portfolio Welcome when no posts are published yet */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                    <div className="lg:col-span-6 flex flex-col justify-between py-2">
                      <div>
                        <p className="text-xs font-mono text-zinc-500 mb-4">
                          {profile.role} · {profile.location}
                        </p>
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold text-zinc-950 leading-[1.14] tracking-tight mb-5">
                          {profile.headline}
                        </h1>
                        <p className="text-base text-zinc-600 leading-relaxed mb-8 max-w-xl">
                          {profile.bio}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-zinc-200">
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={handleQuickSeed}
                              disabled={seedingQuick}
                              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                            >
                              <span>
                                {seedingQuick
                                  ? 'Publishing Starter Essays...'
                                  : 'Publish 4 Starter Portfolio Essays'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openStudio()}
                              className="px-4 py-2.5 text-sm font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                            >
                              Write New Essay
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-sm text-zinc-600">
                              <BookOpen className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                              <span>
                                First essays are being prepared. Sign in if you are the portfolio author to publish live.
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-6">
                      <EditorialImage
                        src={GENERATED_ASSETS.heroArchitecture}
                        alt="Editorial architecture studio gallery"
                        aspectClass="aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[360px]"
                        className="border border-zinc-200"
                      />
                    </div>
                  </div>
                )}

                {/* Full-width 4-column Editorial Index Strip */}
                <div className="mt-12 pt-8 border-t border-zinc-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs font-mono text-zinc-500 mb-1">Published Essays</p>
                    <p className="font-serif text-2xl font-semibold text-zinc-950 tabular-nums">
                      {publishedPosts.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-zinc-500 mb-1">Reader Responses</p>
                    <p className="font-serif text-2xl font-semibold text-zinc-950 tabular-nums">
                      {totalComments}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-zinc-500 mb-1">Selected Works</p>
                    <p className="font-serif text-2xl font-semibold text-zinc-950 tabular-nums">
                      {works.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-zinc-500 mb-1">Audio Narration</p>
                    <p className="font-serif text-2xl font-semibold text-zinc-950">
                      Read Aloud Ready
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* TIER 2: SECONDARY FEATURES */}
            {secondaryPosts.length > 0 && (
              <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-zinc-200">
                <div className="flex items-baseline justify-between gap-4 mb-8">
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-950">
                    Recent Dispatches
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigateHome('archive')}
                    className="text-xs font-medium text-[#1E3A8A] hover:underline underline-offset-4 cursor-pointer"
                  >
                    Browse Full Archive
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {secondaryPosts.map((post) => (
                    <article key={post.id} className="group flex flex-col justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => openArticle(post)}
                          className="block w-full text-left cursor-pointer mb-4"
                        >
                          <EditorialImage
                            src={post.coverImageUrl}
                            alt={post.title}
                            aspectClass="aspect-[4/3]"
                            className="border border-zinc-200 transition-opacity duration-200 group-hover:opacity-90"
                          />
                        </button>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-500 mb-2 tabular-nums">
                          <span className="text-[#1E3A8A] font-medium">{post.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatShortDate(post.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{post.readingMinutes} min read</span>
                        </div>

                        <h3 className="font-serif text-xl font-semibold text-zinc-950 leading-snug mb-2">
                          <button
                            type="button"
                            onClick={() => openArticle(post)}
                            className="text-left hover:text-[#1E3A8A] transition-colors cursor-pointer"
                          >
                            {post.title}
                          </button>
                        </h3>

                        <p className="text-sm text-zinc-600 leading-relaxed line-clamp-3 mb-4">
                          {post.excerpt}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500 tabular-nums">
                        <button
                          type="button"
                          onClick={() => openArticle(post)}
                          className="font-medium text-zinc-900 hover:text-[#1E3A8A] transition-colors cursor-pointer"
                        >
                          Read Essay
                        </button>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{commentCounts[post.id] ?? 0}</span>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* TIER 3: FULL ARCHIVE & TOPIC FILTER */}
            <section id="archive" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-zinc-200">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
                <div>
                  <p className="text-xs font-mono text-zinc-500 mb-1.5">Complete Index</p>
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-950">
                    All Published Articles
                  </h2>
                </div>

                {/* Search & Sort Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search
                      className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search essays..."
                      aria-label="Search articles"
                      className="pl-9 pr-3 py-2 text-xs sm:text-sm border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#1E3A8A] w-56 sm:w-64"
                    />
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'newest' | 'discussed')}
                    aria-label="Sort articles"
                    className="px-3 py-2 text-xs sm:text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:border-[#1E3A8A] cursor-pointer"
                  >
                    <option value="newest">Latest First</option>
                    <option value="discussed">Most Discussed</option>
                  </select>
                </div>
              </div>

              {/* Interactive Category Tabs */}
              <div
                role="tablist"
                aria-label="Filter articles by topic"
                className="flex items-center gap-1 p-1 bg-zinc-100 border border-zinc-200 mb-8 overflow-x-auto max-w-full w-fit"
              >
                {(['All', ...POST_CATEGORIES] as const).map((category) => (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-white text-zinc-950 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {filteredArchivePosts.length === 0 ? (
                <div className="bg-white border border-zinc-200 p-10 text-center">
                  <p className="font-serif text-lg text-zinc-900 mb-2">
                    {publishedPosts.length === 0
                      ? 'No published articles yet'
                      : 'No articles match your filter'}
                  </p>
                  <p className="text-xs text-zinc-500 mb-4">
                    {publishedPosts.length === 0
                      ? 'Published articles from Author Studio will appear here automatically.'
                      : 'Try clearing the search query or switching to All topics.'}
                  </p>
                  {(selectedCategory !== 'All' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('All');
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 text-xs font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white">
                  {filteredArchivePosts.map((post) => (
                    <article
                      key={post.id}
                      className="px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-baseline hover:bg-zinc-50/70 transition-colors"
                    >
                      <div className="md:col-span-3 flex items-center gap-3 text-xs font-mono text-zinc-500 tabular-nums">
                        <span>{formatShortDate(post.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#1E3A8A]">{post.category}</span>
                      </div>

                      <div className="md:col-span-6">
                        <h3 className="font-serif text-lg sm:text-xl font-medium text-zinc-950 mb-1.5">
                          <button
                            type="button"
                            onClick={() => openArticle(post)}
                            className="text-left hover:text-[#1E3A8A] transition-colors cursor-pointer"
                          >
                            {post.title}
                          </button>
                        </h3>
                        <p className="text-sm text-zinc-600 line-clamp-2 leading-relaxed">
                          {post.excerpt}
                        </p>
                      </div>

                      <div className="md:col-span-3 flex items-center md:justify-end gap-5 text-xs font-mono text-zinc-500 tabular-nums">
                        <span>{post.readingMinutes} min</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{commentCounts[post.id] ?? 0}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => openArticle(post)}
                          className="font-sans font-medium text-[#1E3A8A] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
                        >
                          Read
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 4: SELECTED PORTFOLIO WORKS */}
            <section id="portfolio" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 border-b border-zinc-200">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                <div>
                  <p className="text-xs font-mono text-zinc-500 mb-1.5">Portfolio Index</p>
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-950">
                    Selected Engineering &amp; Design Works
                  </h2>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => openStudio()}
                    className="text-xs font-medium text-[#1E3A8A] hover:underline underline-offset-4 cursor-pointer self-start sm:self-auto"
                  >
                    Manage Works in Studio
                  </button>
                )}
              </div>

              {works.length === 0 ? (
                <div className="bg-white border border-zinc-200 p-8">
                  <p className="text-sm text-zinc-600">
                    Portfolio case studies added in Author Studio will appear in this index.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white">
                  {works.map((work, idx) => (
                    <div
                      key={work.id}
                      className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start"
                    >
                      <div className="md:col-span-3 flex items-center gap-3 text-xs font-mono text-zinc-500 tabular-nums">
                        <span>{String(idx + 1).padStart(2, '0')}.</span>
                        <span>{work.year}</span>
                        <span aria-hidden="true">·</span>
                        <span>{work.discipline}</span>
                      </div>

                      <div className="md:col-span-6">
                        <h3 className="font-serif text-xl font-medium text-zinc-950 mb-1.5">
                          {work.title}
                        </h3>
                        <p className="text-sm text-zinc-600 leading-relaxed mb-2">
                          {work.summary}
                        </p>
                        <p className="text-xs font-mono text-zinc-800">
                          Outcome: {work.outcome}
                        </p>
                      </div>

                      <div className="md:col-span-3 flex md:justify-end">
                        {work.linkUrl && isValidHttpOrAssetUrl(work.linkUrl) && (
                          <a
                            href={work.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A8A] hover:underline underline-offset-4 whitespace-nowrap"
                          >
                            <span>View Case Study</span>
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 5: ABOUT THE AUTHOR */}
            <section id="about" className="max-w-6xl mx-auto px-4 sm:px-8 py-16">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="md:col-span-4">
                  <EditorialImage
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    aspectClass="aspect-square"
                    className="border border-zinc-200 max-w-xs"
                  />
                </div>
                <div className="md:col-span-8">
                  <p className="text-xs font-mono text-zinc-500 mb-2">About the Author</p>
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-zinc-950 mb-3">
                    {profile.displayName}
                  </h2>
                  <p className="text-sm font-medium text-[#1E3A8A] mb-4">
                    {profile.role} · {profile.location}
                  </p>
                  <p className="text-base text-zinc-700 leading-relaxed max-w-2xl mb-6">
                    {profile.bio}
                  </p>

                  <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-zinc-800">
                    {profile.githubUrl && isValidHttpOrAssetUrl(profile.githubUrl) && (
                      <a
                        href={profile.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#1E3A8A] hover:underline underline-offset-4"
                      >
                        GitHub
                      </a>
                    )}
                    {profile.linkedinUrl && isValidHttpOrAssetUrl(profile.linkedinUrl) && (
                      <a
                        href={profile.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#1E3A8A] hover:underline underline-offset-4"
                      >
                        LinkedIn
                      </a>
                    )}
                    {profile.websiteUrl && isValidHttpOrAssetUrl(profile.websiteUrl) && (
                      <a
                        href={profile.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#1E3A8A] hover:underline underline-offset-4"
                      >
                        Website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Clean Minimalist Colophon Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <p>
            © {new Date().getFullYear()} {profile.displayName}. All essays and notes.
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigateHome('journal')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Journal
            </button>
            <button
              type="button"
              onClick={() => navigateHome('archive')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => navigateHome('portfolio')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Portfolio
            </button>
            <button
              type="button"
              onClick={() => navigateHome('about')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              About
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
