import type { Timestamp } from 'firebase/firestore';

export const ADMIN_EMAIL = 'monojitnandy20052023lp@gmail.com';

export const POST_CATEGORIES = [
  'Engineering',
  'Design',
  'Systems',
  'Architecture',
  'Notes',
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];
export type PostStatus = 'draft' | 'published';

// Synchronized verbatim with firebase-blueprint.json
export const BLUEPRINT_CONSTRAINTS = {
  post: {
    title: { minLength: 3, maxLength: 140 },
    slug: { minLength: 3, maxLength: 120, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    excerpt: { minLength: 10, maxLength: 360 },
    content: { minLength: 20, maxLength: 40000 },
    coverImageUrl: { minLength: 1, maxLength: 500 },
    coverCaption: { minLength: 0, maxLength: 200 },
    authorName: { minLength: 1, maxLength: 80 },
    readingMinutes: { min: 1, max: 120 },
  },
  comment: {
    body: { minLength: 2, maxLength: 2000 },
    authorName: { minLength: 1, maxLength: 80 },
    authorPhotoUrl: { minLength: 0, maxLength: 500 },
  },
  work: {
    title: { minLength: 2, maxLength: 100 },
    discipline: { minLength: 2, maxLength: 60 },
    year: { minLength: 4, maxLength: 4, pattern: /^[0-9]{4}$/ },
    summary: { minLength: 10, maxLength: 320 },
    outcome: { minLength: 4, maxLength: 120 },
    linkUrl: { minLength: 0, maxLength: 300 },
  },
  profile: {
    displayName: { minLength: 2, maxLength: 80 },
    role: { minLength: 2, maxLength: 100 },
    headline: { minLength: 10, maxLength: 220 },
    bio: { minLength: 20, maxLength: 1200 },
    location: { minLength: 2, maxLength: 80 },
    avatarUrl: { minLength: 1, maxLength: 500 },
    githubUrl: { minLength: 0, maxLength: 300 },
    linkedinUrl: { minLength: 0, maxLength: 300 },
    websiteUrl: { minLength: 0, maxLength: 300 },
  },
} as const;

export interface BlogPost {
  id: string;
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
  authorId: string;
  authorName: string;
  commentCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface BlogComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string;
  isAuthorReply: boolean;
  body: string;
  isPublic: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PortfolioWork {
  id: string;
  title: string;
  discipline: string;
  year: string;
  summary: string;
  outcome: string;
  linkUrl: string;
  orderIndex: number;
  authorId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AuthorProfile {
  displayName: string;
  role: string;
  headline: string;
  bio: string;
  location: string;
  avatarUrl: string;
  githubUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  updatedBy?: string;
  updatedAt?: Timestamp | null;
}

export const GENERATED_ASSETS = {
  authorPortrait: '/src/assets/images/author_portrait_editorial_1795669045269.jpg',
  heroArchitecture: '/src/assets/images/hero_systems_architecture_1795669044995.jpg',
  designCraft: '/src/assets/images/article_design_craft_1795669045341.jpg',
  distributedSystems: '/src/assets/images/article_distributed_systems_1795669045499.jpg',
  creativeProcess: '/src/assets/images/article_creative_process_1795669045199.jpg',
} as const;

export const EDITORIAL_COVER_OPTIONS = [
  {
    label: 'Gallery Atrium & Clerestory Light',
    url: GENERATED_ASSETS.heroArchitecture,
    defaultCaption: 'Fig. 1 — Concrete planes and clerestory light in spatial alignment.',
  },
  {
    label: 'Archival Paper & Drafting Steel',
    url: GENERATED_ASSETS.designCraft,
    defaultCaption: 'Fig. 2 — Cotton rag paper and precision steel scale on limestone.',
  },
  {
    label: 'Optical Glass & Brushed Aluminum',
    url: GENERATED_ASSETS.distributedSystems,
    defaultCaption: 'Fig. 3 — Optical refraction through precision-ground glass prisms.',
  },
  {
    label: 'Studio Desk & Afternoon Light',
    url: GENERATED_ASSETS.creativeProcess,
    defaultCaption: 'Fig. 4 — Linen field notebook and mechanical workspace by north glass.',
  },
] as const;

export const DEFAULT_AUTHOR_PROFILE: AuthorProfile = {
  displayName: 'Monojit Nandy',
  role: 'Software Engineer & Systems Designer',
  headline: 'Writing on software architecture, calm interfaces, and resilient web systems.',
  bio: 'I design and engineer web applications, distributed frontends, and editorial developer tools. This journal documents architectural trade-offs, visual systems, and lessons learned shipping production software.',
  location: 'Kolkata & Remote',
  avatarUrl: GENERATED_ASSETS.authorPortrait,
  githubUrl: 'https://github.com',
  linkedinUrl: 'https://linkedin.com',
  websiteUrl: '',
};

export interface StarterEssayTemplate {
  title: string;
  slug: string;
  category: PostCategory;
  excerpt: string;
  coverImageUrl: string;
  coverCaption: string;
  readingMinutes: number;
  featured: boolean;
  content: string;
}

export const STARTER_ESSAYS: StarterEssayTemplate[] = [
  {
    title: 'Designing Software Systems That Age With Grace',
    slug: 'designing-software-systems-that-age-with-grace',
    category: 'Architecture',
    excerpt:
      'Why explicit data contracts, narrow module boundaries, and quiet defaults outlive clever abstractions in production.',
    coverImageUrl: GENERATED_ASSETS.heroArchitecture,
    coverCaption: 'Fig. 1 — Architectural load-bearing planes depend on clarity of proportion.',
    readingMinutes: 6,
    featured: true,
    content: `Most software does not collapse under sudden traffic spikes. It erodes slowly through accumulated ambiguity: implicit contracts between services, configuration scattered across build scripts, and abstractions built before the underlying domain stabilized.

## Start With the Data Boundary

When building any full-stack application, the schema is the primary load-bearing wall. Before writing a single component, define the exact shape of every entity, its length limits, and its ownership invariants.

> Simplicity is rarely achieved by removing features; it is achieved by refusing to let accidental complexity cross module boundaries.

### Three Invariants Worth Enforcing Early

1. **Single source of truth for validation**: Mirror database rule boundaries directly in TypeScript validators so users get immediate feedback before a network round-trip.
2. **Explicit state transitions**: Replace ambiguous boolean flags with clear enumerations such as \`draft\` and \`published\`.
3. **Predictable failure surfaces**: Every network boundary should return structured context rather than swallowing errors silently.

## Calm Interfaces Follow Clean Architecture

When the underlying data flow is calm and deterministic, the user interface no longer needs defensive spinners or noisy status indicators. Pages render directly from crisp queries, mutations settle cleanly, and readers focus on the work itself.`,
  },
  {
    title: 'Typographic Rhythm for Long-Form Technical Writing',
    slug: 'typographic-rhythm-for-long-form-technical-writing',
    category: 'Design',
    excerpt:
      'Practical notes on measure, line height, hierarchy, and eliminating visual clutter in digital reading rooms.',
    coverImageUrl: GENERATED_ASSETS.designCraft,
    coverCaption: 'Fig. 2 — Measured proportions on cotton rag paper and brushed steel.',
    readingMinutes: 5,
    featured: false,
    content: `Reading long-form technical prose on a screen is fundamentally an exercise in sustained attention. Every decorative border, pill badge, or competing sidebar steals cognitive energy from the sentence in front of the reader.

## Measure and Vertical Cadence

Set body copy between 65 and 75 characters per line. Beyond 80 characters, the eye loses its anchor when returning from the end of one line to the beginning of the next. Pair that measure with generous leading—between 1.65 and 1.8—so ascenders and descenders breathe naturally.

### Restraint in Metadata

Dates, categories, and reading times are orienting signals, not calls to action. Setting them as quiet unboxed text separated by typographic dots preserves the editorial hierarchy and lets headlines command the page.`,
  },
  {
    title: 'Deterministic Real-Time Feeds Without State Drift',
    slug: 'deterministic-real-time-feeds-without-state-drift',
    category: 'Systems',
    excerpt:
      'Patterns for pairing real-time document listeners with optimistic UI boundaries and zero-trust security rules.',
    coverImageUrl: GENERATED_ASSETS.distributedSystems,
    coverCaption: 'Fig. 3 — Optical prisms splitting a single beam into discrete, verifiable paths.',
    readingMinutes: 7,
    featured: false,
    content: `Real-time listeners feel effortless when they work, and deeply disorienting when local state diverges from server truth. The cleanest solution is treating the remote query stream as the single authoritative timeline.

## Rules as Executable Contracts

Never rely on client filtering alone to protect unpublished drafts or private notes. Enforce visibility predicates directly inside database security rules so unauthorized queries fail deterministically at the edge.

\`\`\`typescript
const postsQuery = query(
  collection(db, 'posts'),
  where('status', '==', 'published'),
  orderBy('createdAt', 'desc')
);
\`\`\`

### Handling Permission Boundaries Gracefully

When a mutation fails, wrap the error with the operation type, collection path, and authentication state. That structured context cuts debugging time from hours to seconds.`,
  },
  {
    title: 'Notes From Building a Quiet Personal Publishing Desk',
    slug: 'notes-from-building-a-quiet-personal-publishing-desk',
    category: 'Notes',
    excerpt:
      'Reflections on why owning your writing environment—complete with audio narration and reader dialogue—changes how often you publish.',
    coverImageUrl: GENERATED_ASSETS.creativeProcess,
    coverCaption: 'Fig. 4 — Morning studio desk configured for unhurried drafting.',
    readingMinutes: 4,
    featured: false,
    content: `Publishing platforms often optimize for engagement loops rather than thoughtful conversation. Building a dedicated home for your own essays restores authorship: you decide the typography, the pacing, and how readers respond.

## Listening as an Editing Tool

Reading an essay aloud—or listening to it through browser speech synthesis—exposes clunky transitions and overly dense clauses immediately. Including an audio narration control benefits both readers who prefer listening and the writer refining each paragraph.`,
  },
];

export const STARTER_WORKS = [
  {
    title: 'Calibrated Telemetry Ledger',
    discipline: 'Systems Engineering',
    year: '2026',
    summary:
      'High-throughput event ingestion pipeline and real-time diagnostic workbench built with strict schema validation and sub-second query latency.',
    outcome: 'Reduced diagnostic triage time by 58% across 14 engineering squads',
    linkUrl: 'https://github.com',
    orderIndex: 1,
  },
  {
    title: 'Monograph Design System',
    discipline: 'Design Engineering',
    year: '2025',
    summary:
      'Accessible multi-surface component architecture grounded in WCAG AA contrast, tabular typography, and zero-runtime CSS tokens.',
    outcome: 'Adopted across 6 production web apps with 100% keyboard parity',
    linkUrl: 'https://github.com',
    orderIndex: 2,
  },
  {
    title: 'Edge Rule Verifier',
    discipline: 'Developer Tooling',
    year: '2025',
    summary:
      'Automated payload fuzzing harness that audits document security rules against identity spoofing and oversized payload attacks.',
    outcome: 'Caught 23 schema and authorization gaps prior to production launch',
    linkUrl: 'https://github.com',
    orderIndex: 3,
  },
];

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, BLUEPRINT_CONSTRAINTS.post.slug.maxLength);
}

export function estimateReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(120, Math.max(1, Math.round(words / 210)));
}
