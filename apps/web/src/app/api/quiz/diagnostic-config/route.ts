import { NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/data/app-settings';

/**
 * Public read-only diagnostic tuning for the guided quiz UI (cache debug visibility, display hints).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getAppSettings();
    return NextResponse.json({
      diagnosticAiEnabled: settings.diagnosticAiEnabled,
      diagnosticMaxRounds: settings.diagnosticMaxRounds,
      diagnosticQuestionsPerRound: settings.diagnosticQuestionsPerRound,
      diagnosticOptionsPerQuestion: settings.diagnosticOptionsPerQuestion,
      diagnosticCacheDebugEnabled: settings.diagnosticCacheDebugEnabled,
    });
  } catch {
    return NextResponse.json(
      {
        diagnosticAiEnabled: false,
        diagnosticMaxRounds: 4,
        diagnosticQuestionsPerRound: 5,
        diagnosticOptionsPerQuestion: 4,
        diagnosticCacheDebugEnabled: false,
      },
      { status: 200 },
    );
  }
}
