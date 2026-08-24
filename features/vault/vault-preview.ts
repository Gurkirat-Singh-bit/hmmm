/**
 * @file vault-preview.ts
 * @description Preview idea records used while the local Vault repository is being implemented.
 * @author Gurkirat Singh
 * @license MIT
 */

export type VaultFilter = 'latest' | 'starred';
export type VaultStatusFilter = 'all' | 'ready' | 'processing';
export type VaultIdea = { id: string; title: string; summary: string; status: 'ready' | 'processing'; starred: boolean; accent: 'cyan' | 'mint' | 'pink' };

export const previewVaultIdeas: readonly VaultIdea[] = [
  { id: 'morning-capture', title: 'A calmer morning capture flow', summary: 'Reduce friction between waking up and saving the first useful thought.', status: 'ready', starred: true, accent: 'mint' },
  { id: 'research-tabs', title: 'Organize research without tabs', summary: 'Group source trails around the question instead of the browser session.', status: 'ready', starred: false, accent: 'cyan' },
  { id: 'voice-revisit', title: 'Make voice notes easier to revisit', summary: 'Surface the original wording beside a concise structured report.', status: 'processing', starred: false, accent: 'pink' },
  { id: 'weekly-review', title: 'A weekly idea review ritual', summary: 'Bring unfinished thoughts back at the right time without creating noise.', status: 'ready', starred: true, accent: 'mint' },
];

export type IdeaReport = { gist: string; evidence: readonly string[]; risks: readonly string[]; nextMove: string; originalWords: string };

export const previewIdeaReports: Record<string, IdeaReport> = {
  'morning-capture': { gist: 'A one-tap morning mode could preserve early ideas before notifications and routine take over.', evidence: ['Capture friction is highest when the user is not fully awake.', 'A focused entry point removes decisions before recording.'], risks: ['A separate mode may add complexity if it behaves differently from normal capture.'], nextMove: 'Prototype a single morning shortcut that opens directly into recording.', originalWords: 'I want a calmer way to catch the first idea in the morning without opening a bunch of screens.' },
  'research-tabs': { gist: 'Research should be organized around questions and evidence instead of temporary browser tabs.', evidence: ['Tabs describe browsing order, not the purpose of the research.', 'Question-based groups make sources easier to revisit.'], risks: ['Automatic grouping could hide useful context if classification is inaccurate.'], nextMove: 'Test one question card that collects links, notes, and a short conclusion.', originalWords: 'What if research did not become fifty tabs and instead stayed attached to the question I was trying to answer?' },
  'voice-revisit': { gist: 'Voice captures become more trustworthy when the original wording remains visible beside the structured report.', evidence: ['Summaries can remove tone and small details.', 'The original transcript provides a clear source of truth.'], risks: ['Long transcripts need progressive disclosure to avoid overwhelming the report.'], nextMove: 'Place a collapsed Original words section at the end of every report.', originalWords: 'The structured version is useful, but I still want to hear or read exactly what I said when the thought happened.' },
  'weekly-review': { gist: 'A quiet weekly review can return unfinished ideas without turning the Vault into another task manager.', evidence: ['Ideas often become useful after distance and reflection.', 'A bounded weekly review avoids constant reminders.'], risks: ['Poor ranking could repeatedly surface low-value ideas.'], nextMove: 'Create a review containing no more than five unfinished ideas.', originalWords: 'Once a week, show me the few ideas that still have energy instead of reminding me about everything.' },
};
