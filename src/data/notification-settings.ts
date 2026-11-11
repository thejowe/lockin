export type NotificationPrefs = {
  notify_likes: boolean;
  notify_matches: boolean;
  notify_messages: boolean;
  notify_group_messages: boolean;
  notify_group_activity: boolean;
  notify_reminders: boolean;
  notify_premium: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: Readonly<NotificationPrefs> = {
  notify_likes: true,
  notify_matches: true,
  notify_messages: true,
  notify_group_messages: true,
  notify_group_activity: true,
  notify_reminders: true,
  notify_premium: true,
};
