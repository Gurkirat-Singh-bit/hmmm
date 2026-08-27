import { useCallback, useEffect, useState } from 'react';

import type { CaptureRecord, NormalizedError, ReportRecord, ReportRevision, SourceRecord } from '@/features/domain/contracts';
import { normalizeError } from '@/features/domain/errors';

import { getVaultDatabase } from './vault-runtime';

export type IdeaDetailState = Readonly<{
  loading: boolean;
  data: Readonly<{
    capture: CaptureRecord;
    report: ReportRecord | null;
    revisions: readonly ReportRecord[];
    sources: readonly SourceRecord[];
    isProvisional: boolean;
  }> | null;
  error: NormalizedError | null;
}>;

export function useIdeaDetail(captureId: string | undefined, selectedRevision: ReportRevision | null) {
  const [state, setState] = useState<IdeaDetailState>({ loading: true, data: null, error: null });
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    if (!captureId) {
      setState({ loading: false, data: null, error: null });
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | null = null;
    const load = async () => {
      try {
        const database = await getVaultDatabase();
        const capture = await database.repositories.captures.get(captureId);
        if (!capture) {
          if (active) setState({ loading: false, data: null, error: null });
          return;
        }
        const [activeReport, provisional, revisions] = await Promise.all([
          database.repositories.reports.getActive(captureId),
          database.repositories.reports.getLatestProvisional(captureId),
          database.repositories.reports.listRevisions(captureId),
        ]);
        const report = selectedRevision === null
          ? activeReport ?? provisional
          : await database.repositories.reports.get(captureId, selectedRevision);
        const sources = report ? await database.repositories.reports.listSources(captureId, report.revision) : [];
        if (active) setState({
          loading: false,
          data: { capture, report, revisions, sources, isProvisional: report?.phase === 'provisional' },
          error: null,
        });
      } catch (error) {
        if (active) setState({ loading: false, data: null, error: normalizeError(error, 'database') });
      }
    };
    void getVaultDatabase().then((database) => {
      if (!active) return;
      unsubscribe = database.subscriptions.subscribe((change) => {
        if (change.table === 'captures' || change.table === 'reports' || change.table === 'sources') void load();
      });
      void load();
    }).catch((error) => {
      if (active) setState({ loading: false, data: null, error: normalizeError(error, 'database') });
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [captureId, refreshToken, selectedRevision]);

  return { ...state, refresh };
}
