/**
 * Firestore Security Rules Specification Tests ("Dirty Dozen" Payloads)
 * Designed for verification against @firebase/rules-unit-testing when emulator is active.
 */

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Unauthenticated Post Creation',
    auth: null,
    path: 'posts/hack-1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Non-Admin Post Creation',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'posts/hack-2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Email Spoofing Attack (Unverified Email)',
    auth: { uid: 'spoof-1', email: 'monojitnandy20052023lp@gmail.com', email_verified: false },
    path: 'posts/hack-3',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Shadow Field Injection on Post',
    auth: { uid: 'admin-1', email: 'monojitnandy20052023lp@gmail.com', email_verified: true },
    path: 'posts/hack-4',
    operation: 'create',
    payloadExtra: { isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Orphaned Comment on Draft Post',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'posts/draft-post-1/comments/c1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Comment Identity Spoofing',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'posts/pub-1/comments/c2',
    operation: 'create',
    payloadOverride: { authorId: 'reader-2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Author Impersonation in Comment',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'posts/pub-1/comments/c3',
    operation: 'create',
    payloadOverride: { isAuthorReply: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Comment Cross-User Edit',
    auth: { uid: 'reader-2', email: 'reader2@example.com', email_verified: true },
    path: 'posts/pub-1/comments/c1-owned-by-reader-1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Comment Immutable Field Tampering',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'posts/pub-1/comments/c1-owned-by-reader-1',
    operation: 'update',
    payloadOverride: { postId: 'other-post' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. ID Poisoning Attack',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'posts/pub-1/comments/' + 'x'.repeat(150),
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Oversized Comment Body',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'posts/pub-1/comments/c4',
    operation: 'create',
    payloadOverride: { body: 'a'.repeat(5000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Self-Assigned Admin Escalation',
    auth: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    path: 'admins/reader-1',
    operation: 'create',
    payloadOverride: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
];
