import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  Copy,
  Edit3,
  MessageSquare,
  Pause,
  Play,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  createComment,
  deleteComment,
  subscribeToComments,
  updateComment,
} from '../services/blogService';
import {
  BLUEPRINT_CONSTRAINTS,
  type AuthorProfile,
  type BlogComment,
  type BlogPost,
} from '../types/blog';
import { EditorialImage } from './EditorialImage';
import { extractHeadings, MarkdownRenderer } from './MarkdownRenderer';

interface ArticleReaderProps {
  post: BlogPost;
  profile: AuthorProfile;
  user: User | null;
  isAdmin: boolean;
  onBack: () => void;
  onSignIn: () => void;
  onEditPost: (post: BlogPost) => void;
}

function formatDate(ts: BlogPost['createdAt']): string {
  if (!ts) return 'Just now';
  const date = ts.toDate();
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

export function ArticleReader({
  post,
  profile,
  user,
  isAdmin,
  onBack,
  onSignIn,
  onEditPost,
}: ArticleReaderProps) {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  // Audio narration (Web Speech API)
  const [speechSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [speechState, setSpeechState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [speechRate, setSpeechRate] = useState<number>(1);

  const headings = useMemo(() => extractHeadings(post.content), [post.content]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [post.id]);

  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(1, Math.max(0, window.scrollY / docHeight)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [post.id]);

  useEffect(() => {
    setCommentsLoading(true);
    const unsub = subscribeToComments(post.id, (items) => {
      setComments(items);
      setCommentsLoading(false);
    });
    return () => unsub();
  }, [post.id]);

  useEffect(() => {
    return () => {
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [post.id, speechSupported]);

  const startNarration = (rate = speechRate) => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    const spokenText = `${post.title}. ${post.excerpt}. ${stripMarkdownForSpeech(post.content)}`;
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = rate;
    utterance.onend = () => setSpeechState('idle');
    utterance.onerror = () => setSpeechState('idle');
    window.speechSynthesis.speak(utterance);
    setSpeechState('playing');
  };

  const togglePlayPause = () => {
    if (!speechSupported) return;
    if (speechState === 'idle') {
      startNarration(speechRate);
    } else if (speechState === 'playing') {
      window.speechSynthesis.pause();
      setSpeechState('paused');
    } else {
      window.speechSynthesis.resume();
      setSpeechState('playing');
    }
  };

  const stopNarration = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeechState('idle');
  };

  const cycleSpeechRate = () => {
    const rates = [1, 1.25, 1.5];
    const next = rates[(rates.indexOf(speechRate) + 1) % rates.length];
    setSpeechRate(next);
    if (speechState !== 'idle') {
      startNarration(next);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCommentError(null);

    const trimmed = commentBody.trim();
    const { minLength, maxLength } = BLUEPRINT_CONSTRAINTS.comment.body;
    if (trimmed.length < minLength || trimmed.length > maxLength) {
      setCommentError(`Please enter between ${minLength} and ${maxLength} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await createComment(post.id, trimmed, user, isAdmin);
      setCommentBody('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editingBody.trim();
    const { minLength, maxLength } = BLUEPRINT_CONSTRAINTS.comment.body;
    if (trimmed.length < minLength || trimmed.length > maxLength) {
      setCommentError(`Comment must be between ${minLength} and ${maxLength} characters.`);
      return;
    }
    try {
      await updateComment(post.id, commentId, trimmed);
      setEditingId(null);
      setEditingBody('');
      setCommentError(null);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to update comment.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(post.id, commentId);
      setConfirmDeleteId(null);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to delete comment.');
    }
  };

  return (
    <article className="pb-24">
      {/* Thin compositor-only reading progress line */}
      <div
        aria-hidden="true"
        className="fixed top-16 left-0 right-0 h-[2px] bg-[#1E3A8A] z-30 origin-left transition-transform duration-75"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-10">
        {/* Top breadcrumb + admin action */}
        <div className="flex items-center justify-between gap-4 pb-8 border-b border-zinc-200">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer py-1"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Journal</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onEditPost(post)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E3A8A] hover:text-[#1D4ED8] transition-colors cursor-pointer py-1"
            >
              <Edit3 className="w-4 h-4" aria-hidden="true" />
              <span>Edit Article</span>
            </button>
          )}
        </div>

        {/* Article Header */}
        <header className="max-w-3xl pt-10 pb-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-500 mb-4 tabular-nums">
            <span className="text-[#1E3A8A] font-medium">{post.category}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(post.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{post.readingMinutes} min read</span>
            <span aria-hidden="true">·</span>
            <span>
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.85rem] font-semibold text-zinc-950 leading-[1.14] tracking-tight mb-5">
            {post.title}
          </h1>

          <p className="text-lg sm:text-xl text-zinc-600 leading-relaxed mb-8">
            {post.excerpt}
          </p>

          {/* Byline & Read Aloud Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-zinc-200">
            <div className="flex items-center gap-3">
              <img
                src={profile.avatarUrl}
                alt={post.authorName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-zinc-200"
              />
              <div>
                <p className="text-sm font-medium text-zinc-950">{post.authorName}</p>
                <p className="text-xs text-zinc-500">{profile.role}</p>
              </div>
            </div>

            {speechSupported && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {speechState === 'playing' ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-[#1E3A8A]" aria-hidden="true" />
                      <span>Pause Audio</span>
                    </>
                  ) : speechState === 'paused' ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#1E3A8A]" aria-hidden="true" />
                      <span>Resume Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-[#1E3A8A]" aria-hidden="true" />
                      <span>Listen to Article</span>
                    </>
                  )}
                </button>

                {speechState !== 'idle' && (
                  <>
                    <button
                      type="button"
                      onClick={cycleSpeechRate}
                      className="px-2.5 py-2 text-xs font-mono border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer tabular-nums"
                      aria-label="Change narration speed"
                    >
                      {speechRate}x
                    </button>
                    <button
                      type="button"
                      onClick={stopNarration}
                      className="p-2 border border-zinc-300 bg-white text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 cursor-pointer"
                      aria-label="Stop narration"
                    >
                      <Square className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Cover Figure */}
        <figure className="mb-12">
          <EditorialImage
            src={post.coverImageUrl}
            alt={post.title}
            aspectClass="aspect-[16/9]"
            className="border border-zinc-200"
          />
          {post.coverCaption && (
            <figcaption className="text-xs font-serif italic text-zinc-500 mt-3">
              {post.coverCaption}
            </figcaption>
          )}
        </figure>

        {/* Asymmetric 2-Column Reading Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-12 lg:gap-16 items-start">
          <div>
            <MarkdownRenderer content={post.content} dropCap />

            {/* End-of-article colophon */}
            <div className="mt-14 pt-8 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-zinc-500">
                  Written by {post.authorName} · {post.category}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 transition-colors cursor-pointer self-start"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1E3A8A]" aria-hidden="true" />
                    <span>Link copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy article link</span>
                  </>
                )}
              </button>
            </div>

            {/* Reader Discussion & Comments */}
            <section id="discussion" className="mt-16 pt-12 border-t border-zinc-200">
              <div className="flex items-baseline justify-between gap-4 mb-8">
                <h2 className="font-serif text-2xl font-semibold text-zinc-950">
                  Reader Discussion
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 tabular-nums">
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {comments.length} {comments.length === 1 ? 'response' : 'responses'}
                  </span>
                </span>
              </div>

              {/* Comment Composer */}
              {user ? (
                <form
                  onSubmit={handleSubmitComment}
                  className="mb-10 bg-white border border-zinc-200 p-5 sm:p-6"
                >
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2.5">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'Reader'}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-700">
                          {(user.displayName || 'R')[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium text-zinc-900">
                        {user.displayName || 'Reader'}
                      </span>
                      {isAdmin && (
                        <span className="text-xs font-mono text-[#1E3A8A]">Author</span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-zinc-400 tabular-nums">
                      {commentBody.trim().length} / {BLUEPRINT_CONSTRAINTS.comment.body.maxLength}
                    </span>
                  </div>

                  <label htmlFor="comment-composer" className="sr-only">
                    Write a comment
                  </label>
                  <textarea
                    id="comment-composer"
                    rows={3}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    maxLength={BLUEPRINT_CONSTRAINTS.comment.body.maxLength}
                    placeholder="Share a thoughtful note, question, or counter-perspective..."
                    className="w-full border border-zinc-200 bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-colors resize-y"
                  />

                  {commentError && (
                    <p className="mt-2 text-xs text-red-700" role="alert">
                      {commentError}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-xs text-zinc-500">
                      Comments appear immediately for all readers.
                    </p>
                    <button
                      type="submit"
                      disabled={submitting || commentBody.trim().length < 2}
                      className="px-4 py-2 text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {submitting ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mb-10 bg-white border border-zinc-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-950 mb-1">
                      Join the discussion
                    </p>
                    <p className="text-xs text-zinc-600">
                      Sign in with Google to leave a comment or ask a question about this article.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="px-4 py-2 text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                  >
                    Sign in to Comment
                  </button>
                </div>
              )}

              {/* Comment Thread */}
              {commentsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((n) => (
                    <div key={n} className="border-b border-zinc-200 py-5 animate-pulse">
                      <div className="h-4 w-36 bg-zinc-200 mb-3" />
                      <div className="h-3 w-full bg-zinc-100 mb-2" />
                      <div className="h-3 w-2/3 bg-zinc-100" />
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-zinc-500 py-6 border-t border-zinc-200">
                  No comments yet. Start the conversation above.
                </p>
              ) : (
                <div className="divide-y divide-zinc-200 border-t border-zinc-200">
                  {comments.map((comment) => {
                    const isOwner = user?.uid === comment.authorId;
                    const canModerate = isOwner || isAdmin;
                    const isEditing = editingId === comment.id;

                    return (
                      <div key={comment.id} className="py-6">
                        <div className="flex items-start justify-between gap-4 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            {comment.authorPhotoUrl ? (
                              <img
                                src={comment.authorPhotoUrl}
                                alt={comment.authorName}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover border border-zinc-200"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-700">
                                {comment.authorName[0]?.toUpperCase() || 'R'}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium text-zinc-950 text-sm">
                                {comment.authorName}
                              </span>
                              {comment.isAuthorReply && (
                                <>
                                  <span aria-hidden="true" className="text-zinc-300">
                                    ·
                                  </span>
                                  <span className="font-mono text-[#1E3A8A] font-medium">
                                    Author
                                  </span>
                                </>
                              )}
                              <span aria-hidden="true" className="text-zinc-300">
                                ·
                              </span>
                              <span className="font-mono text-zinc-500 tabular-nums">
                                {formatDate(comment.createdAt)}
                              </span>
                            </div>
                          </div>

                          {canModerate && !isEditing && (
                            <div className="flex items-center gap-2 shrink-0">
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(comment.id);
                                    setEditingBody(comment.body);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="text-xs text-zinc-500 hover:text-zinc-950 cursor-pointer px-1.5 py-1"
                                >
                                  Edit
                                </button>
                              )}
                              {confirmDeleteId === comment.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-xs text-red-700 font-medium hover:underline cursor-pointer px-1.5 py-1"
                                  >
                                    Confirm delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer px-1.5 py-1"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(comment.id)}
                                  className="text-zinc-400 hover:text-red-700 transition-colors cursor-pointer p-1"
                                  aria-label="Delete comment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="pl-9 mt-2">
                            <textarea
                              rows={3}
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              maxLength={BLUEPRINT_CONSTRAINTS.comment.body.maxLength}
                              className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-[#1E3A8A]"
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(comment.id)}
                                className="px-3 py-1.5 text-xs font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingBody('');
                                }}
                                className="px-3 py-1.5 text-xs font-medium border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="pl-9 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                            {comment.body}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right Margin Rail */}
          <aside className="hidden lg:block sticky top-24 space-y-8 border-l border-zinc-200 pl-8">
            {headings.length > 0 && (
              <div>
                <p className="text-xs font-mono text-zinc-500 mb-3">Contents</p>
                <nav aria-label="Article sections" className="space-y-2">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const target = document.getElementById(h.id);
                        if (target) target.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`block text-xs leading-snug text-zinc-600 hover:text-[#1E3A8A] transition-colors ${
                        h.level === 3 ? 'pl-3 text-zinc-500' : 'font-medium'
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            <div className="pt-6 border-t border-zinc-200">
              <p className="text-xs font-mono text-zinc-500 mb-3">About the Author</p>
              <p className="text-sm font-medium text-zinc-950 mb-1">{profile.displayName}</p>
              <p className="text-xs text-zinc-600 leading-relaxed">{profile.bio}</p>
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}
