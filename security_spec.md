# Security Specification — Srabon Go

## 1. Data Invariants
1. All application data access requires a verified Google Sign-In session (`request.auth != null && request.auth.token.email_verified == true`).
2. User profiles & PII (`/users/{userId}`) are readable/updatable only by the document owner (`request.auth.uid == userId`) or the verified bootstrapped admin (`srabon10010@gmail.com`), except an atomic referral batch where a referred friend can solely increment `bonusCredits` (+10) and `referralCount` (+1).
3. New `/users/{userId}` documents MUST initialize `plan: "free"`, `dailyCount: 0`, and `bonusCredits: 0`. Owners CANNOT self-promote `plan` to `"pro"` or increase their own `bonusCredits` (only keep unchanged or decrement by 1 per AI generation).
4. `/referralCodes/{code}` is a non-PII immutable map (`code` -> `uid`) readable by signed-in users (`get` only, no `list`).
5. `/referrals/{referredUid}` enforces one-time-only referral claiming per referred Google account (`referredUid != referrerUid`), and atomically pairs with `/users/{referrerUid}` +10 credit grant via `existsAfter`/`getAfter`.
6. `/proRequests/{requestId}` can only be created by the owning verified user with `status: "pending"`. Only the verified admin can transition a `pending` request to `"approved"` or `"rejected"` (terminal state locking).
7. `/appConfig/{configId}` contains non-PII pricing/payment instructions readable by signed-in users (`get` only, no `list`) and writable exclusively by the verified admin.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` reading or writing `/users/user123`, `/referrals/ref1`, or `/proRequests/req1`.
2. **Self-promotion on create/update**: User A setting `plan: "pro"` on their own `/users/userA`.
3. **Self-credit inflation**: User A increasing their own `bonusCredits` by +10 or +1000.
4. **Self-referral**: User A creating `/referrals/userA` with `referrerUid: "userA"`.
5. **Duplicate referral claim**: Friend B claiming a second referral or changing `referrerUid` on `/referrals/friendB`.
6. **Inflated referral reward**: Friend B creating a batch that increments User A's `bonusCredits` by +50 instead of +10.
7. **Orphaned credit grant**: Friend B incrementing User A's `bonusCredits` without atomically creating `/referrals/$(request.auth.uid)`.
8. **Cross-user PII read**: User A reading `/users/userB` or listing `/users` or `/referralCodes`.
9. **Spoofed admin email**: Unverified token with `email: "srabon10010@gmail.com"` and `email_verified: false` accessing admin operations.
10. **Pre-approved Pro request / Terminal state mutation**: Creating `proRequests` with `status: "approved"` or modifying an already approved/rejected request.
11. **Non-admin billing config edit**: User A writing `/appConfig/proPlan`.
12. **Shadow field / ID poisoning**: Adding `{ isAdmin: true }` or using malformed document IDs / oversized strings.
