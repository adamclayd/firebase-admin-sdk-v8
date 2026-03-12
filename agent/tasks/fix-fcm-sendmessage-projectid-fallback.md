# Task: Fix FCM sendMessage projectId fallback

**Milestone**: None (standalone bug fix)
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Not Started

---

## Objective

Fix `sendMessage` in `src/messaging/client.ts` to use `getProjectId()` instead of `getConfig().projectId`, so FCM works without an explicit `initializeApp()` call — matching the behavior of all Firestore operations.

---

## Context

All Firestore operations (`getDocument`, `setDocument`, `addDocument`, etc.) use `getProjectId()` from `src/config.ts` which falls back to `process.env.FIREBASE_PROJECT_ID` when `initializeApp()` hasn't been called. However, `sendMessage` in `src/messaging/client.ts` (line 34) uses `getConfig().projectId` which reads directly from the `globalConfig` object — returning `undefined` when `initializeApp()` hasn't been called.

This causes the FCM URL to be `https://fcm.googleapis.com/v1/projects/undefined/messages:send`, which silently fails. Discovered in agentbase.me where the ChatRoom Durable Object never called `initializeApp()` — Firestore worked fine but FCM push notifications never fired.

**Root cause**: Inconsistent projectId resolution between Firestore and FCM modules.

---

## Steps

### 1. Update `sendMessage` to use `getProjectId()`

In `src/messaging/client.ts`, change:

```typescript
// Before (line 6-7):
import { getConfig } from '../config';

// After:
import { getProjectId } from '../config';
```

```typescript
// Before (lines 34-36):
const config = getConfig();
const accessToken = await getAdminAccessToken();
const url = `${FCM_BASE_URL}/projects/${config.projectId}/messages:send`;

// After:
const accessToken = await getAdminAccessToken();
const projectId = getProjectId();
const url = `${FCM_BASE_URL}/projects/${projectId}/messages:send`;
```

### 2. Update unit tests

In `src/messaging/client.spec.ts`, update or add test cases:

- Test that `sendMessage` works when only `process.env.FIREBASE_PROJECT_ID` is set (no `initializeApp` call)
- Test that `sendMessage` still works when `initializeApp({ projectId: '...' })` was called
- Test that `sendMessage` throws a clear error when neither env var nor config is set

### 3. Verify no other modules use `getConfig().projectId`

Search for other occurrences of `getConfig().projectId` or `config.projectId` across the codebase. If found, update them to use `getProjectId()` for consistency.

### 4. Bump version

Patch bump (e.g., 2.6.0 -> 2.6.1) since this is a bug fix.

### 5. Publish

```bash
npm publish
```

Then update consumers:

```bash
# In agentbase.me:
npm i @prmichaelsen/firebase-admin-sdk-v8@latest
```

---

## Verification

- [ ] `sendMessage` uses `getProjectId()` instead of `getConfig().projectId`
- [ ] Unit test: FCM works with only `process.env.FIREBASE_PROJECT_ID` set
- [ ] Unit test: FCM works with explicit `initializeApp({ projectId })`
- [ ] Unit test: FCM throws clear error when no projectId is configured
- [ ] No other modules use `getConfig().projectId` for URL construction
- [ ] All existing tests pass (`npm test`)
- [ ] E2E tests pass
- [ ] Version bumped and published

---

## Expected Output

**Files Modified**:
- `src/messaging/client.ts`: Use `getProjectId()` instead of `getConfig().projectId`
- `src/messaging/client.spec.ts`: Add env-var fallback tests
- `package.json`: Patch version bump

---

## Notes

- The workaround in agentbase.me (adding `initFirebaseAdmin()` to ChatRoom constructor) should remain even after this fix — explicit initialization is good practice
- This fix makes FCM consistent with Firestore, Auth, and Storage modules which all use `getProjectId()`
- The `getProjectId()` function already has a clear error message when no projectId is configured

---

**Related**: agentbase.me commit `fix(notifications): fix DM push notifications not firing in ChatRoom DO`
