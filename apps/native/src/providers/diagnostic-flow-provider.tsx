import { DiagnosticApiClient } from '@it-advisory/api-client/diagnostic-api-client';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  applyGuidedGoBack,
  buildDiagnosticAnswerLookup,
  computeGuidedLinearStep,
  getVisibleQuestionIndexes,
  normalizeDiagnosticOptions,
  parseGuidedDiagnosticJson,
  pruneHiddenAnswers,
  type DiagnosticQuestionSelection,
  toggleQuestionOptionSelection,
  toggleChildQuestionOptionSelection,
  toApiRoundsFromBundles,
  type CompletedRoundBundle,
  type DiagnosticQuestionBlock,
  type GuidedDiagnosticOutcome,
  type GuidedDiagnosticV1,
  validateGuidedQuestionResponse,
} from '@it-advisory/diagnostic-core/guided-diagnostic-types';
import {
  buildActiveRoundFromTemplate,
  buildNextTemplateRoundFromState,
  type PublicDiagnosticTemplateValue,
} from '@it-advisory/diagnostic-core/template-diagnostic-flow';
import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { readOrCreateDeviceId } from '../lib/device-id';
import {
  buildDiagnosticProgress,
  buildQuizAnswersPayload,
  MIN_PROMPT_LENGTH,
  normalizeGuidedDiagnosticRaw,
  togglePromptWithSeed,
} from '../lib/diagnostic-flow';
import { readNativeAppConfig } from '../lib/native-app-config';

type DiagnosticFlowContextValue = {
  readonly canGoBack: boolean;
  readonly diagnosticAiEnabled: boolean;
  readonly errorMessage: string | null;
  readonly hasUsableActiveTemplate: boolean;
  readonly activeTemplateName: string | null;
  readonly guided: GuidedDiagnosticV1;
  readonly isBusy: boolean;
  readonly isConfigReady: boolean;
  readonly isHydrated: boolean;
  readonly progressHint: string;
  readonly progressPercent: number;
  executeAdvance(): Promise<void>;
  executeFinalizeDiagnostic(): Promise<void>;
  executeGoBack(): void;
  executeReset(): Promise<void>;
  executeSelectChildOption(question: DiagnosticQuestionBlock, parentOptionId: string, childOptionId: string): void;
  executeSelectOption(question: DiagnosticQuestionBlock, optionId: string): void;
  executeSetQuestionSelection(questionId: string, nextSelection: DiagnosticQuestionSelection): void;
  executeStartDiagnostic(): Promise<void>;
  executeUpdateAnswerNote(questionId: string, value: string): void;
  executeUpdatePrompt(value: string): void;
  executeUsePromptSeed(phrase: string): void;
};

const ANSWER_NOTE_LIMIT = 2000;

const DiagnosticFlowContext = createContext<DiagnosticFlowContextValue | null>(null);

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function buildHydratedGuidedState(rawSession: {
  readonly answers: Record<string, string | string[] | number | boolean>;
  readonly currentStep: number;
} | null): GuidedDiagnosticV1 {
  if (rawSession === null) {
    return GUIDED_DIAGNOSTIC_EMPTY;
  }
  const rawGuided = rawSession.answers.guidedDiagnostic;
  const normalized = normalizeGuidedDiagnosticRaw(rawGuided);
  if (normalized === undefined || normalized.length === 0) {
    return GUIDED_DIAGNOSTIC_EMPTY;
  }
  return parseGuidedDiagnosticJson(normalized) ?? GUIDED_DIAGNOSTIC_EMPTY;
}

function resolveVisibleStepIndex(params: {
  readonly activeRound: GuidedDiagnosticV1['activeRound'];
  readonly completedBundles: readonly CompletedRoundBundle[];
}): number {
  const activeRound = params.activeRound;
  if (activeRound === null) {
    return 0;
  }
  const visibleQuestionIndexes = getVisibleQuestionIndexes({
    questions: activeRound.questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles: params.completedBundles,
    }),
    answers: activeRound.answers,
  });
  if (visibleQuestionIndexes.length === 0) {
    return 0;
  }
  const nextVisibleQuestionIndex = visibleQuestionIndexes.find((questionIndex) => questionIndex >= activeRound.stepIndex);
  return nextVisibleQuestionIndex ?? visibleQuestionIndexes[visibleQuestionIndexes.length - 1] ?? 0;
}

function synchronizeActiveRound(params: {
  readonly activeRound: GuidedDiagnosticV1['activeRound'];
  readonly completedBundles: readonly CompletedRoundBundle[];
}): GuidedDiagnosticV1['activeRound'] {
  if (params.activeRound === null) {
    return null;
  }
  const prunedAnswers = pruneHiddenAnswers({
    questions: params.activeRound.questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles: params.completedBundles,
    }),
    answers: params.activeRound.answers,
    answerNotes: params.activeRound.answerNotes,
  });
  const stepIndex = resolveVisibleStepIndex({
    activeRound: {
      ...params.activeRound,
      answers: prunedAnswers.answers,
      answerNotes: prunedAnswers.answerNotes,
    },
    completedBundles: params.completedBundles,
  });
  return {
    ...params.activeRound,
    answers: prunedAnswers.answers,
    answerNotes: prunedAnswers.answerNotes,
    stepIndex,
  };
}

function buildVisibleBundleFromActive(params: {
  readonly activeRound: GuidedDiagnosticV1['activeRound'];
  readonly completedBundles: readonly CompletedRoundBundle[];
}): CompletedRoundBundle | null {
  const synchronizedRound = synchronizeActiveRound(params);
  if (synchronizedRound === null) {
    return null;
  }
  const visibleQuestionIndexes = getVisibleQuestionIndexes({
    questions: synchronizedRound.questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles: params.completedBundles,
    }),
    answers: synchronizedRound.answers,
  });
  const visibleQuestions = visibleQuestionIndexes.flatMap((questionIndex) => {
    const question = synchronizedRound.questions[questionIndex];
    return question === undefined ? [] : [question];
  });
  if (visibleQuestions.length === 0) {
    return null;
  }
  return {
    roundIndex: synchronizedRound.roundIndex,
    roundTitle: synchronizedRound.roundTitle,
    questions: visibleQuestions,
    answers: { ...synchronizedRound.answers },
    answerNotes: { ...synchronizedRound.answerNotes },
    guidance: synchronizedRound.guidance,
  };
}

/**
 * Provides the full guided-diagnostic state machine for the Expo app.
 */
export function DiagnosticFlowProvider(props: PropsWithChildren) {
  const config = useMemo(() => readNativeAppConfig(), []);
  const clientRef = useRef<DiagnosticApiClient | null>(null);
  const hasHydratedRef = useRef<boolean>(false);
  const [guided, setGuided] = useState<GuidedDiagnosticV1>(GUIDED_DIAGNOSTIC_EMPTY);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isConfigReady, setIsConfigReady] = useState<boolean>(false);
  const [diagnosticAiEnabled, setDiagnosticAiEnabled] = useState<boolean>(true);
  const [activeTemplate, setActiveTemplate] = useState<PublicDiagnosticTemplateValue | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialTemplateRound = useMemo(() => {
    if (activeTemplate === null) {
      return null;
    }
    return synchronizeActiveRound({
      activeRound: buildNextTemplateRoundFromState({
        template: activeTemplate,
        completedBundles: [],
        startRoundIndex: 0,
      }),
      completedBundles: [],
    });
  }, [activeTemplate]);

  const executePersistGuided = useCallback(async (next: GuidedDiagnosticV1, completed: boolean): Promise<void> => {
    const client = clientRef.current;
    if (client === null) {
      return;
    }
    await client.saveQuizSession({
      answers: buildQuizAnswersPayload(next),
      currentStep: computeLinearStep(next),
      completed,
    });
  }, []);

  const executeFetchRound = useCallback(async (completedBundles: readonly CompletedRoundBundle[]): Promise<void> => {
    const client = clientRef.current;
    if (client === null) {
      throw new Error('The app is still connecting to the diagnostic service.');
    }
    const response = await client.createDiagnosticRound({
      initialPrompt: guided.initialPrompt.trim(),
      rounds: toApiRoundsFromBundles(completedBundles),
    });
    if (response.complete) {
      const outcome: GuidedDiagnosticOutcome = {
        mappedSituation: response.mappedSituation,
        advisorSummary: response.summaryForAdvisor,
      };
      setGuided({
        ...guided,
        completedBundles: [...completedBundles],
        activeRound: null,
        outcome,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    const questions: DiagnosticQuestionBlock[] = response.questions.flatMap((question, index) => {
      const hasQuestionId = typeof question.id === 'string' && question.id.trim().length > 0;
      const hasPrompt = typeof question.prompt === 'string' && question.prompt.trim().length > 0;
      const options = Array.isArray(question.options)
        ? normalizeDiagnosticOptions(question.options)
        : [];
      if (!hasPrompt || options.length === 0) {
        return [];
      }
      return [
        {
          id: hasQuestionId ? question.id.trim() : `question-${index + 1}`,
          prompt: question.prompt.trim(),
          description: null,
          showWhen: null,
          type: 'multiple-choice',
          rankedOptionLimit: null,
          selectionMode: 'single',
          options,
        },
      ];
    });
    if (questions.length === 0) {
      throw new Error('No follow-up questions were returned. Please try again.');
    }
    setGuided({
      ...guided,
      completedBundles: [...completedBundles],
      activeRound: synchronizeActiveRound({
        activeRound: {
          roundIndex: completedBundles.length,
          roundTitle: `Round ${completedBundles.length + 1}`,
          questions,
          answers: {},
          answerNotes: {},
          stepIndex: 0,
          guidance: response.guidance,
        },
        completedBundles,
      }),
    });
    void Haptics.selectionAsync();
  }, [guided]);

  const executeFetchTemplateSummary = useCallback(
    async (completedBundles: readonly CompletedRoundBundle[]): Promise<GuidedDiagnosticOutcome> => {
      const client = clientRef.current;
      if (client === null || activeTemplate === null) {
        throw new Error('The app is still connecting to the diagnostic service.');
      }
      const response = await client.createDiagnosticTemplateSummary({
        templateName: activeTemplate.name,
        initialPrompt: guided.initialPrompt,
        rounds: toApiRoundsFromBundles(completedBundles),
      });
      return {
        mappedSituation: response.mappedSituation,
        advisorSummary: response.summaryForAdvisor,
      };
    },
    [activeTemplate, guided.initialPrompt],
  );

  useEffect(() => {
    let isMounted = true;
    async function hydrateSession(): Promise<void> {
      try {
        const deviceId = await readOrCreateDeviceId();
        if (!isMounted) {
          return;
        }
        clientRef.current = new DiagnosticApiClient({
          apiOrigin: config.apiBaseUrl,
          deviceId,
        });
        const [sessionPayload, diagnosticConfig] = await Promise.all([
          clientRef.current.fetchQuizSession(),
          clientRef.current.fetchDiagnosticConfig(),
        ]);
        if (!isMounted) {
          return;
        }
        setDiagnosticAiEnabled(diagnosticConfig.diagnosticAiEnabled);
        if (!diagnosticConfig.diagnosticAiEnabled) {
          const templatePayload = await clientRef.current.fetchActiveDiagnosticTemplate();
          if (!isMounted) {
            return;
          }
          setActiveTemplate(templatePayload.template);
        } else {
          setActiveTemplate(null);
        }
        setGuided(buildHydratedGuidedState(sessionPayload.session));
      } catch (error: unknown) {
        if (isMounted) {
          setErrorMessage(readErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsConfigReady(true);
          hasHydratedRef.current = true;
          setIsHydrated(true);
        }
      }
    }
    void hydrateSession();
    return () => {
      isMounted = false;
    };
  }, [config.apiBaseUrl]);

  useEffect(() => {
    if (!isHydrated || !isConfigReady || diagnosticAiEnabled || initialTemplateRound === null) {
      return;
    }
    setGuided((previous) => {
      if (
        previous.activeRound !== null ||
        previous.completedBundles.length > 0 ||
        previous.outcome !== null
      ) {
        return previous;
      }
      return {
        ...previous,
        initialPrompt: '',
        completedBundles: [],
        activeRound: initialTemplateRound,
        outcome: null,
      };
    });
  }, [diagnosticAiEnabled, initialTemplateRound, isConfigReady, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !hasHydratedRef.current) {
      return;
    }
    const timeoutHandle = setTimeout(() => {
      void executePersistGuided(guided, false).catch(() => {});
    }, 320);
    return () => clearTimeout(timeoutHandle);
  }, [executePersistGuided, guided, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        void executePersistGuided(guided, false).catch(() => {});
      }
    });
    return () => {
      subscription.remove();
    };
  }, [executePersistGuided, guided, isHydrated]);

  const executeUpdatePrompt = useCallback((value: string): void => {
    setErrorMessage(null);
    setGuided((previous) => ({
      ...previous,
      initialPrompt: value,
    }));
  }, []);

  const executeUsePromptSeed = useCallback((phrase: string): void => {
    setErrorMessage(null);
    setGuided((previous) => ({
      ...previous,
      initialPrompt: togglePromptWithSeed(previous.initialPrompt, phrase),
    }));
    void Haptics.selectionAsync();
  }, []);

  const executeSelectOption = useCallback((question: DiagnosticQuestionBlock, optionId: string): void => {
    setErrorMessage(null);
    setGuided((previous) => {
      if (previous.activeRound === null) {
        return previous;
      }
      const nextSelection = toggleQuestionOptionSelection({
        baseAnswers: buildDiagnosticAnswerLookup({
          completedBundles: previous.completedBundles,
          activeRound: previous.activeRound,
        }),
        question,
        selection: previous.activeRound.answers[question.id],
        optionId,
      });
      return {
        ...previous,
        activeRound: synchronizeActiveRound({
          activeRound: {
            ...previous.activeRound,
            answers: {
              ...previous.activeRound.answers,
              [question.id]: nextSelection,
            },
          },
          completedBundles: previous.completedBundles,
        }),
      };
    });
    void Haptics.selectionAsync();
  }, []);

  const executeSelectChildOption = useCallback(
    (question: DiagnosticQuestionBlock, parentOptionId: string, childOptionId: string): void => {
      setErrorMessage(null);
      setGuided((previous) => {
        if (previous.activeRound === null) {
          return previous;
        }
        const nextSelection = toggleChildQuestionOptionSelection({
          baseAnswers: buildDiagnosticAnswerLookup({
            completedBundles: previous.completedBundles,
            activeRound: previous.activeRound,
          }),
          question,
          selection: previous.activeRound.answers[question.id],
          parentOptionId,
          childOptionId,
        });
        return {
          ...previous,
          activeRound: synchronizeActiveRound({
            activeRound: {
              ...previous.activeRound,
              answers: {
                ...previous.activeRound.answers,
                [question.id]: nextSelection,
              },
            },
            completedBundles: previous.completedBundles,
          }),
        };
      });
      void Haptics.selectionAsync();
    },
    [],
  );

  const executeSetQuestionSelection = useCallback((questionId: string, nextSelection: DiagnosticQuestionSelection): void => {
    setErrorMessage(null);
    setGuided((previous) => {
      if (previous.activeRound === null) {
        return previous;
      }
      return {
        ...previous,
        activeRound: synchronizeActiveRound({
          activeRound: {
            ...previous.activeRound,
            answers: {
              ...previous.activeRound.answers,
              [questionId]: nextSelection,
            },
          },
          completedBundles: previous.completedBundles,
        }),
      };
    });
    void Haptics.selectionAsync();
  }, []);

  const executeUpdateAnswerNote = useCallback((questionId: string, value: string): void => {
    setGuided((previous) => {
      if (previous.activeRound === null) {
        return previous;
      }
      const nextValue = value.length > ANSWER_NOTE_LIMIT ? value.slice(0, ANSWER_NOTE_LIMIT) : value;
      return {
        ...previous,
        activeRound: {
          ...previous.activeRound,
          answerNotes: {
            ...previous.activeRound.answerNotes,
            [questionId]: nextValue,
          },
        },
      };
    });
  }, []);

  const executeStartDiagnostic = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    if (!diagnosticAiEnabled) {
      if (initialTemplateRound === null) {
        setErrorMessage('No active diagnostic template is available right now.');
        return;
      }
      setGuided((previous) => ({
        ...previous,
        initialPrompt: '',
        completedBundles: [],
        activeRound: initialTemplateRound,
        outcome: null,
      }));
      void Haptics.selectionAsync();
      return;
    }
    if (guided.initialPrompt.trim().length < MIN_PROMPT_LENGTH) {
      setErrorMessage(`Add a bit more detail first (at least ${MIN_PROMPT_LENGTH} characters).`);
      return;
    }
    setIsBusy(true);
    try {
      await executeFetchRound([]);
    } catch (error: unknown) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [diagnosticAiEnabled, executeFetchRound, guided.initialPrompt, initialTemplateRound]);

  const executeAdvance = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    const activeRound = synchronizeActiveRound({
      activeRound: guided.activeRound,
      completedBundles: guided.completedBundles,
    });
    if (activeRound === null) {
      return;
    }
    const currentQuestion = activeRound.questions[activeRound.stepIndex];
    if (currentQuestion === undefined) {
      return;
    }
    const validation = validateGuidedQuestionResponse({
      baseAnswers: buildDiagnosticAnswerLookup({
        completedBundles: guided.completedBundles,
        activeRound,
      }),
      question: currentQuestion,
      selection: activeRound.answers[currentQuestion.id],
      detailNote: activeRound.answerNotes[currentQuestion.id] ?? '',
    });
    if (!validation.isValid) {
      setErrorMessage(validation.message ?? 'Select an option or add a short note before continuing.');
      return;
    }
    const visibleQuestionIndexes = getVisibleQuestionIndexes({
      questions: activeRound.questions,
      baseAnswers: buildDiagnosticAnswerLookup({
        completedBundles: guided.completedBundles,
      }),
      answers: activeRound.answers,
    });
    const nextQuestionIndex = visibleQuestionIndexes.find((questionIndex) => questionIndex > activeRound.stepIndex) ?? null;
    if (nextQuestionIndex !== null) {
      setGuided({
        ...guided,
        activeRound: {
          ...activeRound,
          stepIndex: nextQuestionIndex,
        },
      });
      void Haptics.selectionAsync();
      return;
    }
    const completedBundle = buildVisibleBundleFromActive({
      activeRound,
      completedBundles: guided.completedBundles,
    });
    if (completedBundle === null) {
      return;
    }
    if (!diagnosticAiEnabled) {
      if (activeTemplate === null) {
        setErrorMessage('No active diagnostic template is available right now.');
        return;
      }
      const nextCompletedBundles = [...guided.completedBundles, completedBundle];
      const nextRound = synchronizeActiveRound({
        activeRound: buildNextTemplateRoundFromState({
          template: activeTemplate,
          completedBundles: nextCompletedBundles,
          startRoundIndex: activeRound.roundIndex + 1,
        }),
        completedBundles: nextCompletedBundles,
      });
      if (nextRound !== null) {
        setGuided({
          ...guided,
          completedBundles: nextCompletedBundles,
          activeRound: nextRound,
          outcome: null,
        });
        void Haptics.selectionAsync();
        return;
      }
      setIsBusy(true);
      try {
        const outcome = await executeFetchTemplateSummary(nextCompletedBundles);
        setGuided({
          ...guided,
          completedBundles: nextCompletedBundles,
          activeRound: null,
          outcome,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error: unknown) {
        setErrorMessage(readErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
      return;
    }
    setIsBusy(true);
    try {
      await executeFetchRound([...guided.completedBundles, completedBundle]);
    } catch (error: unknown) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [activeTemplate, diagnosticAiEnabled, executeFetchRound, executeFetchTemplateSummary, guided]);

  const executeGoBack = useCallback((): void => {
    setErrorMessage(null);
    setGuided((previous) => applyGuidedGoBack(previous));
    void Haptics.selectionAsync();
  }, []);

  const executeFinalizeDiagnostic = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    setIsBusy(true);
    try {
      await executePersistGuided(guided, true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      setErrorMessage(readErrorMessage(error));
      throw error;
    } finally {
      setIsBusy(false);
    }
  }, [executePersistGuided, guided]);

  const executeReset = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const resetGuided: GuidedDiagnosticV1 =
        !diagnosticAiEnabled && initialTemplateRound !== null
          ? {
              ...GUIDED_DIAGNOSTIC_EMPTY,
              activeRound: initialTemplateRound,
            }
          : GUIDED_DIAGNOSTIC_EMPTY;
      setGuided(resetGuided);
      await executePersistGuided(resetGuided, false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error: unknown) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [diagnosticAiEnabled, executePersistGuided, initialTemplateRound]);

  const progress = useMemo(() => buildDiagnosticProgress(guided), [guided]);
  const value = useMemo<DiagnosticFlowContextValue>(() => ({
    activeTemplateName: activeTemplate?.name ?? null,
    canGoBack: computeLinearStep(guided) > 1,
    diagnosticAiEnabled,
    errorMessage,
    hasUsableActiveTemplate: initialTemplateRound !== null,
    guided,
    isBusy,
    isConfigReady,
    isHydrated,
    progressHint: progress.hint,
    progressPercent: progress.percent,
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
  }), [
    activeTemplate?.name,
    errorMessage,
    diagnosticAiEnabled,
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
    initialTemplateRound,
    isBusy,
    isConfigReady,
    isHydrated,
    progress.hint,
    progress.percent,
  ]);

  return <DiagnosticFlowContext.Provider value={value}>{props.children}</DiagnosticFlowContext.Provider>;
}

/**
 * Reads the shared diagnostic-flow context for the current screen.
 */
export function useDiagnosticFlow(): DiagnosticFlowContextValue {
  const value = useContext(DiagnosticFlowContext);
  if (value === null) {
    throw new Error('useDiagnosticFlow must be used inside DiagnosticFlowProvider.');
  }
  return value;
}

function computeLinearStep(guided: GuidedDiagnosticV1): number {
  return computeGuidedLinearStep(guided);
}
