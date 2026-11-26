# Security Specification — Portfolio Blog & Comments

## 1. Data Invariants
1. **Admin Authority**: Only the verified portfolio owner (`request.auth.token.email == 'monojitnandy20052023lp@gmail.com' && request.auth.token.email_verified == true`) or a user with a trusted `/admins/{uid}` document may create, edit, or delete blog posts (`/posts/{postId}`), portfolio works (`/works/{workId}`), or the portfolio profile (`/profile/{profileId}`).
2. **Draft Isolation**: Unauthenticated visitors and non-admin readers can only read (`get` and `list`) blog posts where `status == 'published'`. Drafts (`status == 'draft'`) are readable only by the admin.
3. **Comment Parent Integrity**: A comment in `/posts/{postId}/comments/{commentId}` cannot exist without an existing parent post at `/posts/{postId}` whose `status == 'published'`, and `comment.postId == postId`.
4. **Comment Identity Integrity**: Only authenticated users with verified emails (`request.auth.token.email_verified == true`) may create comments, and `authorId` must strictly equal `request.auth.uid`. Non-admins cannot set `isAuthorReply: true`.
5. **Comment Ownership & Moderation**: A reader may edit only their own comment (`body` and `updatedAt` only) and may delete only their own comment. The admin may delete any comment for moderation.
6. **Temporal & Immutable Integrity**: All `createdAt` and `updatedAt` fields must match `request.time`. `createdAt`, `authorId`, and `postId` are immutable after creation.
7. **Zero PII Exposure**: No private PII (personal emails, phone numbers, home addresses) is stored in public collections.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Post Creation**: Anonymous visitor attempts `create` on `/posts/hack-1`. Expected: `PERMISSION_DENIED`.
2. **Non-Admin Post Creation**: Signed-in non-admin reader attempts `create` on `/posts/hack-2` with their own `authorId`. Expected: `PERMISSION_DENIED`.
3. **Email Spoofing Attack**: User with matching admin email but `email_verified: false` attempts `create` on `/posts/hack-3`. Expected: `PERMISSION_DENIED`.
4. **Shadow Field Injection on Post**: Admin attempts `create` on `/posts/hack-4` with extra ghost field `isVerified: true`. Expected: `PERMISSION_DENIED`.
5. **Orphaned Comment on Missing/Draft Post**: Signed-in verified user attempts `create` on `/posts/draft-post-1/comments/c1`. Expected: `PERMISSION_DENIED`.
6. **Comment Identity Spoofing**: Signed-in verified user A attempts `create` on `/posts/p1/comments/c2` with `authorId: 'user-B'`. Expected: `PERMISSION_DENIED`.
7. **Author Impersonation in Comment**: Signed-in non-admin user attempts `create` on `/posts/p1/comments/c3` with `isAuthorReply: true`. Expected: `PERMISSION_DENIED`.
8. **Comment Cross-User Edit**: Signed-in user B attempts `update` on user A's comment modifying `body`. Expected: `PERMISSION_DENIED`.
9. **Comment Immutable Field Tampering**: Comment owner attempts `update` on their comment changing `createdAt` or `postId` or `authorId`. Expected: `PERMISSION_DENIED`.
10. **ID Poisoning Attack**: User attempts `create` on `/posts/p1/comments/<150-char-invalid-id!@#>` with invalid characters/length. Expected: `PERMISSION_DENIED`.
11. **Value Poisoning / Oversized Payload**: Verified user attempts `create` comment with 10,000-character `body` exceeding `2000` limit. Expected: `PERMISSION_DENIED`.
12. **Self-Assigned Admin Escalation**: Non-admin user attempts `create` on `/admins/<their-uid>` with `{ role: 'admin' }`. Expected: `PERMISSION_DENIED`.
