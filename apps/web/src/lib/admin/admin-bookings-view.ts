export type BookingsViewMode = 'table' | 'calendar';

export function resolveBookingsViewMode(value: string | undefined): BookingsViewMode {
  if (value === 'calendar') {
    return 'calendar';
  }
  return 'table';
}
