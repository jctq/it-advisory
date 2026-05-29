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
import { readEnvSiteName, resolveSiteName } from '@/lib/site/site-name';

export const APP_SETTINGS_DOCUMENT_ID = 'app';

export type AppSettingsValues = {
  readonly siteName: string;
  readonly diagnosticAiEnabled: boolean;
  readonly diagnosticManageBookingEnabled: boolean;
  readonly supportModuleEnabled: boolean;
  readonly bookingSessionRoomLinksEnabled: boolean;
  readonly diagnosticMaxRounds: number;
  readonly diagnosticQuestionsPerRound: number;
  readonly diagnosticOptionsPerQuestion: number;
  readonly diagnosticCacheDebugEnabled: boolean;
};

export type AppSettingsAdminView = AppSettingsValues & {
  readonly siteNameEnvDefault: string;
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
    siteName: '',
    diagnosticAiEnabled: false,
    diagnosticManageBookingEnabled: false,
    supportModuleEnabled: false,
    bookingSessionRoomLinksEnabled: true,
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
    siteName: typeof doc.siteName === 'string' ? doc.siteName : base.siteName,
    diagnosticAiEnabled:
      typeof doc.diagnosticAiEnabled === 'boolean' ? doc.diagnosticAiEnabled : base.diagnosticAiEnabled,
    diagnosticManageBookingEnabled:
      typeof doc.diagnosticManageBookingEnabled === 'boolean'
        ? doc.diagnosticManageBookingEnabled
        : base.diagnosticManageBookingEnabled,
    supportModuleEnabled:
      typeof doc.supportModuleEnabled === 'boolean' ? doc.supportModuleEnabled : base.supportModuleEnabled,
    bookingSessionRoomLinksEnabled:
      typeof doc.bookingSessionRoomLinksEnabled === 'boolean'
        ? doc.bookingSessionRoomLinksEnabled
        : base.bookingSessionRoomLinksEnabled,
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
  if (!process.env.MONGODB_URI) {
    return defaultSettings();
  }
  const db = await getDb();
  const doc = await db
    .collection<AppSettingsDocument>(COLLECTIONS.appSettings)
    .findOne({ _id: APP_SETTINGS_DOCUMENT_ID });
  return mergeDocument(doc);
}

export async function getResolvedSiteName(): Promise<string> {
  const settings = await getAppSettings();
  return resolveSiteName(settings.siteName);
}

export async function getAppSettingsAdminView(): Promise<AppSettingsAdminView> {
  const settings = await getAppSettings();
  return {
    ...settings,
    siteNameEnvDefault: readEnvSiteName(),
  };
}

export async function updateAppSettings(patch: Partial<AppSettingsValues>): Promise<AppSettingsValues> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to save app settings.');
  }
  const current = await getAppSettings();
  const next: AppSettingsValues = {
    siteName: patch.siteName !== undefined ? patch.siteName.trim() : current.siteName,
    diagnosticAiEnabled:
      patch.diagnosticAiEnabled !== undefined ? patch.diagnosticAiEnabled : current.diagnosticAiEnabled,
    diagnosticManageBookingEnabled:
      patch.diagnosticManageBookingEnabled !== undefined
        ? patch.diagnosticManageBookingEnabled
        : current.diagnosticManageBookingEnabled,
    supportModuleEnabled:
      patch.supportModuleEnabled !== undefined ? patch.supportModuleEnabled : current.supportModuleEnabled,
    bookingSessionRoomLinksEnabled:
      patch.bookingSessionRoomLinksEnabled !== undefined
        ? patch.bookingSessionRoomLinksEnabled
        : current.bookingSessionRoomLinksEnabled,
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
