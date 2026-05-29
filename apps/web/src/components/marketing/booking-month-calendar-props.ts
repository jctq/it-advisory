export type BookingMonthFullCalendarProps = {
  readonly visibleManilaYearMonth: string;
  readonly availabilityByDate: Readonly<Record<string, readonly string[]>>;
  readonly availabilityReady: boolean;
  /** Confirmed booking day (date + time chosen). */
  readonly selectedManilaYmd: string | null;
  /** Day whose time list is open in the dialog (subtle emphasis until confirmed). */
  readonly pendingManilaYmd: string | null;
  readonly onSelectDateWithSlots: (manilaYmd: string) => void;
};
