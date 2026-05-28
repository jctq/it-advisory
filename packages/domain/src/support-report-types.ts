import type { Binary, ObjectId } from 'mongodb';

/** Staff or reporter message on a support report thread. */
export type SupportReportReplyDocument = {
  _id: ObjectId;
  message: string;
  authorEmail: string;
  isStaffReply: boolean;
  createdAt: Date;
};

/** User-submitted issue report with optional screenshot (native or web). */
export type SupportReportDocument = {
  _id?: ObjectId;
  message: string;
  route: string;
  source: 'native' | 'web';
  reporterEmail: string | null;
  reporterUserId: string | null;
  reporterName: string | null;
  reporterMobile: string | null;
  deviceId: string | null;
  userAgent: string | null;
  screenshotContentType: string | null;
  screenshotData: Binary | null;
  screenshotByteLength: number | null;
  replies: readonly SupportReportReplyDocument[];
  /** When the reporter last opened this thread (used for unread staff reply badges). */
  reporterLastReadAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
