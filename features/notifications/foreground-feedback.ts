import type { NotificationEvent } from '@/features/domain/contracts';

export type ForegroundFeedback = Readonly<{
  message: string;
  occurredAt: string;
}>;

const listeners = new Set<(feedback: ForegroundFeedback) => void>();

export function publishForegroundFeedback(event: NotificationEvent) {
  const feedback = {
    message: event.type === 'processing-complete' ? 'Background processing finished.' : 'Background processing needs attention.',
    occurredAt: new Date().toISOString(),
  } satisfies ForegroundFeedback;
  for (const listener of listeners) listener(feedback);
}

/** In-app feedback deliberately contains no capture title, transcript, or source audio detail. */
export function subscribeToForegroundFeedback(listener: (feedback: ForegroundFeedback) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
