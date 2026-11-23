# Security Summary

**Codebase Review Scope**: Completed a line-by-line review of the entire application across backend proxy routes (`server.ts`, `genaiProxy.ts`), root state and utilities (`App.tsx`, `firebase.ts`, `constants.ts`, `types.ts`, `utils/*`), all 27 frontend components (`components/*`), PWA and build setup (`index.html`, `vite.config.ts`, `package.json`, `metadata.json`), and Firestore rules and schemas (`firestore.rules`, `firebase-blueprint.json`).

### Issues Resolved

| Severity | Area | Finding | Resolution |
| :--- | :--- | :--- | :--- |
| **High** | API Cross-Origin Access | `/api/*` reflected any caller `Origin` header into `Access-Control-Allow-Origin`, allowing arbitrary third-party origins to invoke server-proxied AI endpoints. | Replaced origin reflection with an explicit host/allowlist check (`isAllowedCorsOrigin`), added `Vary: Origin`, and rejected disallowed cross-origin API requests with `403`. |
| **High** | API Rate-Limit Bypass | `aiRateLimitMiddleware` keyed rate limits on caller-supplied `x-client-id` before IP, letting clients bypass the 45 req/min limit by rotating the header. | Split IP identification (`getIpKey` via Express `trust proxy: 2`) from session ownership (`getOwnerSessionKey`); enforced rate limits strictly per verified IP. |
| **High** | Video Operation Ownership | `/api/videos-operation` looked up operations by `operation.name` without verifying `storedOp.ownerKey` matched the caller, enabling cross-client operation polling. | Verified `storedOp.ownerKey === getOwnerSessionKey(req)` before polling upstream or returning operation payloads, returning `403` on mismatch. |
| **High** | Missing Browser Security Headers & CSP | Server responses omitted Content Security Policy and defensive HTTP headers while exposing `X-Powered-By`. | Disabled `X-Powered-By` and added global middleware sending a scoped `Content-Security-Policy` (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, explicit `script-src`, `connect-src`, `media-src`, `img-src`, `frame-src`, `worker-src`, `manifest-src`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (allowing `microphone=(self)`), `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and HTTPS HSTS. |
| **Medium** | Atomic Quota & Coupon Transactions | Concurrent AI calls in `App.tsx` read client React state before calling `updateDoc` (allowing race conditions across fast clicks), and `SalonBookingPage.tsx` read the coupon document in a transaction without validating its live `status`/`code`. | Refactored `consumeAiQuota` in `App.tsx` to execute inside `runTransaction` with a serialized promise queue lock, and added strict coupon existence/status/code verification inside `SalonBookingPage`'s booking transaction. |
| **Medium** | Server Quota Accounting & Chat Bounds | `/server.ts` incremented `ttsDailyCount` before knowing if upstream synthesis succeeded, left `/api/chat-message` & `/api/chat-stream` `history`/`message` lengths unbounded, and contained dead code in `/api/generate-videos`. | Charged `ttsDailyCount` only on successful audio output, bounded `history` (`<= 50` turns, valid `role`/`parts`) and `message` length (`<= 20,000`), validated video prompt payloads, and removed dead code. |
| **Medium** | Firestore Quota & Rule Manipulation | Authenticated owners updating `/users/{userId}` could reset `dailyCount` back to `0` on the same `lastUsageDate` or roll `lastUsageDate` backwards. | Added a monotonic quota invariant in `firestore.rules`: updates must advance `lastUsageDate` or keep `dailyCount >= existing().dailyCount`. |
| **Medium** | Server-Target URL Validation | `normalizeApiBaseUrl` and `firestore.rules` accepted `http://` public hosts and private/link-local IP literals (such as cloud metadata addresses). | Restricted `normalizeApiBaseUrl` to HTTPS public origins (HTTP permitted only for `localhost` / `127.0.0.1`), blocked credentialed URLs, query/hash parts, and private/link-local IP ranges, and tightened the regex in `firestore.rules` and `firebase-blueprint.json`. |
| **Medium** | Body Limit, Input Validation & Error Exposure | JSON body cap was `50mb`, several AI proxy routes lacked payload shape checks, and unexpected `500` responses forwarded raw exception messages. | Reduced body limit to `12mb`, validated `voiceName`, `sessionId`, `contents`, `message`, image `prompt`, and `opName`, and replaced unexpected `500` error text with safe generic messages. |
| **Low** | Markdown Protocol-Relative Links & Upload Safety | `AiResultCard` `urlTransform` permitted leading `//` links; `PWAInstallButton` dropped `?ref=` search params on new-tab launch; `VoiceFinder` lacked an unmount guard. | Blocked leading `//` URLs in `AiResultCard` (with copy timer cleanup), preserved `window.location.search` in `PWAInstallButton`, and added unmount guards in `VoiceFinder`. |
| **Low** | Salon Queue Sync, Calibration Boost & Listener Stability | Viewing tomorrow's salon queue muted today's live serial alerts; past slots within the 10-min grace window appeared bookable; `TtsStudio` double-boosted calibrated audio and omitted calibration/boost from cache keys; `AdminPanelModal`/`SiteReviewsSection` reset listeners/timers unnecessarily. | Added a dedicated `todayTickets` live listener, enforced a 0-min cutoff for new bookings with auto-advance when today's slots end, unified calibration/boost rendering + cache keys in `TtsStudio`, bounded/stabilized `AdminPanelModal` (`limit(250)` + ref timer), and removed `lang` from `SiteReviewsSection`'s listener deps. |

### Safeguards Verified

- **Google Auth Popup & Microphone Compatibility**: Configured `Cross-Origin-Opener-Policy: same-origin-allow-popups` and `Permissions-Policy: ..., microphone=(self)` while keeping iframe preview compatibility intact.
- **No Raw HTML Injection Sinks**: Audited the entire codebase for `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, and `window.open`; none are used for untrusted data.
- **Firestore Rules Alignment**: Verified all collections in `firestore.rules` align with `firebase-blueprint.json` schemas, enforce `request.auth.token.email_verified == true` on writes, restrict PII reads to owners and the verified admin, and validate server timestamps (`request.time`).
- **PWA Offline & Install Hardening**: `vite-plugin-pwa` caches static assets cleanly while denying service-worker navigation fallback for `/api/*` and `/__/*` endpoints.

---

## PoC Verification

### 1. Cross-Origin API Rejection (`POST /api/tts`)
- **Attack Scenario**: An untrusted third-party origin (`Origin: https://untrusted.example`) submits a preflight `OPTIONS` or `POST /api/tts` request attempting to consume server quota.
- **Verification**:
  1. `curl -i -X POST -H "Origin: https://untrusted.example" -H "Content-Type: application/json" -d '{"text":"test"}' http://localhost:3000/api/tts`
  2. `isAllowedCorsOrigin("https://untrusted.example", req)` evaluates to `false`.
  3. Server responds immediately with HTTP `403` (`{"error":"Origin not allowed."}`) and `Vary: Origin`, without setting `Access-Control-Allow-Origin`.

### 2. Rate-Limit Evasion via Header Rotation
- **Attack Scenario**: A client sends repeated requests to `/api/tts` while cycling `x-client-id: fake-001`, `fake-002`, etc., to evade the 45 req/min limit.
- **Verification**:
  1. `aiRateLimitMiddleware` calls `getIpKey(req)`, ignoring `x-client-id` for throttling.
  2. After 45 requests from the same resolved IP within 60 seconds, request 46 returns HTTP `429` with `Retry-After: 30` regardless of `x-client-id` changes.

### 3. Oversized / Malformed Chat History & Video Input Rejection (`POST /api/chat-message`)
- **Attack Scenario**: A client submits >50 history turns or malformed turn objects to inflate server tokens/memory or crash SDK parsing.
- **Verification**:
  1. `curl -i -X POST -H "Content-Type: application/json" -d '{"message":"hi","history":[{"role":"invalid","parts":[]}]}' http://localhost:3000/api/chat-message`
  2. Route validation detects `turn.role !== "user" && turn.role !== "model"` before creating a chat session.
  3. Server responds cleanly with HTTP `400` (`{"error":"Invalid chat history payload."}`).

### 4. Video Operation Cross-Session Polling (`POST /api/videos-operation`)
- **Attack Scenario**: Client B learns or guesses an active `operation.name` created by Client A and polls `/api/videos-operation` to read Client A's generated video metadata/URI.
- **Verification**:
  1. Client A starts generation via `/api/generate-videos`; `videoOps` records `ownerKey = getOwnerSessionKey(reqA)`.
  2. Client B posts `{ "operation": { "name": "<opName>" } }` with a different `x-client-id` or IP.
  3. `storedOp.ownerKey !== getOwnerSessionKey(reqB)` triggers HTTP `403` (`{"error":"Access denied for this video operation."}`).

### 5. Dynamic Backend URL Validation (`normalizeApiBaseUrl` & `firestore.rules`)
- **Attack Scenario**: An admin or config payload attempts to save `http://169.254.169.254/latest/meta-data`, `http://10.0.0.5:8080`, or `http://insecure.example.com` as `apiBaseUrl`.
- **Verification**:
  1. `normalizeApiBaseUrl("http://169.254.169.254")` and `normalizeApiBaseUrl("http://10.0.0.5:8080")` return `""`.
  2. Firestore rule `isValidBillingConfig` rejects any URL without `https://` + alphabetic TLD (except `http://localhost` / `http://127.0.0.1`).

### 6. Same-Day Quota Reset & Concurrent Coupon Replay Prevention
- **Attack Scenario**: An authenticated user triggers two concurrent AI generations or attempts to reuse a coupon across two tabs simultaneously, or sends `dailyCount: 0` directly to Firestore.
- **Verification**:
  1. `App.tsx` serializes quota checks via `quotaLockRef` + `runTransaction` against authoritative server `dailyCount`/`bonusCredits`, and `firestore.rules` rejects same-day decrements on `/users/{uid}`.
  2. `SalonBookingPage.tsx` checks `couponSnap.exists() && status === 'available'` inside `runTransaction`, while `firestore.rules` enforces `existing().status == 'available' && incoming().status == 'used'`.

### 7. Markdown URI Scheme & Protocol-Relative Link Protection (`AiResultCard.tsx`)
- **Attack Scenario**: Model output includes `[click](javascript:alert(1))` or `[redir](//evil.example)`.
- **Verification**:
  1. `<ReactMarkdown>` invokes `urlTransform`, rejecting non-`http:`/`https:`/`mailto:` protocols as well as `//` protocol-relative paths and returning `""`.
  2. External `https://` links render strictly with `target="_blank" rel="noopener noreferrer"`.
