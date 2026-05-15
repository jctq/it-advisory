import {
  buildDiagnosticAnswerLookup,
  createEmptyDiagnosticQuestionSelection,
  getVisibleQuestionIndexes,
  getVisibleQuestionOptions,
  shouldShowQuestionDetailNoteInput,
  type DiagnosticQuestionBlock,
  type DiagnosticQuestionOption,
  type DiagnosticQuestionSelection,
} from '@techmd/diagnostic-core/guided-diagnostic-types';
import {
  resolveProjectRescueBriefAssessment,
  resolveProjectRescueGoodFitBullets,
  resolveProjectRescueSessionTitle,
} from '@techmd/diagnostic-core/project-rescue-service-context';
import { getSituationSeed } from '@techmd/diagnostic-core/situation-options';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '../src/components/themed-text';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { ProgressBar } from '../src/components/progress-bar';
import { useDiagnosticFlow } from '../src/providers/diagnostic-flow-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

const SITUATION_SEEDS = getSituationSeed();

function getDisplayOptionTitle(option: DiagnosticQuestionOption): string {
  return option.presentation.title?.trim() || option.label;
}

function getDisplayOptionSupportingText(option: DiagnosticQuestionOption): string | null {
  return option.presentation.supportingText?.trim() || option.description;
}

function hasSingleSelectCascade(question: DiagnosticQuestionBlock): boolean {
  return (
    question.selectionMode === 'single' &&
    question.options.some((option) => option.showWhen !== null && option.showWhen.sourceQuestionId === question.id)
  );
}

function resolveNestedGuidanceMessage(params: {
  readonly hasParentSelected: boolean;
  readonly question: DiagnosticQuestionBlock;
  readonly supportsSingleSelectCascade: boolean;
}): string | null {
  if (!params.hasParentSelected) {
    return 'Select this category above to enable the detailed choices below.';
  }
  if (params.supportsSingleSelectCascade) {
    return 'Deeper selections keep the full path visible in this question.';
  }
  if (params.question.selectionMode === 'multiple') {
    return 'Selections in other categories stay saved while you move between panels.';
  }
  return null;
}

function getTerminalSelectedOptionId(selection: DiagnosticQuestionSelection): string | null {
  return selection.selectedOptionIds[selection.selectedOptionIds.length - 1] ?? null;
}

function buildRankedSelection(params: {
  readonly nextSelectedOptionIds: readonly string[];
  readonly selection: DiagnosticQuestionSelection;
}): DiagnosticQuestionSelection {
  const nextChildSelections = Object.fromEntries(
    Object.entries(params.selection.childSelections).filter(([optionId]) => params.nextSelectedOptionIds.includes(optionId)),
  );
  return {
    selectedOptionIds: [...params.nextSelectedOptionIds],
    childSelections: nextChildSelections,
  };
}

function MultipleChoiceQuestionCard(props: {
  readonly onToggleChildOption: (parentOptionId: string, childOptionId: string) => void;
  readonly onToggleOption: (optionId: string) => void;
  readonly options: readonly DiagnosticQuestionOption[];
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection;
}): ReactElement {
  const theme = useAppTheme();
  const supportsSingleSelectCascade = hasSingleSelectCascade(props.question);
  const terminalSelectedOptionId =
    props.question.selectionMode === 'single' ? getTerminalSelectedOptionId(props.selection) : null;
  return (
    <View style={styles.optionGroup}>
      <ThemedText style={[styles.variantHint, { color: theme.textMuted }]}>
        {props.question.selectionMode === 'multiple'
          ? 'Select one or more options.'
          : supportsSingleSelectCascade
            ? 'Choose one path. More choices may appear after your first selection.'
            : 'Select the option that fits best.'}
      </ThemedText>
      {props.options.length > 0 ? (
        props.options.map((option) => {
          const isInSelectedPath = props.selection.selectedOptionIds.includes(option.id);
          const isSelected = terminalSelectedOptionId !== null ? terminalSelectedOptionId === option.id : isInSelectedPath;
          const selectedChildOptionIds = props.selection.childSelections[option.id] ?? [];
          return (
            <View key={option.id} style={styles.optionCardGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => props.onToggleOption(option.id)}
                style={({ pressed }) => [
                  styles.optionButton,
                  {
                    backgroundColor: isSelected || isInSelectedPath ? theme.primarySoft : theme.surfaceMuted,
                    borderColor: isSelected || isInSelectedPath ? theme.primary : theme.border,
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
              >
                <View style={styles.optionStateRow}>
                  <View
                    style={[
                      styles.stateDot,
                      {
                        backgroundColor: isSelected ? theme.primary : isInSelectedPath ? theme.primarySoft : theme.surface,
                        borderColor: isSelected || isInSelectedPath ? theme.primary : theme.border,
                      },
                    ]}
                  />
                  <View style={styles.optionHeaderTextWrap}>
                    {option.presentation.eyebrow !== null ? (
                      <ThemedText style={[styles.optionEyebrow, { color: theme.primary }]}>{option.presentation.eyebrow}</ThemedText>
                    ) : null}
                    <View style={styles.optionHeaderRow}>
                      <ThemedText style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(option)}</ThemedText>
                      {option.presentation.badgeText !== null ? (
                        <View style={[styles.optionBadge, { backgroundColor: theme.primarySoft }]}>
                          <ThemedText style={[styles.optionBadgeText, { color: theme.primary }]}>{option.presentation.badgeText}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    {getDisplayOptionSupportingText(option) !== null ? (
                      <ThemedText style={[styles.optionDescription, { color: isSelected ? theme.text : theme.textMuted }]}>
                        {getDisplayOptionSupportingText(option)}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                {option.presentation.exampleBullets.length > 0 ? (
                  <View style={styles.exampleList}>
                    {option.presentation.exampleBullets.map((bullet) => (
                      <ThemedText key={`${option.id}-${bullet}`} style={[styles.exampleBullet, { color: theme.textMuted }]}>
                        - {bullet}
                      </ThemedText>
                    ))}
                  </View>
                ) : null}
              </Pressable>
              {isSelected && option.childQuestion !== null ? (
                <View style={[styles.detailPanel, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  <ThemedText style={[styles.detailPanelTitle, { color: theme.text }]}>{option.childQuestion.prompt}</ThemedText>
                  {option.childQuestion.description !== null ? (
                    <ThemedText style={[styles.detailPanelDescription, { color: theme.textMuted }]}>
                      {option.childQuestion.description}
                    </ThemedText>
                  ) : null}
                  <View style={styles.detailOptionGroup}>
                    {option.childQuestion.options.map((childOption) => {
                      const isChildSelected = selectedChildOptionIds.includes(childOption.id);
                      return (
                        <Pressable
                          key={childOption.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isChildSelected }}
                          onPress={() => props.onToggleChildOption(option.id, childOption.id)}
                          style={({ pressed }) => [
                            styles.childOptionButton,
                            {
                              backgroundColor: isChildSelected ? theme.primarySoft : theme.surface,
                              borderColor: isChildSelected ? theme.primary : theme.border,
                              opacity: pressed ? 0.95 : 1,
                            },
                          ]}
                        >
                          <View style={styles.optionContentWrap}>
                            <ThemedText style={[styles.childOptionLabel, { color: theme.text }]}>{childOption.label}</ThemedText>
                            {childOption.description !== null ? (
                              <ThemedText style={[styles.childOptionDescription, { color: theme.textMuted }]}>
                                {childOption.description}
                              </ThemedText>
                            ) : null}
                          </View>
                          <View
                            style={[
                              styles.childSelectionBox,
                              {
                                backgroundColor: isChildSelected ? theme.primary : theme.surface,
                                borderColor: isChildSelected ? theme.primary : theme.border,
                              },
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
          We could not load the answer options for this step. Tap Start over to request a fresh round.
        </ThemedText>
      )}
    </View>
  );
}

function NestedOptionsQuestionCard(props: {
  readonly onToggleChildOption: (parentOptionId: string, childOptionId: string) => void;
  readonly onToggleOption: (optionId: string) => void;
  readonly options: readonly DiagnosticQuestionOption[];
  readonly question: DiagnosticQuestionBlock;
  readonly selection: DiagnosticQuestionSelection;
}): ReactElement {
  const theme = useAppTheme();
  const supportsSingleSelectCascade = hasSingleSelectCascade(props.question);
  const terminalSelectedOptionId =
    props.question.selectionMode === 'single' ? getTerminalSelectedOptionId(props.selection) : null;
  const [requestedActiveOptionId, setRequestedActiveOptionId] = useState<string | null>(null);
  const activeOptionId =
    requestedActiveOptionId !== null && props.options.some((option) => option.id === requestedActiveOptionId)
      ? requestedActiveOptionId
      : null;
  const activeOption =
    activeOptionId === null ? null : props.options.find((option) => option.id === activeOptionId) ?? null;
  const activeChildSelections = activeOption === null ? [] : props.selection.childSelections[activeOption.id] ?? [];
  const guidanceMessage =
    activeOption === null
      ? null
      : resolveNestedGuidanceMessage({
          hasParentSelected: props.selection.selectedOptionIds.includes(activeOption.id),
          question: props.question,
          supportsSingleSelectCascade,
        });
  return (
    <View style={styles.optionGroup}>
      <ThemedText style={[styles.variantHint, { color: theme.textMuted }]}>
        Tap a category first, then answer the detailed choices below. Other category selections stay saved.
      </ThemedText>
      {props.options.map((option) => {
        const isInSelectedPath = props.selection.selectedOptionIds.includes(option.id);
        const isSelected = terminalSelectedOptionId !== null ? terminalSelectedOptionId === option.id : isInSelectedPath;
        const isActive = activeOption?.id === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              props.onToggleOption(option.id);
              setRequestedActiveOptionId(option.id);
            }}
            style={({ pressed }) => [
              styles.optionButton,
              styles.nestedCategoryButton,
              {
                backgroundColor: isActive || isSelected ? theme.primarySoft : theme.surfaceMuted,
                borderColor: isActive || isSelected ? theme.primary : theme.border,
                opacity: pressed ? 0.95 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.stateDot,
                {
                  backgroundColor: isSelected ? theme.primary : isInSelectedPath ? theme.primarySoft : theme.surface,
                  borderColor: isSelected || isInSelectedPath ? theme.primary : theme.border,
                },
              ]}
            />
            <View style={styles.optionContentWrap}>
              <ThemedText style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(option)}</ThemedText>
              {getDisplayOptionSupportingText(option) !== null ? (
                <ThemedText style={[styles.optionDescription, { color: theme.textMuted }]}>{getDisplayOptionSupportingText(option)}</ThemedText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <View style={[styles.detailPanel, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        {activeOption === null ? (
          <View style={styles.nestedDetailPlaceholder} accessibilityRole="text" accessibilityLabel="Choose a category first">
            <ThemedText style={[styles.nestedDetailPlaceholderTitle, { color: theme.text }]}>Choose a category first</ThemedText>
            <ThemedText style={[styles.nestedDetailPlaceholderBody, { color: theme.textMuted }]}>
              Select a category above. Follow-up choices for that category will appear here.
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText style={[styles.detailPanelTitle, { color: theme.text }]}>
              {activeOption.presentation.panelTitle ?? getDisplayOptionTitle(activeOption)}
            </ThemedText>
            {activeOption.childQuestion !== null ? (
              <ThemedText style={[styles.detailPanelDescription, { color: theme.textMuted }]}>{activeOption.childQuestion.prompt}</ThemedText>
            ) : null}
            {activeOption.childQuestion !== null ? (
              <View style={styles.detailOptionGroup}>
                {activeOption.childQuestion.options.map((childOption) => {
                  const isSelected = activeChildSelections.includes(childOption.id);
                  const isParentEnabled = props.selection.selectedOptionIds.includes(activeOption.id);
                  return (
                    <Pressable
                      key={childOption.id}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !isParentEnabled, selected: isSelected }}
                      disabled={!isParentEnabled}
                      onPress={() => props.onToggleChildOption(activeOption.id, childOption.id)}
                      style={({ pressed }) => [
                        styles.childOptionButton,
                        {
                          backgroundColor: isSelected ? theme.primarySoft : theme.surface,
                          borderColor: isSelected ? theme.primary : theme.border,
                          opacity: !isParentEnabled ? 0.55 : pressed ? 0.95 : 1,
                        },
                      ]}
                    >
                      <View style={styles.optionContentWrap}>
                        <ThemedText style={[styles.childOptionLabel, { color: theme.text }]}>{childOption.label}</ThemedText>
                        {childOption.description !== null ? (
                          <ThemedText style={[styles.childOptionDescription, { color: theme.textMuted }]}>{childOption.description}</ThemedText>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.childSelectionBox,
                          {
                            backgroundColor: isSelected ? theme.primary : theme.surface,
                            borderColor: isSelected ? theme.primary : theme.border,
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ThemedText style={[styles.detailPanelDescription, { color: theme.textMuted }]}>
                Add a follow-up question to this option in the template editor to show detailed choices here.
              </ThemedText>
            )}
            {guidanceMessage !== null ? (
              <View style={[styles.guidanceBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <ThemedText style={[styles.guidanceBannerText, { color: theme.textMuted }]}>{guidanceMessage}</ThemedText>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function RankedOptionsQuestionCard(props: {
  readonly onSelectionChange: (nextSelection: DiagnosticQuestionSelection) => void;
  readonly options: readonly DiagnosticQuestionOption[];
  readonly question: DiagnosticQuestionBlock;
  readonly rankedOptionLimit: number;
  readonly selection: DiagnosticQuestionSelection;
}): ReactElement {
  const theme = useAppTheme();
  const selectedOptionIds = props.selection.selectedOptionIds;
  const selectedRankLookup = new Map(selectedOptionIds.map((optionId, optionIndex) => [optionId, optionIndex] as const));
  const selectedOptions = selectedOptionIds
    .map((optionId) => props.options.find((option) => option.id === optionId))
    .filter((option): option is DiagnosticQuestionOption => option !== undefined);

  function updateRankedOptionIds(nextSelectedOptionIds: readonly string[]): void {
    props.onSelectionChange(
      buildRankedSelection({
        nextSelectedOptionIds,
        selection: props.selection,
      }),
    );
  }

  function executeAddOption(optionId: string): void {
    if (selectedOptionIds.includes(optionId) || selectedOptionIds.length >= props.rankedOptionLimit) {
      return;
    }
    updateRankedOptionIds([...selectedOptionIds, optionId]);
  }

  function executeRemoveOption(optionId: string): void {
    updateRankedOptionIds(selectedOptionIds.filter((candidateOptionId) => candidateOptionId !== optionId));
  }

  function executeMoveOption(optionId: string, direction: -1 | 1): void {
    const optionIndex = selectedOptionIds.indexOf(optionId);
    if (optionIndex < 0) {
      return;
    }
    const targetIndex = optionIndex + direction;
    if (targetIndex < 0 || targetIndex >= selectedOptionIds.length) {
      return;
    }
    const nextSelectedOptionIds = [...selectedOptionIds];
    const [movedOptionId] = nextSelectedOptionIds.splice(optionIndex, 1);
    if (movedOptionId === undefined) {
      return;
    }
    nextSelectedOptionIds.splice(targetIndex, 0, movedOptionId);
    updateRankedOptionIds(nextSelectedOptionIds);
  }

  return (
    <View style={styles.optionGroup}>
      <ThemedText style={[styles.variantHint, { color: theme.textMuted }]}>
        Pick your top {props.rankedOptionLimit} outcomes, then use the move buttons below to adjust their order.
      </ThemedText>
      {props.options.map((option) => {
        const selectedRankIndex = selectedRankLookup.get(option.id);
        const isSelected = selectedRankIndex !== undefined;
        const isDisabled = isSelected === false && selectedOptionIds.length >= props.rankedOptionLimit;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, selected: isSelected }}
            onPress={() => (isSelected ? executeRemoveOption(option.id) : executeAddOption(option.id))}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.optionButton,
              styles.rankedOptionButton,
              {
                backgroundColor: isSelected ? theme.primarySoft : theme.surfaceMuted,
                borderColor: isSelected ? theme.primary : theme.border,
                opacity: isDisabled ? 0.55 : pressed ? 0.95 : 1,
              },
            ]}
          >
            {isSelected ? (
              <View style={[styles.rankBadge, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                <ThemedText style={[styles.rankBadgeText, { color: theme.primary }]}>RANK {selectedRankIndex + 1}</ThemedText>
              </View>
            ) : null}
            <View style={styles.optionContentWrap}>
              {option.presentation.eyebrow !== null ? (
                <ThemedText style={[styles.optionEyebrow, { color: theme.primary }]}>{option.presentation.eyebrow}</ThemedText>
              ) : null}
              <ThemedText style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(option)}</ThemedText>
              {getDisplayOptionSupportingText(option) !== null ? (
                <ThemedText style={[styles.optionDescription, { color: theme.textMuted }]}>{getDisplayOptionSupportingText(option)}</ThemedText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <View style={[styles.detailPanel, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <View style={styles.rankHeaderRow}>
          <ThemedText style={[styles.detailPanelTitle, { color: theme.text }]}>Your ranked outcomes</ThemedText>
          <ThemedText style={[styles.rankCount, { color: theme.primary }]}>
            {selectedOptionIds.length} / {props.rankedOptionLimit}
          </ThemedText>
        </View>
        {selectedOptions.length > 0 ? (
          <View style={styles.detailOptionGroup}>
            {selectedOptions.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.rankSelectionCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.rankSelectionHeader}>
                  <View style={[styles.rankIndexPill, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[styles.rankIndexText, { color: theme.onPrimary }]}>{index + 1}</ThemedText>
                  </View>
                  <View style={styles.optionContentWrap}>
                    <ThemedText style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(item)}</ThemedText>
                    {getDisplayOptionSupportingText(item) !== null ? (
                      <ThemedText style={[styles.optionDescription, { color: theme.textMuted }]}>{getDisplayOptionSupportingText(item)}</ThemedText>
                    ) : null}
                  </View>
                  <View style={[styles.rankStatusBadge, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
                    <ThemedText style={[styles.rankStatusText, { color: theme.primary }]}>SELECTED</ThemedText>
                  </View>
                </View>
                <View style={styles.rankActionsRow}>
                  <AppButton disabled={index === 0} onPress={() => executeMoveOption(item.id, -1)} variant="secondary">
                    Move up
                  </AppButton>
                  <AppButton
                    disabled={index >= selectedOptions.length - 1}
                    onPress={() => executeMoveOption(item.id, 1)}
                    variant="secondary"
                  >
                    Move down
                  </AppButton>
                  <AppButton onPress={() => executeRemoveOption(item.id)} variant="ghost">
                    Remove
                  </AppButton>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={[styles.detailPanelDescription, { color: theme.textMuted }]}>
            No outcomes ranked yet. Select options above to build your top list.
          </ThemedText>
        )}
      </View>
    </View>
  );
}

/**
 * Guided diagnostic screen for the native public intake flow.
 */
export default function DiagnosticScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const {
    activeTemplateName,
    canGoBack,
    diagnosticAiEnabled,
    errorMessage,
    executeAdvance,
    executeFinalizeDiagnostic,
    executeGoBack,
    executeReset,
    executeSelectChildOption,
    executeSelectOption,
    executeSetQuestionSelection,
    executeStartDiagnostic,
    executeUpdateAnswerNote,
    executeUpdatePrompt,
    executeUsePromptSeed,
    guided,
    hasUsableActiveTemplate,
    isBusy,
    isConfigReady,
    isHydrated,
    progressHint,
    progressPercent,
  } = useDiagnosticFlow();
  const hasProgress =
    guided.initialPrompt.trim().length > 0 || guided.activeRound !== null || guided.completedBundles.length > 0 || guided.outcome !== null;
  const activeRound = guided.activeRound;
  const currentQuestion = activeRound?.questions[activeRound.stepIndex];
  const baseAnswers = useMemo(
    () =>
      buildDiagnosticAnswerLookup({
        completedBundles: guided.completedBundles,
      }),
    [guided.completedBundles],
  );
  const optionBaseAnswers = useMemo(
    () =>
      buildDiagnosticAnswerLookup({
        completedBundles: guided.completedBundles,
        activeRound,
      }),
    [activeRound, guided.completedBundles],
  );
  const visibleQuestionIndexes = useMemo(
    () =>
      activeRound === null
        ? []
        : getVisibleQuestionIndexes({
            questions: activeRound.questions,
            baseAnswers,
            answers: activeRound.answers,
          }),
    [activeRound, baseAnswers],
  );
  const questionSelection =
    currentQuestion === undefined
      ? createEmptyDiagnosticQuestionSelection()
      : (activeRound?.answers[currentQuestion.id] ?? createEmptyDiagnosticQuestionSelection());
  const currentOptions =
    currentQuestion === undefined
      ? []
      : getVisibleQuestionOptions({
          baseAnswers: optionBaseAnswers,
          question: currentQuestion,
          selection: questionSelection,
        });
  const shouldShowDetailNoteTextbox = useMemo(() => {
    if (currentQuestion === undefined) {
      return false;
    }
    return shouldShowQuestionDetailNoteInput({
      baseAnswers: optionBaseAnswers,
      question: currentQuestion,
      selection: questionSelection,
    });
  }, [currentQuestion, optionBaseAnswers, questionSelection]);
  const positionInRound = currentQuestion === undefined ? 0 : Math.max(visibleQuestionIndexes.indexOf(activeRound?.stepIndex ?? -1) + 1, 1);
  const roundSize = visibleQuestionIndexes.length > 0 ? visibleQuestionIndexes.length : activeRound?.questions.length ?? 0;
  const footer = (
    <View style={styles.footerGroup}>
      {guided.outcome !== null ? (
        <AppButton
          busy={isBusy}
          iconName="calendar-outline"
          onPress={() => {
            void executeFinalizeDiagnostic().then(() => router.push('/booking')).catch(() => {});
          }}
          showTrailingIcon
        >
          Book this session
        </AppButton>
      ) : activeRound !== null ? (
        <AppButton busy={isBusy} iconName="arrow-forward-circle-outline" onPress={() => void executeAdvance()} showTrailingIcon>
          {positionInRound >= roundSize
            ? diagnosticAiEnabled
              ? 'Submit round'
              : 'Continue'
            : 'Next question'}
        </AppButton>
      ) : diagnosticAiEnabled ? (
        <AppButton
          busy={isBusy}
          disabled={!isHydrated}
          iconName="play-circle-outline"
          onPress={() => void executeStartDiagnostic()}
          showTrailingIcon
        >
          Start diagnostic
        </AppButton>
      ) : null}
      {canGoBack ? (
        <AppButton disabled={isBusy} iconName="arrow-back-outline" onPress={executeGoBack} variant="secondary">
          Back
        </AppButton>
      ) : null}
      {hasProgress ? (
        <AppButton disabled={isBusy} iconName="refresh-outline" onPress={() => void executeReset()} variant="ghost">
          Start over
        </AppButton>
      ) : null}
    </View>
  );

  return (
    <AppScreen
      title="Guided diagnostic"
      subtitle={
        diagnosticAiEnabled
          ? 'Move from confusion to a clear next step with short, structured prompts.'
          : 'Follow the active diagnostic template your advisor configured for this intake flow.'
      }
      footer={footer}
    >
      <AppCard>
        <View style={styles.progressRow}>
          <ThemedText style={[styles.progressLabel, { color: theme.textMuted }]}>{progressHint}</ThemedText>
          <ThemedText style={[styles.progressLabel, { color: theme.textMuted }]}>{progressPercent}%</ThemedText>
        </View>
        <View style={styles.progressBarWrap}>
          <ProgressBar value={progressPercent} />
        </View>
      </AppCard>
      {!isHydrated ? (
        <AppCard>
          <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>Loading your saved diagnostic progress...</ThemedText>
        </AppCard>
      ) : null}
      {errorMessage !== null ? (
        <AppCard>
          <ThemedText style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</ThemedText>
        </AppCard>
      ) : null}
      {guided.outcome === null && activeRound === null && diagnosticAiEnabled ? (
        <AppCard>
          <ThemedText style={[styles.sectionHeading, { color: theme.text }]}>What is going on right now?</ThemedText>
          <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
            Describe the business or delivery problem in a few lines. You can tap suggested phrases below.
          </ThemedText>
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
                  <ThemedText style={[styles.seedChipText, { color: isActive ? theme.primary : theme.text }]}>{phrase}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </AppCard>
      ) : null}
      {guided.outcome === null && activeRound === null && !diagnosticAiEnabled ? (
        <AppCard>
          {!isConfigReady || hasUsableActiveTemplate ? (
            <>
              <ThemedText style={[styles.sectionHeading, { color: theme.text }]}>Preparing your diagnostic</ThemedText>
              <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
                {activeTemplateName !== null
                  ? `Loading the active template: ${activeTemplateName}.`
                  : 'Loading the active diagnostic template.'}
              </ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={[styles.sectionHeading, { color: theme.text }]}>Template unavailable</ThemedText>
              <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
                No active diagnostic template is ready yet. Ask an admin to create and activate one first.
              </ThemedText>
            </>
          )}
        </AppCard>
      ) : null}
      {activeRound !== null && currentQuestion !== undefined ? (
        <AppCard>
          {positionInRound === 1 && activeRound.guidance !== null ? (
            <ThemedText style={[styles.guidanceText, { color: theme.primary }]}>{activeRound.guidance}</ThemedText>
          ) : null}
          <ThemedText style={[styles.questionCounter, { color: theme.textMuted }]}>
            Question {positionInRound} of {roundSize}
          </ThemedText>
          <ThemedText style={[styles.questionTitle, { color: theme.text }]}>{currentQuestion.prompt}</ThemedText>
          {currentQuestion.description !== null ? (
            <ThemedText style={[styles.helperText, styles.questionDescription, { color: theme.textMuted }]}>
              {currentQuestion.description}
            </ThemedText>
          ) : null}
          {currentQuestion.type === 'nested-options' ? (
            <NestedOptionsQuestionCard
              key={currentQuestion.id}
              options={currentOptions}
              question={currentQuestion}
              selection={questionSelection}
              onToggleChildOption={(parentOptionId: string, childOptionId: string): void =>
                executeSelectChildOption(currentQuestion, parentOptionId, childOptionId)
              }
              onToggleOption={(optionId: string): void => executeSelectOption(currentQuestion, optionId)}
            />
          ) : currentQuestion.type === 'ranked-options' ? (
            <RankedOptionsQuestionCard
              options={currentOptions}
              question={currentQuestion}
              rankedOptionLimit={currentQuestion.rankedOptionLimit ?? 3}
              selection={questionSelection}
              onSelectionChange={(nextSelection: DiagnosticQuestionSelection): void =>
                executeSetQuestionSelection(currentQuestion.id, nextSelection)
              }
            />
          ) : (
            <MultipleChoiceQuestionCard
              options={currentOptions}
              question={currentQuestion}
              selection={questionSelection}
              onToggleChildOption={(parentOptionId: string, childOptionId: string): void =>
                executeSelectChildOption(currentQuestion, parentOptionId, childOptionId)
              }
              onToggleOption={(optionId: string): void => executeSelectOption(currentQuestion, optionId)}
            />
          )}
          {shouldShowDetailNoteTextbox ? (
            <View style={styles.noteFieldWrap}>
              <ThemedText style={[styles.noteFieldLabel, { color: theme.text }]}>
                Your exact answer <ThemedText style={{ color: theme.danger }}>(required)</ThemedText>
              </ThemedText>
              <ThemedText style={[styles.noteFieldHint, { color: theme.textMuted }]}>
                This path requires a short written detail before you can continue.
              </ThemedText>
              <TextInput
                accessibilityLabel="Your exact answer, required"
                multiline
                onChangeText={(value) => executeUpdateAnswerNote(currentQuestion.id, value)}
                placeholder="Add specifics your advisor needs (versions, errors, timing…)"
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
            </View>
          ) : null}
        </AppCard>
      ) : null}
      {guided.outcome !== null ? (
        <AppCard>
          <ThemedText style={[styles.sectionHeading, { color: theme.text }]}>We have enough signal to guide you.</ThemedText>
          <ThemedText style={[styles.recommendationTitle, { color: theme.text }]}>
            {resolveProjectRescueSessionTitle(guided.outcome.sessionTitle)}
          </ThemedText>
          <ThemedText style={[styles.briefAssessmentText, { color: theme.textMuted }]}>
            {resolveProjectRescueBriefAssessment(guided.outcome.briefAssessment)}
          </ThemedText>
          <View style={[styles.summaryBadge, { backgroundColor: theme.primarySoft }]}>
            <ThemedText style={[styles.summaryBadgeText, { color: theme.primary }]}>{guided.outcome.mappedSituation}</ThemedText>
          </View>
          <ThemedText style={[styles.subsectionLabel, { color: theme.text }]}>Your advisor summary</ThemedText>
          <ThemedText style={[styles.summaryText, { color: theme.textMuted }]}>{guided.outcome.advisorSummary}</ThemedText>
          <ThemedText style={[styles.goodFitHeading, { color: theme.textMuted }]}>Good fit if</ThemedText>
          {resolveProjectRescueGoodFitBullets(guided.outcome.goodFitBullets).map((line, index) => (
            <View key={`gf-${index}`} style={styles.goodFitRow}>
              <View style={[styles.goodFitBullet, { backgroundColor: theme.primary }]} />
              <ThemedText style={[styles.goodFitLine, { color: theme.textMuted }]}>{line}</ThemedText>
            </View>
          ))}
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
  recommendationTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 14,
  },
  briefAssessmentText: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  subsectionLabel: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 20,
  },
  goodFitHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 22,
    textTransform: 'uppercase',
  },
  goodFitRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  goodFitBullet: {
    borderRadius: 999,
    height: 8,
    marginTop: 8,
    width: 8,
  },
  goodFitLine: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
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
  questionDescription: {
    marginTop: 8,
  },
  optionGroup: {
    gap: 12,
    marginTop: 18,
  },
  optionCardGroup: {
    gap: 10,
  },
  optionButton: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rankedOptionButton: {
    position: 'relative',
  },
  nestedCategoryButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  optionContentWrap: {
    flex: 1,
  },
  optionHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  optionHeaderTextWrap: {
    flex: 1,
  },
  optionStateRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  optionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    lineHeight: 16,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  optionBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  exampleList: {
    gap: 6,
    marginTop: 10,
  },
  exampleBullet: {
    fontSize: 13,
    lineHeight: 18,
  },
  variantHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  stateDot: {
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    marginTop: 3,
    width: 18,
  },
  detailPanel: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  nestedDetailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    paddingVertical: 12,
  },
  nestedDetailPlaceholderTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  nestedDetailPlaceholderBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  detailPanelTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  detailPanelDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  detailOptionGroup: {
    gap: 10,
    marginTop: 14,
  },
  childOptionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  childOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  childOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  childSelectionBox: {
    borderRadius: 7,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  guidanceBanner: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  guidanceBannerText: {
    fontSize: 13,
    lineHeight: 19,
  },
  rankBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    right: -4,
    top: -4,
    zIndex: 2,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  rankHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankCount: {
    fontSize: 14,
    fontWeight: '800',
  },
  rankSelectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rankSelectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  rankIndexPill: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 34,
    paddingHorizontal: 10,
  },
  rankIndexText: {
    fontSize: 14,
    fontWeight: '800',
  },
  rankStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rankStatusText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  rankActionsRow: {
    gap: 10,
    marginTop: 14,
  },
  noteFieldWrap: {
    marginTop: 16,
  },
  noteFieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  noteFieldHint: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  noteInput: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
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
