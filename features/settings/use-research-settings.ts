import { useCallback, useEffect, useState } from 'react';

import { readPreferences, saveResearchPreferences } from '@/features/onboarding/storage';

export function useResearchSettings() {
  const [enabled, setEnabledState] = useState(false);
  const [consent, setConsent] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const preferences = await readPreferences();
    setEnabledState(preferences.researchEnabled && preferences.researchConsent.status === 'granted');
    setConsent(preferences.researchConsent.status);
  }, []);

  useEffect(() => { void load().catch(() => setMessage('Could not load research settings.')); }, [load]);

  const save = async (nextEnabled: boolean, nextConsent: 'granted' | 'denied') => {
    setSaving(true);
    setMessage(null);
    try {
      await saveResearchPreferences({ enabled: nextEnabled, consent: nextConsent });
      setEnabledState(nextEnabled && nextConsent === 'granted');
      setConsent(nextConsent);
    } catch {
      setMessage('Could not save research settings.');
    } finally {
      setSaving(false);
    }
  };

  const setEnabled = async (nextEnabled: boolean) => {
    if (nextEnabled && consent !== 'granted') {
      setMessage(consent === 'unknown' ? 'Choose a research consent option before turning research on.' : 'Allow provider-native research before turning research on.');
      return;
    }
    if (!nextEnabled && consent === 'unknown') return;
    await save(nextEnabled, consent === 'unknown' ? 'denied' : consent);
  };

  return { consent, enabled, message, saving, save, setEnabled };
}
