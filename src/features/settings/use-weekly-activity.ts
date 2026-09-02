/**
 * @file use-weekly-activity.ts
 * @description Builds the recent capture activity series shown in Settings.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useEffect, useState } from "react";

import { getVaultDatabase } from "@/features/vault/vault-runtime";

import type { DailyActivity } from "@/components/settings/WeeklyActivityChart";
function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}
function shortDay(value: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(value);
}
function emptyWeek() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - offset));
    return { day: shortDay(date), value: 0, key: dayKey(date) };
  });
}
export function useWeeklyActivity() {
  const [activity, setActivity] = useState<readonly DailyActivity[]>(() =>
    emptyWeek().map(({ day, value }) => ({ day, value })),
  );

  useEffect(() => {
    let live = true;
    let cleanup: (() => void) | undefined;
    const refresh = async () => {
      const database = await getVaultDatabase();
      const days = emptyWeek();
      const counts = new Map(days.map((day) => [day.key, 0]));
      const captures = await database.repositories.captures.list({
        search: "",
        starred: null,
        statuses: [],
        sort: "newest",
        limit: null,
        offset: 0,
      });
      for (const capture of captures) {
        const key = dayKey(new Date(capture.createdAt));
        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      if (live)
        setActivity(
          days.map(({ day, key }) => ({ day, value: counts.get(key) ?? 0 })),
        );
    };
    void refresh().catch(() => undefined);
    void getVaultDatabase()
      .then((database) => {
        const unsubscribe = database.subscriptions.subscribe((change) => {
          if (change.table === "captures")
            void refresh().catch(() => undefined);
        });
        if (!live) unsubscribe();
        else cleanup = unsubscribe;
      })
      .catch(() => undefined);
    return () => {
      live = false;
      cleanup?.();
    };
  }, []);

  return activity;
}
