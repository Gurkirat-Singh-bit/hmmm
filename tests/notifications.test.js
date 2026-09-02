/**
 * @file notifications.test.js
 * @description Verifies generic notification copy, preference filtering, and safe deep-link data parsing.
 * @author Gurkirat Singh
 * @license MIT
 */

import { describe, expect, test } from "bun:test";

import {
  notificationCaptureId,
  notificationCopy,
  notificationIsEnabled,
} from "../src/features/notifications/config";

describe("notification configuration", () => {
  test("never puts captured idea content in notification copy", () => {
    const complete = notificationCopy({
      type: "processing-complete",
      captureId: "private-idea",
    });
    const failed = notificationCopy({
      type: "processing-failed",
      captureId: "private-idea",
    });
    expect(JSON.stringify([complete, failed])).not.toContain("private-idea");
  });

  test("applies master and category preferences", () => {
    expect(
      notificationIsEnabled("processing-complete", {
        enabled: true,
        reportReady: true,
        processingFailed: false,
      }),
    ).toBe(true);
    expect(
      notificationIsEnabled("processing-failed", {
        enabled: true,
        reportReady: true,
        processingFailed: false,
      }),
    ).toBe(false);
    expect(
      notificationIsEnabled("processing-complete", {
        enabled: false,
        reportReady: true,
        processingFailed: true,
      }),
    ).toBe(false);
  });

  test("accepts only a non-empty string capture id for routing", () => {
    expect(notificationCaptureId({ captureId: "capture-1" })).toBe("capture-1");
    expect(notificationCaptureId({ captureId: "" })).toBeNull();
    expect(notificationCaptureId({ captureId: 42 })).toBeNull();
  });
});
