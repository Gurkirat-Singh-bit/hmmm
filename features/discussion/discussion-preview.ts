/**
 * @file discussion-preview.ts
 * @description Typed preview conversations used before local discussion persistence is implemented.
 * @author Gurkirat Singh
 * @license MIT
 */

export type DiscussionAvailability = 'ready' | 'offline' | 'missing-provider';
export type DiscussionMessageRole = 'assistant' | 'user';
export type DiscussionMessageStatus = 'sent' | 'sending' | 'interrupted';

export type DiscussionMessage = {
  id: string;
  role: DiscussionMessageRole;
  content: string;
  time: string;
  status: DiscussionMessageStatus;
};

export type DiscussionThreadSummary = {
  ideaId: string;
  lastMessage: string;
  time: string;
  messageCount: number;
};

export type ReportUpdateProposal = {
  section: 'Next move';
  current: string;
  proposed: string;
};

export type DiscussionThreadPreview = {
  ideaId: string;
  availability: DiscussionAvailability;
  messages: readonly DiscussionMessage[];
  updateProposal?: ReportUpdateProposal;
};

export const discussionPromptSuggestions = [
  { id: 'challenge', label: 'Challenge it', prompt: 'What is the weakest assumption in this idea?' },
  { id: 'narrow', label: 'Narrow the scope', prompt: 'Help me make this idea smaller and more testable.' },
  { id: 'advance', label: 'Find the next move', prompt: 'What is the most useful next step I can take today?' },
] as const;

export const previewThreadSummaries: readonly DiscussionThreadSummary[] = [
  {
    ideaId: 'morning-capture',
    lastMessage: 'The shortcut matters less than removing the first decision.',
    time: '12 min',
    messageCount: 6,
  },
  {
    ideaId: 'research-tabs',
    lastMessage: 'Could the question itself become the container?',
    time: 'Yesterday',
    messageCount: 3,
  },
];

export const previewDiscussionThreads: Record<string, DiscussionThreadPreview> = {
  'morning-capture': {
    ideaId: 'morning-capture',
    availability: 'ready',
    messages: [
      {
        id: 'morning-assistant-1',
        role: 'assistant',
        content: 'The promising part is not a separate morning mode. It is removing every decision between opening the app and speaking.',
        time: '9:41 AM',
        status: 'sent',
      },
      {
        id: 'morning-user-1',
        role: 'user',
        content: 'So should the shortcut start recording immediately?',
        time: '9:42 AM',
        status: 'sent',
      },
      {
        id: 'morning-assistant-2',
        role: 'assistant',
        content: 'Only if there is a clear cancel path. A safer first test is opening directly to the recorder with one large action already in focus.',
        time: '9:42 AM',
        status: 'sent',
      },
      {
        id: 'morning-user-2',
        role: 'user',
        content: 'Turn that into a smaller experiment for this week.',
        time: '9:44 AM',
        status: 'sent',
      },
      {
        id: 'morning-assistant-interrupted',
        role: 'assistant',
        content: 'The response stopped before it was complete.',
        time: '9:44 AM',
        status: 'interrupted',
      },
    ],
    updateProposal: {
      section: 'Next move',
      current: 'Prototype a single morning shortcut that opens directly into recording.',
      proposed: 'For seven mornings, test a shortcut that opens directly to one focused record action. Track whether the first idea is saved within 30 seconds.',
    },
  },
  'research-tabs': {
    ideaId: 'research-tabs',
    availability: 'offline',
    messages: [
      {
        id: 'research-assistant-1',
        role: 'assistant',
        content: 'A question is a stronger container than a browser session because it survives after the tabs are closed.',
        time: 'Yesterday',
        status: 'sent',
      },
      {
        id: 'research-user-1',
        role: 'user',
        content: 'Could the question itself become the container?',
        time: 'Yesterday',
        status: 'sent',
      },
    ],
  },
  'weekly-review': {
    ideaId: 'weekly-review',
    availability: 'missing-provider',
    messages: [],
  },
};

export function getDiscussionThread(ideaId: string): DiscussionThreadPreview {
  return previewDiscussionThreads[ideaId] ?? {
    ideaId,
    availability: 'ready',
    messages: [],
  };
}
