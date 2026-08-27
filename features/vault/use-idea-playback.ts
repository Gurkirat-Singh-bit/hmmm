import { useCallback, useEffect, useRef, useState } from 'react';

import type { AudioAsset, NormalizedError, PlaybackSessionPort, PlaybackState } from '@/features/domain/contracts';
import { normalizeError } from '@/features/domain/errors';
import { ExpoAudioPlaybackAdapter } from '@/features/recording/playback';

export function useIdeaPlayback(audio: AudioAsset | null) {
  const session = useRef<PlaybackSessionPort | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const [state, setState] = useState<PlaybackState>('idle');
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(audio?.durationMs ?? 0);
  const [error, setError] = useState<NormalizedError | null>(null);

  const dispose = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    const current = session.current;
    session.current = null;
    if (current) void current.dispose();
  }, []);

  useEffect(() => {
    dispose();
    setState('idle');
    setPositionMs(0);
    setDurationMs(audio?.durationMs ?? 0);
    setError(null);
    return dispose;
  }, [audio?.uri, dispose]);

  const open = useCallback(async () => {
    if (!audio) throw new Error('No source audio was retained.');
    if (session.current) return session.current;
    const opened = await new ExpoAudioPlaybackAdapter().open(audio);
    unsubscribe.current = opened.subscribe((event) => {
      if (event.type === 'state') setState(event.state);
      if (event.type === 'position') {
        setPositionMs(event.positionMs);
        setDurationMs(event.durationMs);
      }
      if (event.type === 'error') setError(event.error);
    });
    session.current = opened;
    return opened;
  }, [audio]);

  const toggle = useCallback(async () => {
    try {
      setError(null);
      const opened = await open();
      if (state === 'playing') await opened.pause();
      else {
        if (state === 'ended') await opened.seek(0);
        await opened.play();
      }
    } catch (cause) {
      const normalized = normalizeError(cause, 'recording');
      setState('failed');
      setError(normalized);
    }
  }, [open, state]);

  const seek = useCallback(async (nextPositionMs: number) => {
    try {
      await (await open()).seek(nextPositionMs);
    } catch (cause) {
      setError(normalizeError(cause, 'recording'));
      setState('failed');
    }
  }, [open]);

  return { state, positionMs, durationMs, error, toggle, seek };
}
