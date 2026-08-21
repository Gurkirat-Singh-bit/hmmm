import { AppScreen } from '@/components/AppScreen';
import { EmptyPanel } from '@/components/EmptyPanel';

export default function DiscussScreen() {
  return <AppScreen eyebrow="DISCUSS" title="Think against the idea." supporting="Question an idea, test its weak points, or find the next move."><EmptyPanel title="No threads yet." body="Capture an idea first, then start a discussion here." /></AppScreen>;
}
