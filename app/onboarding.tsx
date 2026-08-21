import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Eye,
  EyeSlash,
  Key,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchableModelPicker } from '@/components/onboarding/SearchableModelPicker';
import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';
import { aiModelsByProvider, speechModelsByProvider } from '@/features/onboarding/model-options';
import { readProfile, saveProfile } from '@/features/onboarding/storage';

const TOTAL_STEPS = 4;
const speechProviders = ['Deepgram', 'Groq'] as const;
const aiProviders = ['OpenRouter', 'Groq', 'OpenAI'] as const;

type Notice = { title: string; body: string } | null;

const illustrations = [
  require('@/assets/Onboarding/Onboarding-1.png'),
  require('@/assets/Onboarding/Onboarding-2.png'),
  require('@/assets/Onboarding/Onboarding-3.png'),
  require('@/assets/Onboarding/Onboarding-4.png'),
] as const;

function IllustrationSpace({ compact, step }: { compact: boolean; step: number }) {
  return (
    <View style={[styles.illustrationSpace, compact && styles.illustrationSpaceCompact]}>
      <Image accessibilityLabel={`Onboarding illustration ${step + 1}`} resizeMode="contain" source={illustrations[step]} style={styles.illustration} />
    </View>
  );
}

function ChoiceRow({ options, value, onChange }: { options: readonly string[]; value: string; onChange(value: string): void }) {
  return (
    <ScrollView contentContainerStyle={styles.choices} horizontal showsHorizontalScrollIndicator={false}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option}
            onPress={() => onChange(option)}
            style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option}</Text>
            {selected ? <Check color={colors.ink} size={14} weight="bold" /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SecretField({ attempted, label, placeholder, value, onChangeText }: {
  attempted: boolean; label: string; placeholder: string; value: string; onChangeText(value: string): void;
}) {
  const [visible, setVisible] = useState(false);
  const complete = Boolean(value.trim());
  const error = attempted && !complete;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, complete && styles.inputComplete, error && styles.inputError]}>
        <Key color={complete ? colors.calm : colors.darkMuted} size={18} weight="bold" />
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.darkMuted}
          secureTextEntry={!visible}
          style={styles.input}
          value={value}
        />
        <Pressable accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`} hitSlop={10} onPress={() => setVisible((current) => !current)}>
          {visible ? <EyeSlash color={colors.darkMuted} size={19} /> : <Eye color={colors.darkMuted} size={19} />}
        </Pressable>
      </View>
      {complete ? (
        <View style={styles.fieldStatus}><CheckCircle color={colors.calm} size={15} weight="fill" /><Text style={styles.statusComplete}>Key added</Text></View>
      ) : error ? (
        <View style={styles.fieldStatus}><WarningCircle color={colors.danger} size={15} weight="fill" /><Text style={styles.statusError}>API key is required</Text></View>
      ) : null}
    </View>
  );
}

function AppNotice({ notice, onClose }: { notice: Notice; onClose(): void }) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(notice)}>
      <View style={styles.modalBackdrop}>
        <View accessibilityRole="alert" style={styles.modalCard}>
          <View style={styles.modalIcon}><WarningCircle color={colors.ink} size={25} weight="bold" /></View>
          <Pressable accessibilityLabel="Close message" hitSlop={12} onPress={onClose} style={styles.modalClose}><X color={colors.inkMuted} size={20} weight="bold" /></Pressable>
          <Text style={styles.modalTitle}>{notice?.title}</Text>
          <Text style={styles.modalBody}>{notice?.body}</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.modalButton, pressed && styles.pressed]}><Text style={styles.modalButtonText}>Try again</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [speechProvider, setSpeechProvider] = useState('Deepgram');
  const [speechModel, setSpeechModel] = useState('nova-3');
  const [speechKey, setSpeechKey] = useState('');
  const [aiProvider, setAiProvider] = useState('OpenRouter');
  const [aiModel, setAiModel] = useState('google/gemini-2.5-flash');
  const [aiKey, setAiKey] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    void readProfile().then((profile) => {
      if (!profile) return;
      setName(profile.name);
      setSpeechProvider(profile.speechProvider);
      setSpeechModel(profile.speechModel);
      setSpeechKey(profile.speechKey);
      setAiProvider(profile.aiProvider);
      setAiModel(profile.aiModel);
      setAiKey(profile.aiKey);
    });
  }, []);

  const stepComplete = step === 0 ? Boolean(name.trim()) : step === 1 ? Boolean(speechKey.trim()) : step === 2 ? Boolean(aiKey.trim()) : true;

  const moveTo = (nextStep: number) => {
    setAttempted(false);
    setStep(nextStep);
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
  };

  const next = () => {
    if (!stepComplete) return setAttempted(true);
    moveTo(Math.min(step + 1, TOTAL_STEPS - 1));
  };

  const finish = async () => {
    setSaving(true);
    try {
      await saveProfile({ name: name.trim(), speechProvider, speechModel, speechKey: speechKey.trim(), aiProvider, aiModel, aiKey: aiKey.trim() });
      router.replace('/');
    } catch {
      setNotice({ title: 'Couldn’t save securely', body: 'Nothing was lost. Check your device storage and try again.' });
      setSaving(false);
    }
  };

  const headings = [
    ['WELCOME TO HMMMIDEA', 'What should we call you?', 'This name is only used for your greeting.'],
    ['SPEECH TO TEXT', 'Turn your voice into words.', 'Choose the speech setup used when an idea is recorded.'],
    ['IDEA INTELLIGENCE', 'Choose how ideas are shaped.', 'Configure the LLM used for reports, research, and discussion.'],
    ['ONE LAST LOOK', `Ready, ${name.trim()}.`, 'Review the local setup before opening your idea vault.'],
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={styles.keyboard}>
        <View style={styles.topBar}>
          <Text style={styles.stepCount}>{step + 1} OF {TOTAL_STEPS}</Text>
          <View style={styles.progressTrack}><View style={[styles.progress, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} /></View>
        </View>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          <IllustrationSpace compact={compact} step={step} />
          <View style={styles.copy}>
            <Text style={styles.kicker}>{headings[step][0]}</Text>
            <Text accessibilityRole="header" style={styles.heading}>{headings[step][1]}</Text>
            <Text style={styles.body}>{headings[step][2]}</Text>
          </View>

          {step === 0 ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>YOUR NAME</Text>
              <View style={[styles.inputShell, Boolean(name.trim()) && styles.inputComplete, attempted && !name.trim() && styles.inputError]}>
                <TextInput
                  autoCapitalize="words"
                  autoFocus
                  onChangeText={setName}
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180)}
                  onSubmitEditing={next}
                  placeholder="Your name"
                  placeholderTextColor={colors.darkMuted}
                  returnKeyType="next"
                  style={styles.input}
                  value={name}
                />
              </View>
              {attempted && !name.trim() ? <View style={styles.fieldStatus}><WarningCircle color={colors.danger} size={15} weight="fill" /><Text style={styles.statusError}>Name is required</Text></View> : null}
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.setup}>
              <View style={styles.optionGroup}><Text style={styles.fieldLabel}>PROVIDER</Text><ChoiceRow onChange={(provider) => { setSpeechProvider(provider); setSpeechModel(speechModelsByProvider[provider][0]); }} options={speechProviders} value={speechProvider} /></View>
              <SearchableModelPicker label="MODEL" onChange={setSpeechModel} options={speechModelsByProvider[speechProvider]} value={speechModel} />
              <SecretField attempted={attempted} label="SPEECH API KEY" onChangeText={setSpeechKey} placeholder="Paste speech API key" value={speechKey} />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.setup}>
              <View style={styles.optionGroup}><Text style={styles.fieldLabel}>PROVIDER</Text><ChoiceRow onChange={(provider) => { setAiProvider(provider); setAiModel(aiModelsByProvider[provider][0]); }} options={aiProviders} value={aiProvider} /></View>
              <SearchableModelPicker label="MODEL" onChange={setAiModel} options={aiModelsByProvider[aiProvider]} value={aiModel} />
              <SecretField attempted={attempted} label="LLM API KEY" onChangeText={setAiKey} placeholder="Paste LLM API key" value={aiKey} />
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>NAME</Text><Text style={styles.summaryValue}>{name.trim()}</Text></View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>SPEECH</Text><Text style={styles.summaryValue}>{speechProvider} · {speechModel}</Text></View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>LLM</Text><Text style={styles.summaryValue}>{aiProvider} · {aiModel}</Text></View>
              <View style={styles.secureNote}><Key color={colors.ink} size={17} weight="bold" /><Text style={styles.secureText}>Both keys will be stored in protected device storage.</Text></View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? <Pressable accessibilityLabel="Previous step" onPress={() => moveTo(step - 1)} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><ArrowLeft color={colors.inkInverse} size={20} weight="bold" /></Pressable> : null}
          <Pressable disabled={saving} onPress={step === TOTAL_STEPS - 1 ? () => void finish() : next} style={({ pressed }) => [styles.next, pressed && styles.pressed, saving && styles.disabled]}>
            <View style={styles.nextCopy}>
              <Text style={styles.nextLabel}>{saving ? 'Saving securely' : step === TOTAL_STEPS - 1 ? 'Start capturing' : 'Continue'}</Text>
              <Text style={styles.nextHint}>{stepComplete ? step === TOTAL_STEPS - 1 ? 'Everything looks good' : 'Go to the next step' : 'Complete this step first'}</Text>
            </View>
            {saving ? <ActivityIndicator color={colors.ink} size="small" /> : step === TOTAL_STEPS - 1 ? <Check color={colors.ink} size={20} weight="bold" /> : <ArrowRight color={colors.ink} size={20} weight="bold" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <AppNotice notice={notice} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.darkCanvas }, keyboard: { flex: 1 },
  topBar: { gap: 8, paddingHorizontal: spacing.page, paddingTop: 8 },
  stepCount: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1.2, textAlign: 'right' },
  progressTrack: { height: 3, overflow: 'hidden', borderRadius: radii.pill, backgroundColor: colors.darkLine },
  progress: { height: 3, borderRadius: radii.pill, backgroundColor: colors.primary },
  content: { flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: 10, paddingBottom: 28 },
  illustrationSpace: { height: 210, overflow: 'hidden', borderRadius: radii.large, backgroundColor: colors.canvasSoft },
  illustrationSpaceCompact: { height: 150 },
  illustration: { width: '100%', height: '100%' },
  copy: { marginTop: 4 }, kicker: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 10, letterSpacing: 1.3 },
  heading: { maxWidth: 350, marginTop: 8, color: colors.inkInverse, fontFamily: onboardingFonts.displayBold, fontSize: 31, lineHeight: 36 },
  body: { maxWidth: 350, marginTop: 9, color: colors.darkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  setup: { gap: 20, marginTop: 24 }, optionGroup: { gap: 9 },
  fieldGroup: { gap: 9, marginTop: 24 }, fieldLabel: { color: colors.darkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 10, letterSpacing: 1.1 },
  inputShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.darkLine, borderRadius: radii.medium, backgroundColor: colors.darkSurface },
  inputComplete: { borderColor: colors.calm }, inputError: { borderColor: colors.danger }, input: { flex: 1, color: colors.inkInverse, fontFamily: onboardingFonts.bodyRegular, fontSize: 15 },
  fieldStatus: { minHeight: 17, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5 },
  statusComplete: { color: colors.calm, fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 }, statusError: { color: colors.danger, fontFamily: onboardingFonts.bodySemiBold, fontSize: 10 },
  choices: { gap: 8 }, choice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.darkLine, borderRadius: radii.pill, backgroundColor: colors.darkSurface },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary }, choiceText: { maxWidth: 230, color: colors.inkInverse, fontFamily: onboardingFonts.bodySemiBold, fontSize: 12 }, choiceTextSelected: { color: colors.ink },
  summaryCard: { gap: 15, marginTop: 26, padding: 19, borderRadius: radii.large, backgroundColor: colors.canvasSoft },
  summaryRow: { gap: 5 }, summaryLabel: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyBold, fontSize: 9, letterSpacing: 1 }, summaryValue: { color: colors.ink, fontFamily: onboardingFonts.bodySemiBold, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.line }, secureNote: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4, padding: 12, borderRadius: radii.medium, backgroundColor: colors.calmSoft }, secureText: { flex: 1, color: colors.ink, fontFamily: onboardingFonts.bodyMedium, fontSize: 11, lineHeight: 16 },
  footer: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.page, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.darkLine, backgroundColor: colors.darkCanvas },
  back: { width: 56, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: radii.medium, backgroundColor: colors.darkSurface },
  next: { minHeight: 60, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 19, borderRadius: radii.medium, backgroundColor: colors.primary },
  nextCopy: { flex: 1, gap: 2 }, nextLabel: { color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 16 }, nextHint: { color: colors.inkMuted, fontFamily: onboardingFonts.bodyMedium, fontSize: 10 },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.55 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.68)' },
  modalCard: { width: '100%', maxWidth: 380, padding: 22, borderRadius: radii.large, backgroundColor: colors.canvas },
  modalIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.dangerSoft }, modalClose: { position: 'absolute', top: 20, right: 20 },
  modalTitle: { marginTop: 20, color: colors.ink, fontFamily: onboardingFonts.displayBold, fontSize: 23 }, modalBody: { marginTop: 8, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  modalButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24, borderRadius: radii.medium, backgroundColor: colors.ink }, modalButtonText: { color: colors.inkInverse, fontFamily: onboardingFonts.displaySemiBold, fontSize: 14 },
});
