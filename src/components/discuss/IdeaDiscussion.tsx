/**
 * @file IdeaDiscussion.tsx
 * @description Conversation workspace for asking questions and applying proposed report updates.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ArrowLeftIcon as ArrowLeft } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiscussionComposer } from "@/components/discuss/DiscussionComposer";
import { DiscussionMessage } from "@/components/discuss/DiscussionMessage";
import { DiscussionPromptChips } from "@/components/discuss/DiscussionPromptChips";
import { IdeaContextStrip } from "@/components/discuss/IdeaContextStrip";
import { ReportUpdateProposal } from "@/components/discuss/ReportUpdateProposal";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import type { ReportUpdateProposal as ReportUpdateProposalModel } from "@/features/domain/contracts";
import type { DiscussionThreadData } from "@/features/discussion/discussion-service";

const SCROLL_BOTTOM_THRESHOLD = 48;
export function IdeaDiscussion({
  applyProposal,
  composer,
  data,
  notice,
  onRetry,
  onSend,
  onSetComposer,
  sending,
}: {
  applyProposal(proposal: ReportUpdateProposalModel): Promise<boolean>;
  composer: string;
  data: DiscussionThreadData;
  notice: string | null;
  onRetry(assistantId: string, mode: "restart" | "resume"): void;
  onSend(): void;
  onSetComposer(value: string): void;
  sending: boolean;
}) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const lastMessage = data.messages.at(-1);
  const nearBottomRef = useRef(false);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const previousMessageCountRef = useRef(data.messages.length);
  const previousLastMessageIdRef = useRef(lastMessage?.id);
  const previousLastMessageContentRef = useRef(lastMessage?.content);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        reduceMotionRef.current = enabled;
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const isStreamingUpdate =
      data.messages.length === previousMessageCountRef.current &&
      lastMessage?.id === previousLastMessageIdRef.current &&
      lastMessage?.content !== previousLastMessageContentRef.current;
    const animated = !reduceMotionRef.current && !isStreamingUpdate;
    previousMessageCountRef.current = data.messages.length;
    previousLastMessageIdRef.current = lastMessage?.id;
    previousLastMessageContentRef.current = lastMessage?.content;
    const timer = setTimeout(() => {
      if (!nearBottomRef.current) return;
      scrollRef.current?.scrollToEnd({ animated });
    }, 60);
    return () => clearTimeout(timer);
  }, [
    data.messages.length,
    lastMessage?.content,
    lastMessage?.id,
    lastMessage?.status,
  ]);

  const title = data.capture.title?.trim() || "Untitled idea";
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to Discuss"
            accessibilityRole="button"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/discuss")
            }
            style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.ink} size={21} weight="bold" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text
              accessibilityLabel={title}
              accessibilityRole="header"
              numberOfLines={2}
              style={styles.title}
            >
              {title}
            </Text>
            <Text style={styles.saved}>Saved locally</Text>
          </View>
          <Pressable
            accessibilityLabel="View idea report"
            accessibilityRole="button"
            onPress={() => router.push(`/vault/${data.capture.id}`)}
            style={({ pressed }) => [
              styles.reportButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.reportText}>View idea</Text>
          </Pressable>
        </View>

        <IdeaContextStrip gist={data.report?.content.gist ?? null} />
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(_, height) => {
            const previousContentHeight = contentHeightRef.current;
            contentHeightRef.current = height;
            if (height <= viewportHeightRef.current + SCROLL_BOTTOM_THRESHOLD)
              nearBottomRef.current = true;
            else if (previousContentHeight === 0) nearBottomRef.current = false;
          }}
          onLayout={(event) => {
            viewportHeightRef.current = event.nativeEvent.layout.height;
            if (
              contentHeightRef.current > 0 &&
              contentHeightRef.current <=
                viewportHeightRef.current + SCROLL_BOTTOM_THRESHOLD
            )
              nearBottomRef.current = true;
          }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            nearBottomRef.current =
              contentSize.height -
                (contentOffset.y + layoutMeasurement.height) <=
              SCROLL_BOTTOM_THRESHOLD;
          }}
          ref={scrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {data.messages.length ? (
            data.messages.map((message) => (
              <View key={message.id} style={styles.messageGroup}>
                <DiscussionMessage
                  message={message}
                  onEdit={message.role === "user" ? onSetComposer : undefined}
                  onRetry={
                    message.role === "assistant" &&
                    (message.id === lastMessage?.id ||
                      message.status === "failed" ||
                      message.status === "interrupted")
                      ? (mode) => onRetry(message.id, mode)
                      : undefined
                  }
                />
                {message.role === "assistant" &&
                message.reportUpdateProposal ? (
                  <ReportUpdateProposal
                    canApply={
                      data.report?.revision ===
                      message.reportUpdateProposal.baseRevision
                    }
                    onApply={applyProposal}
                    proposal={message.reportUpdateProposal}
                  />
                ) : null}
              </View>
            ))
          ) : (
            <ConversationEmpty />
          )}
        </ScrollView>

        {!data.messages.length ? (
          <DiscussionPromptChips disabled={sending} onChoose={onSetComposer} />
        ) : null}
        <DiscussionComposer
          availability={data.availability}
          onChange={onSetComposer}
          onSend={onSend}
          sending={sending}
          value={composer}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function ConversationEmpty() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Start with what feels uncertain.</Text>
      <Text style={styles.emptyBody}>
        Ask a question or choose a direction below. Your messages stay on this
        device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  keyboard: { flex: 1 },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  circle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: colors.canvas,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 16,
  },
  saved: {
    marginTop: 2,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 10,
  },
  reportButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  reportText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 11,
  },
  notice: {
    marginHorizontal: 20,
    marginTop: 10,
    color: colors.inkSecondary,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  messages: {
    flexGrow: 1,
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  messageGroup: { gap: 14 },
  empty: {
    padding: 20,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 18,
  },
  emptyBody: {
    marginTop: 6,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: { opacity: 0.65 },
});
