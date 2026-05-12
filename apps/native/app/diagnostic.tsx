import { getSituationSeed } from '@it-advisory/diagnostic-core/situation-options';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { ProgressBar } from '../src/components/progress-bar';
import { useDiagnosticFlow } from '../src/providers/diagnostic-flow-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

const SITUATION_SEEDS = getSituationSeed();

/**
 * Guided diagnostic screen for the native public intake flow.
 */
export default function DiagnosticScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const {
    canGoBack,
    errorMessage,
    executeAdvance,
    executeFinalizeDiagnostic,
    executeGoBack,
    executeReset,
    executeSelectOption,
    executeStartDiagnostic,
    executeUpdateAnswerNote,
    executeUpdatePrompt,
    executeUsePromptSeed,
    guided,
    isBusy,
    isHydrated,
    progressHint,
    progressPercent,
  } = useDiagnosticFlow();
  const hasProgress =
    guided.initialPrompt.trim().length > 0 || guided.activeRound !== null || guided.completedBundles.length > 0 || guided.outcome !== null;
  const activeRound = guided.activeRound;
  const currentQuestion = activeRound?.questions[activeRound.stepIndex];
  const currentOptions = currentQuestion?.options ?? [];
  const footer = (
    <View style={styles.footerGroup}>
      {guided.outcome !== null ? (
        <AppButton
          disabled={isBusy}
          onPress={() => {
            void executeFinalizeDiagnostic().then(() => router.push('/recommendation')).catch(() => {});
          }}
        >
          See recommendation
        </AppButton>
      ) : activeRound !== null ? (
        <AppButton disabled={isBusy} onPress={() => void executeAdvance()}>
          {activeRound.stepIndex >= activeRound.questions.length - 1 ? 'Submit round' : 'Next question'}
        </AppButton>
      ) : (
        <AppButton disabled={isBusy || !isHydrated} onPress={() => void executeStartDiagnostic()}>
          Start diagnostic
        </AppButton>
      )}
      {canGoBack ? (
        <AppButton disabled={isBusy} onPress={executeGoBack} variant="secondary">
          Back
        </AppButton>
      ) : null}
      {hasProgress ? (
        <AppButton disabled={isBusy} onPress={() => void executeReset()} variant="ghost">
          Start over
        </AppButton>
      ) : null}
    </View>
  );

  return (
    <AppScreen
      title="Guided diagnostic"
      subtitle="Move from confusion to a clear next step with short, structured prompts."
      footer={footer}
    >
      <AppCard>
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, { color: theme.textMuted }]}>{progressHint}</Text>
          <Text style={[styles.progressLabel, { color: theme.textMuted }]}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBarWrap}>
          <ProgressBar value={progressPercent} />
        </View>
      </AppCard>
      {!isHydrated ? (
        <AppCard>
          <Text style={[styles.helperText, { color: theme.textMuted }]}>Loading your saved diagnostic progress...</Text>
        </AppCard>
      ) : null}
      {errorMessage !== null ? (
        <AppCard>
          <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text>
        </AppCard>
      ) : null}
      {guided.outcome === null && activeRound === null ? (
        <AppCard>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>What is going on right now?</Text>
          <Text style={[styles.helperText, { color: theme.textMuted }]}>
            Describe the business or delivery problem in a few lines. You can tap suggested phrases below.
          </Text>
          <TextInput
            accessibilityLabel="Diagnostic prompt"
            multiline
            onChangeText={executeUpdatePrompt}
            placeholder="Example: Our ERP rollout is delayed, requirements keep shifting, and leadership needs an independent view."
            placeholderTextColor={theme.textSoft}
            style={[
              styles.textArea,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            textAlignVertical="top"
            value={guided.initialPrompt}
          />
          <View style={styles.seedWrap}>
            {SITUATION_SEEDS.map((phrase) => {
              const isActive = guided.initialPrompt.toLowerCase().includes(phrase.toLowerCase());
              return (
                <Pressable
                  key={phrase}
                  accessibilityRole="button"
                  onPress={() => executeUsePromptSeed(phrase)}
                  style={({ pressed }) => [
                    styles.seedChip,
                    {
                      backgroundColor: isActive ? theme.primarySoft : theme.surfaceMuted,
                      borderColor: isActive ? theme.primary : theme.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.seedChipText, { color: isActive ? theme.primary : theme.text }]}>{phrase}</Text>
                </Pressable>
              );
            })}
          </View>
        </AppCard>
      ) : null}
      {activeRound !== null && currentQuestion !== undefined ? (
        <AppCard>
          {activeRound.guidance !== null ? (
            <Text style={[styles.guidanceText, { color: theme.primary }]}>{activeRound.guidance}</Text>
          ) : null}
          <Text style={[styles.questionCounter, { color: theme.textMuted }]}>
            Question {activeRound.stepIndex + 1} of {activeRound.questions.length}
          </Text>
          <Text style={[styles.questionTitle, { color: theme.text }]}>{currentQuestion.prompt}</Text>
          <View style={styles.optionGroup}>
            {currentOptions.length > 0 ? (
              currentOptions.map((option) => {
                const isSelected = activeRound.answers[currentQuestion.id] === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => executeSelectOption(currentQuestion.id, option)}
                    style={({ pressed }) => [
                      styles.optionButton,
                      {
                        backgroundColor: isSelected ? theme.primarySoft : theme.surfaceMuted,
                        borderColor: isSelected ? theme.primary : theme.border,
                        opacity: pressed ? 0.94 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{option}</Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={[styles.helperText, { color: theme.textMuted }]}>
                We could not load the answer options for this step. Tap Start over to request a fresh round.
              </Text>
            )}
          </View>
          <TextInput
            accessibilityLabel="Optional detail"
            multiline
            onChangeText={(value) => executeUpdateAnswerNote(currentQuestion.id, value)}
            placeholder="Optional detail if the selected option needs more context"
            placeholderTextColor={theme.textSoft}
            style={[
              styles.noteInput,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            textAlignVertical="top"
            value={activeRound.answerNotes[currentQuestion.id] ?? ''}
          />
        </AppCard>
      ) : null}
      {guided.outcome !== null ? (
        <AppCard>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>We have enough signal to guide you.</Text>
          <View style={[styles.summaryBadge, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.summaryBadgeText, { color: theme.primary }]}>{guided.outcome.mappedSituation}</Text>
          </View>
          <Text style={[styles.summaryText, { color: theme.textMuted }]}>{guided.outcome.advisorSummary}</Text>
        </AppCard>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footerGroup: {
    gap: 12,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarWrap: {
    marginTop: 12,
  },
  helperText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  textArea: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    minHeight: 150,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  seedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  seedChip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  seedChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  guidanceText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  questionCounter: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  questionTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 10,
  },
  optionGroup: {
    gap: 12,
    marginTop: 18,
  },
  optionButton: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  noteInput: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
    minHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 16,
  },
});
