import { DiagnosticApiClient } from '@it-advisory/api-client/diagnostic-api-client';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  applyGuidedGoBack,
  computeGuidedLinearStep,
  normalizeDiagnosticOptionLabels,
  parseGuidedDiagnosticJson,
  toApiRoundsFromBundles,
  type CompletedRoundBundle,
  type DiagnosticQuestionBlock,
  type GuidedDiagnosticOutcome,
  type GuidedDiagnosticV1,
} from '@it-advisory/diagnostic-core/guided-diagnostic-types';
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
  buildCompletedRoundBundle,
  buildCurrentAnswerText,
  buildDiagnosticProgress,
  buildQuizAnswersPayload,
  MIN_PROMPT_LENGTH,
  normalizeGuidedDiagnosticRaw,
  togglePromptWithSeed,
} from '../lib/diagnostic-flow';
import { readNativeAppConfig } from '../lib/native-app-config';

type DiagnosticFlowContextValue = {
  readonly canGoBack: boolean;
  readonly errorMessage: string | null;
  readonly guided: GuidedDiagnosticV1;
  readonly isBusy: boolean;
  readonly isHydrated: boolean;
  readonly progressHint: string;
  readonly progressPercent: number;
  executeAdvance(): Promise<void>;
  executeFinalizeDiagnostic(): Promise<void>;
  executeGoBack(): void;
  executeReset(): Promise<void>;
  executeSelectOption(questionId: string, option: string): void;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        ? normalizeDiagnosticOptionLabels(question.options)
        : [];
      if (!hasPrompt || options.length === 0) {
        return [];
      }
      return [
        {
          id: hasQuestionId ? question.id.trim() : `question-${index + 1}`,
          prompt: question.prompt.trim(),
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
      activeRound: {
        roundIndex: completedBundles.length,
        questions,
        answers: {},
        answerNotes: {},
        stepIndex: 0,
        guidance: response.guidance,
      },
    });
    void Haptics.selectionAsync();
  }, [guided]);

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
        const sessionPayload = await clientRef.current.fetchQuizSession();
        if (!isMounted) {
          return;
        }
        setGuided(buildHydratedGuidedState(sessionPayload.session));
      } catch (error: unknown) {
        if (isMounted) {
          setErrorMessage(readErrorMessage(error));
        }
      } finally {
        if (isMounted) {
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

  const executeSelectOption = useCallback((questionId: string, option: string): void => {
    setErrorMessage(null);
    setGuided((previous) => {
      if (previous.activeRound === null) {
        return previous;
      }
      return {
        ...previous,
        activeRound: {
          ...previous.activeRound,
          answers: {
            ...previous.activeRound.answers,
            [questionId]: option,
          },
        },
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
  }, [executeFetchRound, guided.initialPrompt]);

  const executeAdvance = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    if (guided.activeRound === null) {
      return;
    }
    const currentAnswer = buildCurrentAnswerText(guided);
    if (currentAnswer.length === 0) {
      setErrorMessage('Select an option or add a short note before continuing.');
      return;
    }
    const activeRound = guided.activeRound;
    const isLastQuestion = activeRound.stepIndex >= activeRound.questions.length - 1;
    if (!isLastQuestion) {
      setGuided({
        ...guided,
        activeRound: {
          ...activeRound,
          stepIndex: activeRound.stepIndex + 1,
        },
      });
      void Haptics.selectionAsync();
      return;
    }
    const completedBundle = buildCompletedRoundBundle(activeRound);
    if (completedBundle === null) {
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
  }, [executeFetchRound, guided]);

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
      setGuided(GUIDED_DIAGNOSTIC_EMPTY);
      await executePersistGuided(GUIDED_DIAGNOSTIC_EMPTY, false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error: unknown) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [executePersistGuided]);

  const progress = useMemo(() => buildDiagnosticProgress(guided), [guided]);
  const value = useMemo<DiagnosticFlowContextValue>(() => ({
    canGoBack: computeLinearStep(guided) > 0,
    errorMessage,
    guided,
    isBusy,
    isHydrated,
    progressHint: progress.hint,
    progressPercent: progress.percent,
    executeAdvance,
    executeFinalizeDiagnostic,
    executeGoBack,
    executeReset,
    executeSelectOption,
    executeStartDiagnostic,
    executeUpdateAnswerNote,
    executeUpdatePrompt,
    executeUsePromptSeed,
  }), [
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
