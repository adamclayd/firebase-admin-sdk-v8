import { sendMessage, subscribeToTopic, unsubscribeFromTopic } from './client';

// Mock dependencies
jest.mock('../token-generation', () => ({
  getAdminAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
}));

jest.mock('../config', () => ({
  getProjectId: jest.fn().mockReturnValue('test-project'),
}));

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch;

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

// =============================================================================
// sendMessage
// =============================================================================

describe('sendMessage', () => {
  const FCM_URL = 'https://fcm.googleapis.com/v1/projects/test-project/messages:send';

  test('sends message with token target', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/123' }));

    const result = await sendMessage({
      token: 'device-token-abc',
      notification: { title: 'Hello', body: 'World' },
    });

    expect(result).toBe('projects/test-project/messages/123');
    expect(mockFetch).toHaveBeenCalledWith(FCM_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: 'device-token-abc',
          notification: { title: 'Hello', body: 'World' },
        },
      }),
    });
  });

  test('sends message with topic target', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/456' }));

    const result = await sendMessage({
      topic: 'news',
      notification: { title: 'Breaking News' },
    });

    expect(result).toBe('projects/test-project/messages/456');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.topic).toBe('news');
  });

  test('sends message with condition target', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/789' }));

    const result = await sendMessage({
      condition: "'news' in topics || 'alerts' in topics",
      data: { key: 'value' },
    });

    expect(result).toBe('projects/test-project/messages/789');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.condition).toBe("'news' in topics || 'alerts' in topics");
    expect(body.message.data).toEqual({ key: 'value' });
  });

  test('sends message with notification and data payload', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/100' }));

    await sendMessage({
      token: 'token-1',
      notification: { title: 'Title', body: 'Body', image: 'https://example.com/img.png' },
      data: { conversationId: 'conv-123', path: '/chat/conv-123' },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.notification).toEqual({
      title: 'Title',
      body: 'Body',
      image: 'https://example.com/img.png',
    });
    expect(body.message.data).toEqual({
      conversationId: 'conv-123',
      path: '/chat/conv-123',
    });
  });

  test('sends message with android config', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/101' }));

    await sendMessage({
      token: 'token-1',
      notification: { title: 'Test' },
      android: {
        priority: 'high',
        ttl: '86400s',
        notification: {
          icon: 'ic_notification',
          color: '#ff0000',
          channel_id: 'chat_messages',
          click_action: 'OPEN_CHAT',
        },
      },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.android.priority).toBe('high');
    expect(body.message.android.ttl).toBe('86400s');
    expect(body.message.android.notification.channel_id).toBe('chat_messages');
  });

  test('sends message with webpush config', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/102' }));

    await sendMessage({
      token: 'token-1',
      notification: { title: 'Test' },
      webpush: {
        headers: { TTL: '3600' },
        fcm_options: { link: 'https://example.com/chat' },
      },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.webpush.headers.TTL).toBe('3600');
    expect(body.message.webpush.fcm_options.link).toBe('https://example.com/chat');
  });

  test('sends message with apns config', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/103' }));

    await sendMessage({
      token: 'token-1',
      notification: { title: 'Test' },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { badge: 5, sound: 'default' } },
        fcm_options: { image: 'https://example.com/img.png' },
      },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.apns.headers['apns-priority']).toBe('10');
    expect(body.message.apns.payload.aps.badge).toBe(5);
    expect(body.message.apns.fcm_options.image).toBe('https://example.com/img.png');
  });

  test('sends message with fcm_options', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/104' }));

    await sendMessage({
      token: 'token-1',
      data: { key: 'val' },
      fcm_options: { analytics_label: 'chat_notification' },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.fcm_options.analytics_label).toBe('chat_notification');
  });

  test('sends data-only message (no notification)', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: 'projects/test-project/messages/105' }));

    await sendMessage({
      token: 'token-1',
      data: { type: 'sync', action: 'refresh' },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.notification).toBeUndefined();
    expect(body.message.data).toEqual({ type: 'sync', action: 'refresh' });
  });

  // --- Validation ---

  test('throws when no target specified', async () => {
    await expect(sendMessage({
      notification: { title: 'No target' },
    })).rejects.toThrow('One of token, topic, or condition must be specified');
  });

  test('throws when multiple targets specified', async () => {
    await expect(sendMessage({
      token: 'token-1',
      topic: 'news',
      notification: { title: 'Both targets' },
    })).rejects.toThrow('Only one of token, topic, or condition can be specified');
  });

  test('throws when token and condition specified', async () => {
    await expect(sendMessage({
      token: 'token-1',
      condition: "'a' in topics",
    })).rejects.toThrow('Only one of token, topic, or condition can be specified');
  });

  test('throws when all three targets specified', async () => {
    await expect(sendMessage({
      token: 'token-1',
      topic: 'news',
      condition: "'a' in topics",
    })).rejects.toThrow('Only one of token, topic, or condition can be specified');
  });

  // --- Error handling ---

  test('throws on HTTP error with JSON body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(
      { error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' } },
      404,
    ));

    await expect(sendMessage({
      token: 'invalid-token',
      notification: { title: 'Test' },
    })).rejects.toThrow('FCM send failed (404)');
  });

  test('throws on HTTP error with non-JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
      text: () => Promise.resolve('Internal Server Error'),
    } as Response);

    await expect(sendMessage({
      token: 'token-1',
      notification: { title: 'Test' },
    })).rejects.toThrow('FCM send failed (500): Internal Server Error');
  });

  test('throws on 401 unauthorized', async () => {
    mockFetch.mockResolvedValue(jsonResponse(
      { error: { code: 401, message: 'Request had invalid authentication credentials.' } },
      401,
    ));

    await expect(sendMessage({
      token: 'token-1',
      notification: { title: 'Test' },
    })).rejects.toThrow('FCM send failed (401)');
  });
});

// =============================================================================
// subscribeToTopic
// =============================================================================

describe('subscribeToTopic', () => {
  const IID_URL = 'https://iid.googleapis.com/iid/v1:batchAdd';

  test('subscribes tokens to topic successfully', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      results: [{}, {}, {}],
    }));

    const result = await subscribeToTopic(
      ['token-1', 'token-2', 'token-3'],
      'news',
    );

    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.errors).toEqual([]);

    expect(mockFetch).toHaveBeenCalledWith(IID_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-access-token',
        'Content-Type': 'application/json',
        'access_token_auth': 'true',
      },
      body: JSON.stringify({
        to: '/topics/news',
        registration_tokens: ['token-1', 'token-2', 'token-3'],
      }),
    });
  });

  test('handles mixed success and failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      results: [{}, { error: 'NOT_FOUND' }, {}, { error: 'INVALID_ARGUMENT' }],
    }));

    const result = await subscribeToTopic(
      ['token-1', 'token-2', 'token-3', 'token-4'],
      'alerts',
    );

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(2);
    expect(result.errors).toEqual([
      { index: 1, error: 'NOT_FOUND' },
      { index: 3, error: 'INVALID_ARGUMENT' },
    ]);
  });

  test('normalizes topic name with /topics/ prefix', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [{}] }));

    await subscribeToTopic(['token-1'], '/topics/already-prefixed');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toBe('/topics/already-prefixed');
  });

  test('adds /topics/ prefix when missing', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ results: [{}] }));

    await subscribeToTopic(['token-1'], 'my-topic');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toBe('/topics/my-topic');
  });

  test('throws when tokens array is empty', async () => {
    await expect(subscribeToTopic([], 'news'))
      .rejects.toThrow('At least one token is required');
  });

  test('throws when tokens exceed 1000', async () => {
    const tokens = Array.from({ length: 1001 }, (_, i) => `token-${i}`);
    await expect(subscribeToTopic(tokens, 'news'))
      .rejects.toThrow('Maximum 1000 tokens per request');
  });

  test('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as Response);

    await expect(subscribeToTopic(['token-1'], 'news'))
      .rejects.toThrow('FCM topic batchAdd failed (401): Unauthorized');
  });

  test('handles text() failure gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.reject(new Error('stream error')),
    } as Response);

    await expect(subscribeToTopic(['token-1'], 'news'))
      .rejects.toThrow('FCM topic batchAdd failed (503): HTTP 503');
  });
});

// =============================================================================
// unsubscribeFromTopic
// =============================================================================

describe('unsubscribeFromTopic', () => {
  const IID_URL = 'https://iid.googleapis.com/iid/v1:batchRemove';

  test('unsubscribes tokens from topic successfully', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      results: [{}, {}],
    }));

    const result = await unsubscribeFromTopic(
      ['token-1', 'token-2'],
      'old-topic',
    );

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.errors).toEqual([]);

    expect(mockFetch).toHaveBeenCalledWith(IID_URL, expect.objectContaining({
      method: 'POST',
    }));
  });

  test('handles failures in unsubscribe', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      results: [{ error: 'NOT_FOUND' }],
    }));

    const result = await unsubscribeFromTopic(['bad-token'], 'topic');

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(result.errors).toEqual([{ index: 0, error: 'NOT_FOUND' }]);
  });

  test('throws when tokens array is empty', async () => {
    await expect(unsubscribeFromTopic([], 'news'))
      .rejects.toThrow('At least one token is required');
  });

  test('throws when tokens exceed 1000', async () => {
    const tokens = Array.from({ length: 1001 }, (_, i) => `token-${i}`);
    await expect(unsubscribeFromTopic(tokens, 'news'))
      .rejects.toThrow('Maximum 1000 tokens per request');
  });

  test('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    } as Response);

    await expect(unsubscribeFromTopic(['token-1'], 'topic'))
      .rejects.toThrow('FCM topic batchRemove failed (500): Server Error');
  });
});
