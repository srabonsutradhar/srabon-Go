# Security Summary

**Codebase Review Scope**: Reviewed **14** backend, frontend, configuration, and security rule files across Express API routing (`server.ts`, `genaiProxy.ts`), client utilities and UI components (`utils/audio.ts`, `utils/usePWAInstall.ts`, `components/PWAInstallButton.tsx`, `components/OfflineIndicator.tsx`, `components/AiResultCard.tsx`, `components/CustomVoiceCloneStudio.tsx`, `components/AdminPanelModal.tsx`, `components/FilterBar.tsx`, `components/HomePage.tsx`, `components/GoogleLoginGate.tsx`, `App.tsx`), HTML/PWA configuration (`index.html`, `vite.config.ts`), and Firestore schemas and access rules (`firestore.rules`, `firebase-blueprint.json`).

### Issues Resolved

| Severity | Area | Finding | Resolution |
| :--- | :--- | :--- | :--- |
| **High** | API Cross-Origin Access | `/api/*` reflected any caller `Origin` header into `Access-Control-Allow-Origin`, allowing arbitrary third-party origins to invoke server-proxied AI endpoints. | Replaced origin reflection with an explicit host/allowlist check (`isAllowedCorsOrigin`), added `Vary: Origin`, and rejected disallowed cross-origin API requests with `403`. |
| **High** | API Rate-Limit Bypass | `aiRateLimitMiddleware` keyed rate limits on caller-supplied `x-client-id` before IP, letting clients bypass the 45 req/min limit by rotating the header. | Split IP identification (`getIpKey` via Express `trust proxy: 2`) from session ownership (`getOwnerSessionKey`); enforced rate limits strictly per verified IP. |
| **High** | Video Operation Ownership | `/api/videos-operation` looked up operations by `operation.name` without verifying `storedOp.ownerKey` matched the caller, enabling cross-client operation polling. | Verified `storedOp.ownerKey === getOwnerSessionKey(req)` before polling upstream or returning operation payloads, returning `403` on mismatch. |
| **High** | Missing Browser Security Headers & CSP | Server responses omitted Content Security Policy and defensive HTTP headers while exposing `X-Powered-By`. | Disabled `X-Powered-By` and added global middleware sending a scoped `Content-Security-Policy` (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, explicit `script-src`, `connect-src`, `media-src`, `img-src`, `frame-src`, `worker-src`, `manifest-src`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (allowing `microphone=(self)`), `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and HTTPS HSTS. |
| **Medium** | Firestore Quota Manipulation | Authenticated owners updating `/users/{userId}` could reset `dailyCount` back to `0` on the same `lastUsageDate` or roll `lastUsageDate` backwards. | Added a monotonic quota invariant in `firestore.rules`: updates must advance `lastUsageDate` or keep `dailyCount >= existing().dailyCount`. |
| **Medium** | Server-Target URL Validation | `normalizeApiBaseUrl` and `firestore.rules` accepted `http://` public hosts and private/link-local IP literals (such as cloud metadata addresses). | Restricted `normalizeApiBaseUrl` to HTTPS public origins (HTTP permitted only for `localhost` / `127.0.0.1`), blocked credentialed URLs, query/hash parts, and private/link-local IP ranges, and tightened the regex in `firestore.rules` and `firebase-blueprint.json`. |
| **Medium** | Body Limit, Input Validation & Error Exposure | JSON body cap was `50mb`, several AI proxy routes lacked payload shape checks, and unexpected `500` responses forwarded raw exception messages. | Reduced body limit to `12mb`, validated `voiceName`, `sessionId`, `contents`, `message`, image `prompt`, and `opName`, and replaced unexpected `500` error text with safe generic messages. |
| **Low** | Markdown Links & Audio Upload Validation | `<ReactMarkdown>` lacked an explicit URL scheme transform and `target`/`rel` guards; audio upload did not enforce audio MIME/extension checks or probe timeouts; new-tab link passed full `window.location.href`. | Added explicit `https:`/`http:`/`mailto:` link transform with `noopener noreferrer` in `AiResultCard`, added MIME/extension checks plus 3s probe cleanup in `CustomVoiceCloneStudio`, and constructed new-tab hrefs from `origin + pathname + search`. |

### Safeguards Verified

- **Google Auth Popup & Microphone Compatibility**: Configured `Cross-Origin-Opener-Policy: same-origin-allow-popups` and `Permissions-Policy: ..., microphone=(self)` while keeping iframe preview compatibility intact.
- **No Raw HTML Injection Sinks**: Audited the codebase for `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, and `window.open`; none are used for untrusted data.
- **Firestore Rules Alignment**: Verified all 12 collections in `firestore.rules` align with `firebase-blueprint.json` schemas, enforce `request.auth.token.email_verified == true` on writes, restrict PII reads to owners and the verified admin, and validate server timestamps (`request.time`).
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

### 3. Video Operation Cross-Session Polling (`POST /api/videos-operation`)
- **Attack Scenario**: Client B learns or guesses an active `operation.name` created by Client A and polls `/api/videos-operation` to read Client A's generated video metadata/URI.
- **Verification**:
  1. Client A starts generation via `/api/generate-videos`; `videoOps` records `ownerKey = getOwnerSessionKey(reqA)`.
  2. Client B posts `{ "operation": { "name": "<opName>" } }` with a different `x-client-id` or IP.
  3. `storedOp.ownerKey !== getOwnerSessionKey(reqB)` triggers HTTP `403` (`{"error":"Access denied for this video operation."}`).

### 4. Dynamic Backend URL Validation (`normalizeApiBaseUrl` & `firestore.rules`)
- **Attack Scenario**: An admin or config payload attempts to save `http://169.254.169.254/latest/meta-data`, `http://10.0.0.5:8080`, or `http://insecure.example.com` as `apiBaseUrl`.
- **Verification**:
  1. `normalizeApiBaseUrl("http://169.254.169.254")` and `normalizeApiBaseUrl("http://10.0.0.5:8080")` return `""`.
  2. Firestore rule `isValidBillingConfig` rejects any URL without `https://` + alphabetic TLD (except `http://localhost` / `http://127.0.0.1`).

### 5. Same-Day Quota Counter Reset Prevention (`firestore.rules`)
- **Attack Scenario**: An authenticated user sends a direct Firestore `updateDoc` on `/users/{uid}` setting `{ dailyCount: 0, lastUsageDate: "<today>" }` after reaching `freeDailyLimit`.
- **Verification**:
  1. In `/users/{userId}` Action 1, `incoming().lastUsageDate == existing().lastUsageDate && incoming().dailyCount >= existing().dailyCount` evaluates to `false` when `dailyCount` decreases on the same day or `lastUsageDate` decreases.
  2. Firestore denies the write with `PERMISSION_DENIED`.

### 6. Markdown URI Scheme & Link Target Protection (`AiResultCard.tsx`)
- **Attack Scenario**: Model output includes `[click](javascript:alert(1))`.
- **Verification**:
  1. `<ReactMarkdown>` invokes `urlTransform`, rejecting non-`http:`/`https:`/`mailto:` protocols and returning `""`.
  2. External `https://` links render strictly with `target="_blank" rel="noopener noreferrer"`.
