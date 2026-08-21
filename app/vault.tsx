import { AppScreen } from '@/components/AppScreen';
import { EmptyPanel } from '@/components/EmptyPanel';

export default function VaultScreen() {
  return <AppScreen eyebrow="VAULT" title="Every idea, kept close." supporting="Search, sort, and return to the thoughts worth keeping."><EmptyPanel title="Your vault is quiet." body="Recorded ideas will collect here." /></AppScreen>;
}
