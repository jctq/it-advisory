import {
  buildDiagnosticAnswerLookup,
  createEmptyDiagnosticQuestionSelection,
  getVisibleQuestionIndexes,
  getVisibleQuestionOptions,
  type DiagnosticQuestionBlock,
  type DiagnosticQuestionOption,
  type DiagnosticQuestionSelection,
} from '@it-advisory/diagnostic-core/guided-diagnostic-types';
import { getSituationSeed } from '@it-advisory/diagnostic-core/situation-options';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
      <Text style={[styles.variantHint, { color: theme.textMuted }]}>
        {props.question.selectionMode === 'multiple'
          ? 'Select one or more options.'
          : supportsSingleSelectCascade
            ? 'Choose one path. More choices may appear after your first selection.'
            : 'Select the option that fits best.'}
      </Text>
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
                      <Text style={[styles.optionEyebrow, { color: theme.primary }]}>{option.presentation.eyebrow}</Text>
                    ) : null}
                    <View style={styles.optionHeaderRow}>
                      <Text style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(option)}</Text>
                      {option.presentation.badgeText !== null ? (
                        <View style={[styles.optionBadge, { backgroundColor: theme.primarySoft }]}>
                          <Text style={[styles.optionBadgeText, { color: theme.primary }]}>{option.presentation.badgeText}</Text>
                        </View>
                      ) : null}
                    </View>
                    {getDisplayOptionSupportingText(option) !== null ? (
                      <Text style={[styles.optionDescription, { color: isSelected ? theme.text : theme.textMuted }]}>
                        {getDisplayOptionSupportingText(option)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {option.presentation.exampleBullets.length > 0 ? (
                  <View style={styles.exampleList}>
                    {option.presentation.exampleBullets.map((bullet) => (
                      <Text key={`${option.id}-${bullet}`} style={[styles.exampleBullet, { color: theme.textMuted }]}>
                        - {bullet}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Pressable>
              {isSelected && option.childQuestion !== null ? (
                <View style={[styles.detailPanel, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  <Text style={[styles.detailPanelTitle, { color: theme.text }]}>{option.childQuestion.prompt}</Text>
                  {option.childQuestion.description !== null ? (
                    <Text style={[styles.detailPanelDescription, { color: theme.textMuted }]}>
                      {option.childQuestion.description}
                    </Text>
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
                            <Text style={[styles.childOptionLabel, { color: theme.text }]}>{childOption.label}</Text>
                            {childOption.description !== null ? (
                              <Text style={[styles.childOptionDescription, { color: theme.textMuted }]}>
                                {childOption.description}
                              </Text>
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
        <Text style={[styles.helperText, { color: theme.textMuted }]}>
          We could not load the answer options for this step. Tap Start over to request a fresh round.
        </Text>
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
  const [requestedActiveOptionId, setRequestedActiveOptionId] = useState<string | null>(
    terminalSelectedOptionId ?? props.selection.selectedOptionIds[0] ?? props.options[0]?.id ?? null,
  );

  useEffect(() => {
    setRequestedActiveOptionId(terminalSelectedOptionId ?? props.selection.selectedOptionIds[0] ?? props.options[0]?.id ?? null);
  }, [props.options, props.selection.selectedOptionIds, terminalSelectedOptionId]);

  const activeOptionId =
    requestedActiveOptionId !== null && props.options.some((option) => option.id === requestedActiveOptionId)
      ? requestedActiveOptionId
      : terminalSelectedOptionId ??
        props.selection.selectedOptionIds.find((optionId) => props.options.some((option) => option.id === optionId)) ??
        props.options[0]?.id ??
        null;
  const activeOption = props.options.find((option) => option.id === activeOptionId) ?? props.options[0] ?? null;
  const activeChildSelections = activeOption === null ? [] : props.selection.childSelections[activeOption.id] ?? [];

  return (
    <View style={styles.optionGroup}>
      <Text style={[styles.variantHint, { color: theme.textMuted }]}>
        Select a category, then answer the detailed choices below. Other category selections stay saved.
      </Text>
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
              <Text style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(option)}</Text>
              {getDisplayOptionSupportingText(option) !== null ? (
                <Text style={[styles.optionDescription, { color: theme.textMuted }]}>{getDisplayOptionSupportingText(option)}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {activeOption !== null ? (
        <View style={[styles.detailPanel, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <Text style={[styles.detailPanelTitle, { color: theme.text }]}>
            {activeOption.presentation.panelTitle ?? getDisplayOptionTitle(activeOption)}
          </Text>
          {activeOption.childQuestion !== null ? (
            <Text style={[styles.detailPanelDescription, { color: theme.textMuted }]}>{activeOption.childQuestion.prompt}</Text>
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
                      <Text style={[styles.childOptionLabel, { color: theme.text }]}>{childOption.label}</Text>
                      {childOption.description !== null ? (
                        <Text style={[styles.childOptionDescription, { color: theme.textMuted }]}>{childOption.description}</Text>
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
            <Text style={[styles.detailPanelDescription, { color: theme.textMuted }]}>
              Add a follow-up question to this option in the template editor to show detailed choices here.
            </Text>
          )}
          <View style={[styles.guidanceBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.guidanceBannerText, { color: theme.textMuted }]}>
              {props.selection.selectedOptionIds.includes(activeOption.id)
                ? supportsSingleSelectCascade
                  ? 'Deeper selections keep the full path visible in this question.'
                  : 'Selections in other categories stay saved while you move between panels.'
                : 'Select this category above to enable the detailed choices below.'}
            </Text>
          </View>
        </View>
      ) : null}
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
      <Text style={[styles.variantHint, { color: theme.textMuted }]}>
        Pick your top {props.rankedOptionLimit} outcomes, then use the move buttons below to adjust their order.
      </Text>
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
                <Text style={[styles.rankBadgeText, { color: theme.primary }]}>RANK {selectedRankIndex + 1}</Text>
              </View>
            ) : null}
            <View style={styles.optionContentWrap}>
              {option.presentation.eyebrow !== null ? (
                <Text style={[styles.optionEyebrow, { color: theme.primary }]}>{option.presentation.eyebrow}</Text>
              ) : null}
              <Text style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(option)}</Text>
              {getDisplayOptionSupportingText(option) !== null ? (
                <Text style={[styles.optionDescription, { color: theme.textMuted }]}>{getDisplayOptionSupportingText(option)}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <View style={[styles.detailPanel, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
        <View style={styles.rankHeaderRow}>
          <Text style={[styles.detailPanelTitle, { color: theme.text }]}>Your ranked outcomes</Text>
          <Text style={[styles.rankCount, { color: theme.primary }]}>
            {selectedOptionIds.length} / {props.rankedOptionLimit}
          </Text>
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
                    <Text style={styles.rankIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.optionContentWrap}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{getDisplayOptionTitle(item)}</Text>
                    {getDisplayOptionSupportingText(item) !== null ? (
                      <Text style={[styles.optionDescription, { color: theme.textMuted }]}>{getDisplayOptionSupportingText(item)}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.rankStatusBadge, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
                    <Text style={[styles.rankStatusText, { color: theme.primary }]}>SELECTED</Text>
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
          <Text style={[styles.detailPanelDescription, { color: theme.textMuted }]}>
            No outcomes ranked yet. Select options above to build your top list.
          </Text>
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
  const positionInRound = currentQuestion === undefined ? 0 : Math.max(visibleQuestionIndexes.indexOf(activeRound?.stepIndex ?? -1) + 1, 1);
  const roundSize = visibleQuestionIndexes.length > 0 ? visibleQuestionIndexes.length : activeRound?.questions.length ?? 0;
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
          {positionInRound >= roundSize
            ? diagnosticAiEnabled
              ? 'Submit round'
              : 'Continue'
            : 'Next question'}
        </AppButton>
      ) : diagnosticAiEnabled ? (
        <AppButton disabled={isBusy || !isHydrated} onPress={() => void executeStartDiagnostic()}>
          Start diagnostic
        </AppButton>
      ) : null}
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
      subtitle={
        diagnosticAiEnabled
          ? 'Move from confusion to a clear next step with short, structured prompts.'
          : 'Follow the active diagnostic template your advisor configured for this intake flow.'
      }
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
      {guided.outcome === null && activeRound === null && diagnosticAiEnabled ? (
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
      {guided.outcome === null && activeRound === null && !diagnosticAiEnabled ? (
        <AppCard>
          {!isConfigReady || hasUsableActiveTemplate ? (
            <>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Preparing your diagnostic</Text>
              <Text style={[styles.helperText, { color: theme.textMuted }]}>
                {activeTemplateName !== null
                  ? `Loading the active template: ${activeTemplateName}.`
                  : 'Loading the active diagnostic template.'}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Template unavailable</Text>
              <Text style={[styles.helperText, { color: theme.textMuted }]}>
                No active diagnostic template is ready yet. Ask an admin to create and activate one first.
              </Text>
            </>
          )}
        </AppCard>
      ) : null}
      {activeRound !== null && currentQuestion !== undefined ? (
        <AppCard>
          {positionInRound === 1 && activeRound.guidance !== null ? (
            <Text style={[styles.guidanceText, { color: theme.primary }]}>{activeRound.guidance}</Text>
          ) : null}
          <Text style={[styles.questionCounter, { color: theme.textMuted }]}>
            Question {positionInRound} of {roundSize}
          </Text>
          <Text style={[styles.questionTitle, { color: theme.text }]}>{currentQuestion.prompt}</Text>
          {currentQuestion.description !== null ? (
            <Text style={[styles.helperText, styles.questionDescription, { color: theme.textMuted }]}>
              {currentQuestion.description}
            </Text>
          ) : null}
          {currentQuestion.type === 'nested-options' ? (
            <NestedOptionsQuestionCard
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
    color: '#FFFFFF',
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
