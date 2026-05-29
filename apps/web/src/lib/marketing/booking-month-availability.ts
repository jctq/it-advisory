export function resolveSlotCountForManilaYmd(
  availabilityByDate: Readonly<Record<string, readonly string[]>>,
  manilaYmd: string,
): number {
  return availabilityByDate[manilaYmd]?.length ?? 0;
}

export function formatSlotsLeftLabel(slotCount: number): string {
  if (slotCount === 1) {
    return '1 slot left';
  }
  return `${slotCount} slots left`;
}
