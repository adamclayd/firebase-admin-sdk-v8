# Firebase Cloud Messaging (FCM) Admin APIs

**Concept**: Server-side FCM APIs for sending push notifications and managing topic subscriptions via REST
**Created**: 2026-03-07
**Status**: Design Specification

---

## Overview

This design document covers adding Firebase Cloud Messaging (FCM) support to firebase-admin-sdk-v8. The primary consumer is agentbase.me's mobile app (agentbase-mobile), which needs server-side push notification delivery when AI chat responses arrive. The implementation uses the FCM HTTP v1 REST API, consistent with the SDK's zero-dependency, edge-runtime-compatible architecture.

---

## Problem Statement

- agentbase-mobile (Capacitor app) needs push notifications for new chat messages
- The backend (agentbase.me on Cloudflare Workers) already uses firebase-admin-sdk-v8 for auth, firestore, and storage
- There is no FCM support in the SDK — the backend cannot send push notifications
- The official firebase-admin SDK requires Node.js and cannot run on edge runtimes

---

## Solution

Add a `src/messaging/` module implementing:

1. **Send Message** — core FCM HTTP v1 API for sending to devices, topics, and conditions
2. **Topic Management** — subscribe/unsubscribe device tokens to/from topics via IID batch APIs

### API Surface

```typescript
// Core - send a single message
sendMessage(message: Message): Promise<string>

// Topic management
subscribeToTopic(tokens: string[], topic: string): Promise<TopicManagementResponse>
unsubscribeFromTopic(tokens: string[], topic: string): Promise<TopicManagementResponse>
```

### Alternative Approaches Considered

1. **Use official firebase-admin SDK** — Rejected: requires Node.js, incompatible with Cloudflare Workers
2. **Wrap a third-party FCM library** — Rejected: adds runtime dependencies, breaks zero-dep principle
3. **Direct fetch calls in consumer apps** — Rejected: duplicates auth/token logic already in SDK

---

## Implementation

### Architecture

```
src/messaging/
  client.ts           # sendMessage, subscribeToTopic, unsubscribeFromTopic
  client.spec.ts      # Unit tests
  types.ts            # All FCM type definitions
  index.ts            # Barrel export
```

### REST API Endpoints

#### Send Message
```
POST https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
Authorization: Bearer {oauth2_access_token}
Content-Type: application/json

{
  "message": { ... }
}

Response: { "name": "projects/{projectId}/messages/{messageId}" }
```

#### Subscribe to Topic (batch)
```
POST https://iid.googleapis.com/iid/v1:batchAdd
Authorization: Bearer {oauth2_access_token}
Content-Type: application/json
access_token_auth: true

{
  "to": "/topics/{topicName}",
  "registration_tokens": ["token1", "token2"]
}

Response: { "results": [{}, {"error": "NOT_FOUND"}, ...] }
```

#### Unsubscribe from Topic (batch)
```
POST https://iid.googleapis.com/iid/v1:batchRemove
(same format as batchAdd)
```

### TypeScript Types

```typescript
// --- Message Types ---

export interface Message {
  // Target (exactly one required)
  token?: string;
  topic?: string;
  condition?: string;

  // Payloads
  notification?: Notification;
  data?: Record<string, string>;

  // Platform-specific
  android?: AndroidConfig;
  webpush?: WebpushConfig;
  apns?: ApnsConfig;
  fcm_options?: FcmOptions;
}

export interface Notification {
  title?: string;
  body?: string;
  image?: string;
}

export interface AndroidConfig {
  collapse_key?: string;
  priority?: 'high' | 'normal';
  ttl?: string;
  restricted_package_name?: string;
  data?: Record<string, string>;
  notification?: AndroidNotification;
  fcm_options?: AndroidFcmOptions;
  direct_boot_ok?: boolean;
}

export interface AndroidNotification {
  title?: string;
  body?: string;
  icon?: string;
  color?: string;
  sound?: string;
  tag?: string;
  click_action?: string;
  body_loc_key?: string;
  body_loc_args?: string[];
  title_loc_key?: string;
  title_loc_args?: string[];
  channel_id?: string;
  ticker?: string;
  sticky?: boolean;
  event_time?: string;
  local_only?: boolean;
  notification_priority?: 'PRIORITY_UNSPECIFIED' | 'PRIORITY_MIN' | 'PRIORITY_LOW' | 'PRIORITY_DEFAULT' | 'PRIORITY_HIGH' | 'PRIORITY_MAX';
  default_sound?: boolean;
  default_vibrate_timings?: boolean;
  default_light_settings?: boolean;
  vibrate_timings?: string[];
  visibility?: 'VISIBILITY_UNSPECIFIED' | 'PRIVATE' | 'PUBLIC' | 'SECRET';
  notification_count?: number;
  light_settings?: LightSettings;
  image?: string;
}

export interface LightSettings {
  color: { red: number; green: number; blue: number; alpha: number };
  light_on_duration: string;
  light_off_duration: string;
}

export interface AndroidFcmOptions {
  analytics_label?: string;
}

export interface WebpushConfig {
  headers?: Record<string, string>;
  data?: Record<string, string>;
  notification?: Record<string, unknown>;
  fcm_options?: WebpushFcmOptions;
}

export interface WebpushFcmOptions {
  link?: string;
  analytics_label?: string;
}

export interface ApnsConfig {
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
  fcm_options?: ApnsFcmOptions;
}

export interface ApnsFcmOptions {
  analytics_label?: string;
  image?: string;
}

export interface FcmOptions {
  analytics_label?: string;
}

// --- Response Types ---

export interface SendResponse {
  /** Full resource name: "projects/{id}/messages/{id}" */
  name: string;
}

export interface TopicManagementResponse {
  successCount: number;
  failureCount: number;
  errors: { index: number; error: string }[];
}
```

### Client Implementation (pseudocode)

```typescript
import { getAdminAccessToken } from '../token-generation';
import { getConfig } from '../config';

export async function sendMessage(message: Message): Promise<string> {
  // Validate exactly one target
  const targets = [message.token, message.topic, message.condition].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error('Exactly one of token, topic, or condition must be specified');
  }

  const config = getConfig();
  const accessToken = await getAdminAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`FCM send failed: ${JSON.stringify(error)}`);
  }

  const result: SendResponse = await response.json();
  return result.name;
}

export async function subscribeToTopic(
  tokens: string[],
  topic: string
): Promise<TopicManagementResponse> {
  return manageTopicSubscription(tokens, topic, 'batchAdd');
}

export async function unsubscribeFromTopic(
  tokens: string[],
  topic: string
): Promise<TopicManagementResponse> {
  return manageTopicSubscription(tokens, topic, 'batchRemove');
}

async function manageTopicSubscription(
  tokens: string[],
  topic: string,
  action: 'batchAdd' | 'batchRemove'
): Promise<TopicManagementResponse> {
  if (tokens.length === 0) throw new Error('At least one token required');
  if (tokens.length > 1000) throw new Error('Maximum 1000 tokens per request');

  const accessToken = await getAdminAccessToken();
  const url = `https://iid.googleapis.com/iid/v1:${action}`;
  const topicName = topic.startsWith('/topics/') ? topic : `/topics/${topic}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'access_token_auth': 'true',
    },
    body: JSON.stringify({
      to: topicName,
      registration_tokens: tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Topic ${action} failed: ${error}`);
  }

  const result = await response.json();
  const errors: { index: number; error: string }[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < result.results.length; i++) {
    if (result.results[i].error) {
      failureCount++;
      errors.push({ index: i, error: result.results[i].error });
    } else {
      successCount++;
    }
  }

  return { successCount, failureCount, errors };
}
```

### Exports (src/index.ts additions)

```typescript
// Messaging exports
export { sendMessage, subscribeToTopic, unsubscribeFromTopic } from './messaging';
export type {
  Message, Notification, AndroidConfig, AndroidNotification,
  WebpushConfig, ApnsConfig, FcmOptions, SendResponse,
  TopicManagementResponse,
} from './messaging';
```

---

## Benefits

- **Zero dependencies**: Uses fetch + existing token generation, consistent with SDK philosophy
- **Edge compatible**: Works on Cloudflare Workers, Deno, Bun, and any edge runtime
- **Minimal API surface**: Three functions cover the primary use cases
- **Type safe**: Full TypeScript types for all FCM message fields
- **Consistent**: Follows same patterns as storage/ and firestore/ modules

---

## Trade-offs

- **No multicast send**: FCM v1 API doesn't support batch send in a single request (must loop). Could add a convenience `sendMulticast()` that sends in parallel if needed.
- **IID API deprecation**: The topic management APIs use the Instance ID service which is technically deprecated, but topic management endpoints remain the only server-side option. Monitor for replacement.
- **No dry-run support**: Could add `validate_only` flag later if needed.

---

## Dependencies

- `src/token-generation.ts` — OAuth2 access token generation (existing)
- `src/config.ts` — Project ID configuration (existing)
- FCM HTTP v1 API: `https://fcm.googleapis.com/v1/`
- IID API: `https://iid.googleapis.com/iid/v1:`

---

## Testing Strategy

### Unit Tests (client.spec.ts)
- sendMessage with token target
- sendMessage with topic target
- sendMessage with condition target
- sendMessage with notification + data payload
- sendMessage with platform-specific configs (android, webpush, apns)
- sendMessage validation: no target, multiple targets
- sendMessage error handling: HTTP errors, malformed responses
- subscribeToTopic success with mixed results
- subscribeToTopic validation: empty tokens, >1000 tokens
- unsubscribeFromTopic success
- Topic name normalization (with/without /topics/ prefix)

### E2E Tests (client.e2e.ts)
- Send to a test device token (requires real FCM token)
- Subscribe/unsubscribe a token to a test topic
- Send to a topic

---

## Migration Path

No migration needed — this is a new module addition. Existing consumers are unaffected.

1. Implement `src/messaging/` module
2. Add exports to `src/index.ts`
3. Add unit tests
4. Bump version to 2.6.0
5. Publish to npm

---

## Future Considerations

- `sendMulticast(tokens[], message)` — convenience for sending to multiple devices in parallel
- `sendAll(messages[])` — batch send multiple different messages
- `validate_only` flag for dry-run testing
- Retry logic with exponential backoff for transient failures
- Monitor IID API deprecation for topic management replacement

---

**Status**: Design Specification
**Recommendation**: Implement — all APIs researched, types defined, agentbase-mobile is blocked on this
**Related Documents**:
- agentbase-mobile task-12: Backend notification sending
- agentbase-mobile milestone-3: Push notifications
