export type AdminBookingOverviewContext = {
  readonly bookingReference: string;
  readonly serviceTitle: string;
  readonly sessionTitlePreview: string | null;
  readonly contactName: string;
  readonly contactEmail: string | null;
  readonly contactCompany: string | null;
  readonly contactPhone: string | null;
  readonly isGuestBooking: boolean;
  readonly accountEmail: string | null;
};
