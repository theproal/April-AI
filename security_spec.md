# April AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Account Isolation**: Every chat session (`/users/{userId}/chats/{chatId}`) and message (`/users/{userId}/chats/{chatId}/messages/{messageId}`) belongs exclusively to a single verified Google account (`request.auth.uid == userId` and `request.auth.token.email_verified == true`).
2. **Empty New Accounts**: A brand-new account starts with zero documents under `/users/{userId}/chats` and cannot read or list any other user's chats.
3. **Referential & Atomic Integrity**: A chat session requires the parent `/users/{userId}` document (`existsAfter`) and a message requires its parent chat session (`existsAfter` + `getAfter(...).data.ownerId == userId`).
4. **Immutable Ownership & Timestamps**: `ownerId`, `id`, `chatId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
5. **PII Isolation**: User email is isolated in `/users/{userId}/private/info` and readable/writable only by the verified owner.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` reading `/users/uidA/chats/chat_1`.
2. **Unverified email**: `request.auth.token.email_verified == false` writing a chat under `/users/uidA/chats/chat_1`.
3. **Cross-account read/list**: User B (`uidB`) listing `/users/uidA/chats` or reading `/users/uidA/chats/chat_1`.
4. **Cross-account impersonation write**: User B (`uidB`) creating `/users/uidB/chats/chat_1` with `ownerId: "uidA"`.
5. **Shadow / Ghost field injection on create**: Creating a chat with extra key `isAdmin: true`.
6. **Shadow / Ghost field injection on update**: Updating a chat with `affectedKeys` including `ownerId` or `isVerified`.
7. **ID Poisoning**: Creating a chat with `chatId` containing invalid characters or length > 128.
8. **Timestamp forgery**: Creating a chat or message with a client-supplied `createdAt` string instead of `request.time`.
9. **Immutable field mutation**: Updating `createdAt` or `chatId` on an existing message.
10. **Unbounded array / text exhaustion**: Sending `text` > 20,000 chars or `actions` list with > 5 items.
11. **Orphan message write**: Creating a message under a non-existent `chatId` without an atomic parent chat write.
12. **PII leak attempt**: User B reading `/users/uidA/private/info`.
