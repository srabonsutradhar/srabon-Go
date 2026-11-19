# Security Specification — Srabon Go

## 1. Data Invariants
1. All application data access requires a verified Google Sign-In session (`request.auth != null && request.auth.token.email_verified == true`).
2. User profiles & PII (`/users/{userId}`) are readable/updatable only by the document owner (`request.auth.uid == userId`) or the verified bootstrapped admin (`srabon10010@gmail.com`).
3. New `/users/{userId}` documents MUST initialize `plan: "free"`. Owners CANNOT self-promote `plan` to `"pro"`. Only the verified admin can change `plan`.
4. `/proRequests/{requestId}` can only be created by the owning verified user with `status: "pending"`. Only the verified admin can transition a `pending` request to `"approved"` or `"rejected"` (terminal state locking).
5. `/appConfig/{configId}` contains non-PII pricing/payment instructions readable by signed-in users (`get` only, no `list`) and writable exclusively by the verified admin.
6. Every timestamp (`createdAt`, `updatedAt`) is strictly bound to `request.time`, `createdAt`/`uid` are immutable, and every string/list is bounded in length.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` reading or writing `/users/user123` or `/proRequests/req1`.
2. **Self-promotion on create**: User A creating `/users/userA` with `plan: "pro"`.
3. **Self-promotion on update**: User A updating `/users/userA` to change `plan` from `"free"` to `"pro"`.
4. **Cross-user PII read**: User A reading `/users/userB` or listing `/users`.
5. **Cross-user write**: User A writing `/users/userB` or `/proRequests/reqB` with `uid: "userB"`.
6. **Spoofed admin email**: Unverified token with `email: "srabon10010@gmail.com"` and `email_verified: false` accessing admin operations.
7. **Shadow / ghost field injection**: Creating/updating `/users/userA` or `/proRequests/req1` with extra field `{ isAdmin: true }`.
8. **ID poisoning**: Accessing `/users/../../etc` or a 500-char document ID.
9. **Pre-approved Pro request**: User A creating `/proRequests/req1` with `status: "approved"`.
10. **Terminal state mutation**: Re-updating a `proRequests` document whose `status` is already `"approved"` or `"rejected"`.
11. **Non-admin billing config edit**: User A writing `/appConfig/proPlan`.
12. **Array/Type poisoning**: Updating `favorites` with 51+ entries or setting `dailyCount` to `-5` or `"999"`.
