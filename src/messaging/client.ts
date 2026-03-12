/**
 * Firebase Cloud Messaging (FCM) Client
 * Implements FCM HTTP v1 API for sending messages and managing topic subscriptions.
 */

import { getAdminAccessToken } from '../token-generation';
import { getProjectId } from '../config';
import type {
  Message,
  SendResponse,
  TopicManagementResponse,
} from './types';

const FCM_BASE_URL = 'https://fcm.googleapis.com/v1';
const IID_BASE_URL = 'https://iid.googleapis.com/iid/v1';

/**
 * Send a message via FCM HTTP v1 API.
 *
 * Exactly one of `message.token`, `message.topic`, or `message.condition` must be set.
 *
 * @param message - The message to send
 * @returns The message resource name (e.g. "projects/my-project/messages/123")
 */
export async function sendMessage(message: Message): Promise<string> {
  const targets = [message.token, message.topic, message.condition].filter(Boolean);
  if (targets.length === 0) {
    throw new Error('One of token, topic, or condition must be specified');
  }
  if (targets.length > 1) {
    throw new Error('Only one of token, topic, or condition can be specified');
  }

  const accessToken = await getAdminAccessToken();
  const projectId = getProjectId();
  const url = `${FCM_BASE_URL}/projects/${projectId}/messages:send`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    let errorDetail: string;
    try {
      const errorBody = await response.json();
      errorDetail = JSON.stringify(errorBody);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`FCM send failed (${response.status}): ${errorDetail}`);
  }

  const result: SendResponse = await response.json() as SendResponse;
  return result.name;
}

/**
 * Subscribe device tokens to a topic.
 *
 * @param tokens - Array of device registration tokens (max 1000)
 * @param topic - Topic name (with or without "/topics/" prefix)
 * @returns Results with success/failure counts and per-token errors
 */
export async function subscribeToTopic(
  tokens: string[],
  topic: string,
): Promise<TopicManagementResponse> {
  return manageTopicSubscription(tokens, topic, 'batchAdd');
}

/**
 * Unsubscribe device tokens from a topic.
 *
 * @param tokens - Array of device registration tokens (max 1000)
 * @param topic - Topic name (with or without "/topics/" prefix)
 * @returns Results with success/failure counts and per-token errors
 */
export async function unsubscribeFromTopic(
  tokens: string[],
  topic: string,
): Promise<TopicManagementResponse> {
  return manageTopicSubscription(tokens, topic, 'batchRemove');
}

async function manageTopicSubscription(
  tokens: string[],
  topic: string,
  action: 'batchAdd' | 'batchRemove',
): Promise<TopicManagementResponse> {
  if (tokens.length === 0) {
    throw new Error('At least one token is required');
  }
  if (tokens.length > 1000) {
    throw new Error('Maximum 1000 tokens per request');
  }

  const accessToken = await getAdminAccessToken();
  const url = `${IID_BASE_URL}:${action}`;
  const topicPath = topic.startsWith('/topics/') ? topic : `/topics/${topic}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'access_token_auth': 'true',
    },
    body: JSON.stringify({
      to: topicPath,
      registration_tokens: tokens,
    }),
  });

  if (!response.ok) {
    let errorDetail: string;
    try {
      errorDetail = await response.text();
    } catch {
      errorDetail = `HTTP ${response.status}`;
    }
    throw new Error(`FCM topic ${action} failed (${response.status}): ${errorDetail}`);
  }

  const result = await response.json() as { results: Array<{ error?: string }> };

  let successCount = 0;
  let failureCount = 0;
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < result.results.length; i++) {
    const entry = result.results[i];
    if (entry.error) {
      failureCount++;
      errors.push({ index: i, error: entry.error });
    } else {
      successCount++;
    }
  }

  return { successCount, failureCount, errors };
}
