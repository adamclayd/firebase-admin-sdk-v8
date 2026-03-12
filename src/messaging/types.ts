/**
 * Firebase Cloud Messaging (FCM) Types
 * Based on FCM HTTP v1 API specification
 */

// --- Message Types ---

export interface Message {
  /** Device registration token (mutually exclusive with topic/condition) */
  token?: string;
  /** Topic name (mutually exclusive with token/condition) */
  topic?: string;
  /** Condition expression for topic combinations (mutually exclusive with token/topic) */
  condition?: string;

  /** Basic notification payload displayed on all platforms */
  notification?: Notification;
  /** Custom key-value data payload */
  data?: Record<string, string>;

  /** Android-specific configuration */
  android?: AndroidConfig;
  /** Web push protocol configuration */
  webpush?: WebpushConfig;
  /** Apple Push Notification Service configuration */
  apns?: ApnsConfig;
  /** FCM-specific options */
  fcm_options?: FcmOptions;
}

export interface Notification {
  title?: string;
  body?: string;
  image?: string;
}

// --- Android ---

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
  notification_priority?: AndroidNotificationPriority;
  default_sound?: boolean;
  default_vibrate_timings?: boolean;
  default_light_settings?: boolean;
  vibrate_timings?: string[];
  visibility?: 'VISIBILITY_UNSPECIFIED' | 'PRIVATE' | 'PUBLIC' | 'SECRET';
  notification_count?: number;
  light_settings?: LightSettings;
  image?: string;
}

export type AndroidNotificationPriority =
  | 'PRIORITY_UNSPECIFIED'
  | 'PRIORITY_MIN'
  | 'PRIORITY_LOW'
  | 'PRIORITY_DEFAULT'
  | 'PRIORITY_HIGH'
  | 'PRIORITY_MAX';

export interface LightSettings {
  color: { red: number; green: number; blue: number; alpha: number };
  light_on_duration: string;
  light_off_duration: string;
}

export interface AndroidFcmOptions {
  analytics_label?: string;
}

// --- Web Push ---

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

// --- Apple (APNs) ---

export interface ApnsConfig {
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
  fcm_options?: ApnsFcmOptions;
}

export interface ApnsFcmOptions {
  analytics_label?: string;
  image?: string;
}

// --- Common ---

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
  errors: TopicManagementError[];
}

export interface TopicManagementError {
  index: number;
  error: string;
}
