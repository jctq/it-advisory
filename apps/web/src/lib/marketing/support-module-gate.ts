import { NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/data/app-settings';

/**
 * Whether the public support report module is enabled (admin general setting).
 */
export async function readSupportModuleEnabled(): Promise<boolean> {
  const settings = await getAppSettings();
  return settings.supportModuleEnabled;
}

/**
 * Returns a 403 response when the support module is disabled, or null when allowed.
 */
export async function assertSupportModuleEnabled(): Promise<NextResponse | null> {
  if (!(await readSupportModuleEnabled())) {
    return NextResponse.json(
      { error: 'Support reports are not available.', code: 'support_module_disabled' },
      { status: 403 },
    );
  }
  return null;
}
