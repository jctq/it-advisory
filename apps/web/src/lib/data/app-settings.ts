import { COLLECTIONS } from '@/domain/collections';
import {
  DIAGNOSTIC_MAX_ROUNDS_MAX,
  DIAGNOSTIC_MAX_ROUNDS_MIN,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
} from '@/domain/diagnostic-settings-bounds';
import type { AppSettingsDocument } from '@/domain/types';
import { getDb } from '@/lib/mongodb';

export const APP_SETTINGS_DOCUMENT_ID = 'app';

export type AppSettingsValues = {
  readonly diagnosticAiEnabled: boolean;
  readonly diagnosticManageBookingEnabled: boolean;
  readonly diagnosticMaxRounds: number;
  readonly diagnosticQuestionsPerRound: number;
  readonly diagnosticOptionsPerQuestion: number;
  readonly diagnosticCacheDebugEnabled: boolean;
};

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    return fallback;
  }
  return rounded;
}

function defaultSettings(): AppSettingsValues {
  return {
    diagnosticAiEnabled: false,
    diagnosticManageBookingEnabled: false,
    diagnosticMaxRounds: 4,
    diagnosticQuestionsPerRound: 5,
    diagnosticOptionsPerQuestion: 4,
    diagnosticCacheDebugEnabled: false,
  };
}

function mergeDocument(doc: AppSettingsDocument | null): AppSettingsValues {
  const base = defaultSettings();
  if (doc === null) {
    return base;
  }
  return {
    diagnosticAiEnabled:
      typeof doc.diagnosticAiEnabled === 'boolean' ? doc.diagnosticAiEnabled : base.diagnosticAiEnabled,
    diagnosticManageBookingEnabled:
      typeof doc.diagnosticManageBookingEnabled === 'boolean'
        ? doc.diagnosticManageBookingEnabled
        : base.diagnosticManageBookingEnabled,
    diagnosticMaxRounds: clampInt(
      doc.diagnosticMaxRounds,
      DIAGNOSTIC_MAX_ROUNDS_MIN,
      DIAGNOSTIC_MAX_ROUNDS_MAX,
      base.diagnosticMaxRounds,
    ),
    diagnosticQuestionsPerRound: clampInt(
      doc.diagnosticQuestionsPerRound,
      DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
      DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX,
      base.diagnosticQuestionsPerRound,
    ),
    diagnosticOptionsPerQuestion: clampInt(
      doc.diagnosticOptionsPerQuestion ?? Number.NaN,
      DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
      DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX,
      base.diagnosticOptionsPerQuestion,
    ),
    diagnosticCacheDebugEnabled:
      typeof doc.diagnosticCacheDebugEnabled === 'boolean'
        ? doc.diagnosticCacheDebugEnabled
        : base.diagnosticCacheDebugEnabled,
  };
}

/**
 * Loads persisted admin settings or defaults (including dev-only cache-debug default when no row exists).
 */
export async function getAppSettings(): Promise<AppSettingsValues> {
  const db = await getDb();
  const doc = await db
    .collection<AppSettingsDocument>(COLLECTIONS.appSettings)
    .findOne({ _id: APP_SETTINGS_DOCUMENT_ID });
  return mergeDocument(doc);
}

export async function updateAppSettings(patch: Partial<AppSettingsValues>): Promise<AppSettingsValues> {
  const current = await getAppSettings();
  const next: AppSettingsValues = {
    diagnosticAiEnabled:
      patch.diagnosticAiEnabled !== undefined ? patch.diagnosticAiEnabled : current.diagnosticAiEnabled,
    diagnosticManageBookingEnabled:
      patch.diagnosticManageBookingEnabled !== undefined
        ? patch.diagnosticManageBookingEnabled
        : current.diagnosticManageBookingEnabled,
    diagnosticMaxRounds:
      patch.diagnosticMaxRounds !== undefined
        ? clampInt(
            patch.diagnosticMaxRounds,
            DIAGNOSTIC_MAX_ROUNDS_MIN,
            DIAGNOSTIC_MAX_ROUNDS_MAX,
            current.diagnosticMaxRounds,
          )
        : current.diagnosticMaxRounds,
    diagnosticQuestionsPerRound:
      patch.diagnosticQuestionsPerRound !== undefined
        ? clampInt(
            patch.diagnosticQuestionsPerRound,
            DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
            DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX,
            current.diagnosticQuestionsPerRound,
          )
        : current.diagnosticQuestionsPerRound,
    diagnosticOptionsPerQuestion:
      patch.diagnosticOptionsPerQuestion !== undefined
        ? clampInt(
            patch.diagnosticOptionsPerQuestion,
            DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
            DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX,
            current.diagnosticOptionsPerQuestion,
          )
        : current.diagnosticOptionsPerQuestion,
    diagnosticCacheDebugEnabled:
      patch.diagnosticCacheDebugEnabled !== undefined
        ? patch.diagnosticCacheDebugEnabled
        : current.diagnosticCacheDebugEnabled,
  };
  const db = await getDb();
  const row: AppSettingsDocument = {
    _id: APP_SETTINGS_DOCUMENT_ID,
    ...next,
    updatedAt: new Date(),
  };
  await db.collection<AppSettingsDocument>(COLLECTIONS.appSettings).replaceOne({ _id: APP_SETTINGS_DOCUMENT_ID }, row, {
    upsert: true,
  });
  return next;
}
