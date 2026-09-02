/**
 * @file discussion-prompts.ts
 * @description Local-only prompt suggestions shown above the discussion composer.
 * @author Gurkirat Singh
 * @license MIT
 */

/** Starter prompts are local-only composer helpers. */
export const discussionPromptSuggestions = [
  {
    id: "challenge",
    label: "Challenge it",
    prompt: "What is the weakest assumption in this idea?",
  },
  {
    id: "narrow",
    label: "Narrow the scope",
    prompt: "Help me make this idea smaller and more testable.",
  },
  {
    id: "advance",
    label: "Find the next move",
    prompt: "What is the most useful next step I can take today?",
  },
] as const;
