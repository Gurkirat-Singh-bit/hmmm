import { useCallback, useEffect, useState } from 'react';

import type { NotificationPreferences } from '@/features/domain/contracts';
import { androidNotificationPort, cancelPendingGenericNotifications } from '@/features/notifications/android-notifications';
import { readPreferences, saveNotificationPreferences } from '@/features/onboarding/storage';

export function useNotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({ enabled: false, reportReady: true, processingFailed: true });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setPreferences((await readPreferences()).notifications);
  }, []);

  useEffect(() => { void load().catch(() => setMessage('Could not load notification settings.')); }, [load]);

  const save = async (next: NotificationPreferences, confirmation: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await saveNotificationPreferences(next);
      await cancelPendingGenericNotifications(next);
      setPreferences(next);
      setMessage(confirmation);
    } catch {
      setMessage('Could not update notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const setEnabled = async (enabled: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      if (enabled) {
        const permission = await androidNotificationPort.requestPermission();
        if (permission !== 'granted' && permission !== 'provisional') {
          setMessage('Android notifications are off. Allow them in system settings to enable background completion alerts.');
          return;
        }
      }
      const next = { ...preferences, enabled };
      await saveNotificationPreferences(next);
      await cancelPendingGenericNotifications(next);
      setPreferences(next);
      setMessage(enabled ? 'Background completion alerts are on.' : 'Background completion alerts are off.');
    } catch {
      setMessage('Could not update notification settings.');
    } finally {
      setSaving(false);
    }
  };

  const setCategory = (category: 'reportReady' | 'processingFailed', enabled: boolean) =>
    save({ ...preferences, [category]: enabled }, enabled ? 'That background outcome will be announced.' : 'That background outcome will stay quiet.');

  return { message, preferences, saving, setCategory, setEnabled };
}
