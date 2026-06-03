import { describe, expect, it } from 'vitest';
import {
  computeDiagnosticSessionPersistPayloadHash,
  computeGuidedPersistCheckpointKey,
  resolveDiagnosticSessionPersistDebounceMs,
  type DiagnosticSessionPersistRequest,
} from './diagnostic-session-persist';
import { GUIDED_DIAGNOSTIC_EMPTY, type GuidedDiagnosticV1 } from '@/lib/marketing/guided-diagnostic-types';

function buildPersistRequest(guided: GuidedDiagnosticV1): DiagnosticSessionPersistRequest {
  return {
    guided,
    sessionTargetId: null,
    persistedSessionRef: null,
    hasEverCompleted: false,
  };
}

describe('diagnostic session persist', () => {
  it('uses the same checkpoint when only answer notes change on a step', () => {
    const base: GuidedDiagnosticV1 = {
      ...GUIDED_DIAGNOSTIC_EMPTY,
      activeRound: {
        roundIndex: 0,
        roundTitle: 'Round 1',
        guidance: null,
        stepIndex: 1,
        questions: [],
        answers: {},
        answerNotes: {},
      },
    };
    const withNote: GuidedDiagnosticV1 = {
      ...base,
      activeRound:
        base.activeRound === null
          ? null
          : {
              ...base.activeRound,
              answerNotes: { q1: 'More context about the rollout' },
            },
    };
    expect(computeGuidedPersistCheckpointKey(base)).toBe(computeGuidedPersistCheckpointKey(withNote));
  });

  it('changes checkpoint when the active step index advances', () => {
    const stepZero: GuidedDiagnosticV1 = {
      ...GUIDED_DIAGNOSTIC_EMPTY,
      activeRound: {
        roundIndex: 0,
        roundTitle: 'Round 1',
        guidance: null,
        stepIndex: 0,
        questions: [],
        answers: {},
        answerNotes: {},
      },
    };
    const stepOne: GuidedDiagnosticV1 = {
      ...stepZero,
      activeRound:
        stepZero.activeRound === null
          ? null
          : {
              ...stepZero.activeRound,
              stepIndex: 1,
            },
    };
    expect(computeGuidedPersistCheckpointKey(stepZero)).not.toBe(computeGuidedPersistCheckpointKey(stepOne));
  });

  it('uses a longer debounce while the visitor is still on the describe step', () => {
    const describePhase: GuidedDiagnosticV1 = {
      ...GUIDED_DIAGNOSTIC_EMPTY,
      initialPrompt: 'Our ERP rollout is stuck',
    };
    const inRound: GuidedDiagnosticV1 = {
      ...describePhase,
      activeRound: {
        roundIndex: 0,
        roundTitle: 'Round 1',
        guidance: null,
        stepIndex: 0,
        questions: [],
        answers: {},
        answerNotes: {},
      },
    };
    expect(resolveDiagnosticSessionPersistDebounceMs(describePhase)).toBeGreaterThan(
      resolveDiagnosticSessionPersistDebounceMs(inRound),
    );
  });

  it('deduplicates identical persist payloads', () => {
    const guided: GuidedDiagnosticV1 = {
      ...GUIDED_DIAGNOSTIC_EMPTY,
      initialPrompt: 'Need help untangling vendor delivery',
    };
    const request = buildPersistRequest(guided);
    expect(computeDiagnosticSessionPersistPayloadHash(request)).toBe(
      computeDiagnosticSessionPersistPayloadHash(request),
    );
  });
});
