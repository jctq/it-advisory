import 'server-only';
import { Binary, ObjectId, type Collection, type Filter } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { SupportReportDocument, SupportReportReplyDocument } from '@/domain/support-report-types';
import {
  assertReporterCanSendFollowUp,
  computeSupportReportReporterReplyPolicy,
  type SupportReportReporterReplyPolicy,
} from '@/lib/data/support-report-reporter-reply-policy';
import { getSupportSettings, type SupportSettingsValues } from '@/lib/data/support-settings';
import { getDb } from '@/lib/mongodb';

const MAX_SUPPORT_REPORT_MESSAGE_LENGTH = 5000;
const MIN_SUPPORT_REPORT_MESSAGE_LENGTH = 3;
const MAX_SUPPORT_REPORT_REPLY_LENGTH = 5000;
const MIN_SUPPORT_REPORT_REPLY_LENGTH = 1;
const MAX_SUPPORT_REPORT_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const DEFAULT_ADMIN_LIST_LIMIT = 200;

const ALLOWED_SUPPORT_REPORT_SCREENSHOT_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type SupportReportSource = 'native' | 'web';

export type SupportReportReplyRecord = {
  readonly id: string;
  readonly message: string;
  readonly authorEmail: string;
  readonly isStaffReply: boolean;
  readonly createdAtIso: string;
};

export type SupportReportRecord = {
  readonly id: string;
  readonly message: string;
  readonly route: string;
  readonly source: SupportReportSource;
  readonly reporterEmail: string | null;
  readonly reporterUserId: string | null;
  readonly reporterName: string | null;
  readonly reporterMobile: string | null;
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly hasScreenshot: boolean;
  readonly replies: readonly SupportReportReplyRecord[];
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export type SupportReportUserListRow = {
  readonly id: string;
  readonly messagePreview: string;
  readonly route: string;
  readonly source: SupportReportSource;
  readonly hasScreenshot: boolean;
  readonly replyCount: number;
  readonly hasStaffReply: boolean;
  readonly hasUnreadStaffReply: boolean;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export type SupportReportListStatusFilter = 'all' | 'awaiting_reply' | 'has_reply';

export type SupportReportUserPage = {
  readonly reports: readonly SupportReportUserListRow[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasAnyReports: boolean;
  readonly unreadCount: number;
};

export type SupportReportAdminListRow = {
  readonly id: string;
  readonly messagePreview: string;
  readonly route: string;
  readonly source: SupportReportSource;
  readonly reporterEmail: string | null;
  readonly hasScreenshot: boolean;
  readonly replyCount: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

type SupportReportStoredDocument = SupportReportDocument & {
  readonly _id: ObjectId;
};

function mapReply(doc: SupportReportReplyDocument): SupportReportReplyRecord {
  return {
    id: doc._id.toString(),
    message: doc.message,
    authorEmail: doc.authorEmail,
    isStaffReply: doc.isStaffReply,
    createdAtIso: doc.createdAt.toISOString(),
  };
}

function mapSupportReport(doc: SupportReportStoredDocument): SupportReportRecord {
  const replies = Array.isArray(doc.replies) ? doc.replies.map(mapReply) : [];
  const updatedAt = doc.updatedAt instanceof Date ? doc.updatedAt : doc.createdAt;
  return {
    id: doc._id.toString(),
    message: doc.message,
    route: doc.route,
    source: doc.source,
    reporterEmail: doc.reporterEmail,
    reporterUserId: doc.reporterUserId ?? null,
    reporterName: doc.reporterName ?? null,
    reporterMobile: doc.reporterMobile ?? null,
    deviceId: doc.deviceId,
    userAgent: doc.userAgent,
    hasScreenshot: doc.screenshotData !== null && doc.screenshotByteLength !== null && doc.screenshotByteLength > 0,
    replies,
    createdAtIso: doc.createdAt.toISOString(),
    updatedAtIso: updatedAt.toISOString(),
  };
}

function resolveLatestStaffReplyAt(replies: readonly SupportReportReplyDocument[]): Date | null {
  let latest: Date | null = null;
  for (const reply of replies) {
    if (!reply.isStaffReply) {
      continue;
    }
    const createdAt = reply.createdAt instanceof Date ? reply.createdAt : null;
    if (createdAt === null) {
      continue;
    }
    if (latest === null || createdAt.getTime() > latest.getTime()) {
      latest = createdAt;
    }
  }
  return latest;
}

function resolveHasUnreadStaffReply(doc: SupportReportStoredDocument): boolean {
  const replies = Array.isArray(doc.replies) ? doc.replies : [];
  const latestStaffReplyAt = resolveLatestStaffReplyAt(replies);
  if (latestStaffReplyAt === null) {
    return false;
  }
  const lastReadAt = doc.reporterLastReadAt instanceof Date ? doc.reporterLastReadAt : null;
  if (lastReadAt === null) {
    return true;
  }
  return latestStaffReplyAt.getTime() > lastReadAt.getTime();
}

function buildMessagePreview(message: string): string {
  return message.length > 120 ? `${message.slice(0, 117).trimEnd()}…` : message;
}

function mapUserListRow(doc: SupportReportStoredDocument): SupportReportUserListRow {
  const record = mapSupportReport(doc);
  return {
    id: record.id,
    messagePreview: buildMessagePreview(record.message),
    route: record.route,
    source: record.source,
    hasScreenshot: record.hasScreenshot,
    replyCount: record.replies.length,
    hasStaffReply: record.replies.some((reply) => reply.isStaffReply),
    hasUnreadStaffReply: resolveHasUnreadStaffReply(doc),
    createdAtIso: record.createdAtIso,
    updatedAtIso: record.updatedAtIso,
  };
}

function mapAdminListRow(doc: SupportReportStoredDocument): SupportReportAdminListRow {
  const record = mapSupportReport(doc);
  return {
    id: record.id,
    messagePreview: buildMessagePreview(record.message),
    route: record.route,
    source: record.source,
    reporterEmail: record.reporterEmail,
    hasScreenshot: record.hasScreenshot,
    replyCount: record.replies.length,
    createdAtIso: record.createdAtIso,
    updatedAtIso: record.updatedAtIso,
  };
}

function buildReporterOwnershipFilter(input: {
  readonly userId: string;
  readonly email: string;
}): Filter<SupportReportDocument> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const orFilters: Filter<SupportReportDocument>[] = [{ reporterUserId: input.userId }];
  if (normalizedEmail.length > 0) {
    orFilters.push({ reporterEmail: normalizedEmail });
  }
  return { $or: orFilters };
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReporterListFilter(input: {
  readonly userId: string;
  readonly email: string;
  readonly search: string;
  readonly status: SupportReportListStatusFilter;
}): Filter<SupportReportDocument> {
  const ownershipFilter = buildReporterOwnershipFilter({ userId: input.userId, email: input.email });
  const filters: Filter<SupportReportDocument>[] = [ownershipFilter];
  const trimmedSearch = input.search.trim();
  if (trimmedSearch.length > 0) {
    const escapedSearch = escapeRegexLiteral(trimmedSearch);
    const searchRegex = { $regex: escapedSearch, $options: 'i' };
    const searchConditions: Filter<SupportReportDocument>[] = [{ message: searchRegex }, { route: searchRegex }];
    if (ObjectId.isValid(trimmedSearch)) {
      searchConditions.push({ _id: new ObjectId(trimmedSearch) });
    }
    filters.push({ $or: searchConditions });
  }
  if (input.status === 'awaiting_reply') {
    filters.push({
      $nor: [{ replies: { $elemMatch: { isStaffReply: true } } }],
    });
  } else if (input.status === 'has_reply') {
    filters.push({
      replies: { $elemMatch: { isStaffReply: true } },
    });
  }
  if (filters.length === 1) {
    return filters[0]!;
  }
  return { $and: filters };
}

async function getCollection(): Promise<Collection<SupportReportDocument>> {
  const db = await getDb();
  return db.collection<SupportReportDocument>(COLLECTIONS.supportReports);
}

export function getMaxSupportReportScreenshotBytes(): number {
  return MAX_SUPPORT_REPORT_SCREENSHOT_BYTES;
}

export function getMinSupportReportMessageLength(): number {
  return MIN_SUPPORT_REPORT_MESSAGE_LENGTH;
}

export function getMaxSupportReportMessageLength(): number {
  return MAX_SUPPORT_REPORT_MESSAGE_LENGTH;
}

export function getMinSupportReportReplyLength(): number {
  return MIN_SUPPORT_REPORT_REPLY_LENGTH;
}

export function getMaxSupportReportReplyLength(): number {
  return MAX_SUPPORT_REPORT_REPLY_LENGTH;
}

export function isAllowedSupportReportScreenshotContentType(contentType: string): boolean {
  return ALLOWED_SUPPORT_REPORT_SCREENSHOT_CONTENT_TYPES.has(contentType);
}

export async function createSupportReport(params: {
  readonly message: string;
  readonly route: string;
  readonly source: SupportReportSource;
  readonly reporterEmail: string | null;
  readonly reporterUserId: string | null;
  readonly reporterName: string | null;
  readonly reporterMobile: string | null;
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly screenshot: { readonly contentType: string; readonly buffer: Buffer } | null;
}): Promise<SupportReportRecord> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to submit support reports.');
  }
  const trimmedMessage = params.message.trim();
  if (trimmedMessage.length < MIN_SUPPORT_REPORT_MESSAGE_LENGTH) {
    throw new Error(`Message must be at least ${MIN_SUPPORT_REPORT_MESSAGE_LENGTH} characters.`);
  }
  if (trimmedMessage.length > MAX_SUPPORT_REPORT_MESSAGE_LENGTH) {
    throw new Error(`Message must be at most ${MAX_SUPPORT_REPORT_MESSAGE_LENGTH} characters.`);
  }
  const trimmedRoute = params.route.trim();
  if (trimmedRoute.length === 0) {
    throw new Error('Route is required.');
  }
  if (trimmedRoute.length > 2048) {
    throw new Error('Route is too long.');
  }
  let screenshotContentType: string | null = null;
  let screenshotData: Binary | null = null;
  let screenshotByteLength: number | null = null;
  if (params.screenshot !== null) {
    if (!isAllowedSupportReportScreenshotContentType(params.screenshot.contentType)) {
      throw new Error('Unsupported screenshot type. Use JPEG, PNG, or WebP.');
    }
    if (params.screenshot.buffer.byteLength === 0) {
      throw new Error('Screenshot file is empty.');
    }
    if (params.screenshot.buffer.byteLength > MAX_SUPPORT_REPORT_SCREENSHOT_BYTES) {
      throw new Error('Screenshot is too large. Maximum size is 5 MB.');
    }
    screenshotContentType = params.screenshot.contentType;
    screenshotData = new Binary(params.screenshot.buffer);
    screenshotByteLength = params.screenshot.buffer.byteLength;
  }
  const collection = await getCollection();
  const now = new Date();
  const doc: SupportReportDocument = {
    message: trimmedMessage,
    route: trimmedRoute,
    source: params.source,
    reporterEmail: params.reporterEmail,
    reporterUserId: params.reporterUserId,
    reporterName: params.reporterName,
    reporterMobile: params.reporterMobile,
    deviceId: params.deviceId,
    userAgent: params.userAgent,
    screenshotContentType,
    screenshotData,
    screenshotByteLength,
    replies: [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection.insertOne(doc);
  return mapSupportReport({ ...doc, _id: result.insertedId });
}

export async function listSupportReportsForAdmin(
  limit: number = DEFAULT_ADMIN_LIST_LIMIT,
): Promise<readonly SupportReportAdminListRow[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const collection = await getCollection();
  const docs = await collection.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs
    .filter((doc): doc is SupportReportStoredDocument => doc._id !== undefined)
    .map((doc) => mapAdminListRow(doc as SupportReportStoredDocument));
}

export async function listSupportReportsForReporter(input: {
  readonly userId: string;
  readonly email: string;
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: SupportReportListStatusFilter;
}): Promise<SupportReportUserPage> {
  if (!process.env.MONGODB_URI) {
    return {
      reports: [],
      totalCount: 0,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: 0,
      hasAnyReports: false,
      unreadCount: 0,
    };
  }
  const page = Math.max(1, input.page);
  const pageSize = Math.min(50, Math.max(1, input.pageSize));
  const search = input.search?.trim() ?? '';
  const status = input.status ?? 'all';
  const ownershipFilter = buildReporterOwnershipFilter({ userId: input.userId, email: input.email });
  const listFilter = buildReporterListFilter({
    userId: input.userId,
    email: input.email,
    search,
    status,
  });
  const collection = await getCollection();
  const [hasAnyReports, unreadCount, totalCount, docs] = await Promise.all([
    collection.countDocuments(ownershipFilter, { limit: 1 }).then((count) => count > 0),
    countUnreadSupportReportsForReporter({ userId: input.userId, email: input.email }),
    collection.countDocuments(listFilter),
    collection
      .find(listFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
  ]);
  const reports = docs
    .filter((doc): doc is SupportReportStoredDocument => doc._id !== undefined)
    .map((doc) => mapUserListRow(doc as SupportReportStoredDocument));
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  return {
    reports,
    totalCount,
    page,
    pageSize,
    totalPages,
    hasAnyReports,
    unreadCount,
  };
}

export async function countUnreadSupportReportsForReporter(input: {
  readonly userId: string;
  readonly email: string;
}): Promise<number> {
  if (!process.env.MONGODB_URI) {
    return 0;
  }
  const ownershipFilter = buildReporterOwnershipFilter({ userId: input.userId, email: input.email });
  const collection = await getCollection();
  const docs = await collection
    .find(ownershipFilter, { projection: { replies: 1, reporterLastReadAt: 1 } })
    .toArray();
  return docs.filter((doc): doc is SupportReportStoredDocument => doc._id !== undefined).filter((doc) =>
    resolveHasUnreadStaffReply(doc as SupportReportStoredDocument),
  ).length;
}

export async function markSupportReportReadByReporter(input: {
  readonly reportId: string;
  readonly userId: string;
  readonly email: string;
}): Promise<void> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(input.reportId)) {
    return;
  }
  const collection = await getCollection();
  await collection.updateOne(
    {
      $and: [{ _id: new ObjectId(input.reportId) }, buildReporterOwnershipFilter({ userId: input.userId, email: input.email })],
    },
    { $set: { reporterLastReadAt: new Date() } },
  );
}

export async function findSupportReportByIdForReporter(input: {
  readonly reportId: string;
  readonly userId: string;
  readonly email: string;
}): Promise<SupportReportRecord | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(input.reportId)) {
    return null;
  }
  const collection = await getCollection();
  const filter: Filter<SupportReportDocument> = {
    $and: [{ _id: new ObjectId(input.reportId) }, buildReporterOwnershipFilter({ userId: input.userId, email: input.email })],
  };
  const doc = await collection.findOne(filter);
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return mapSupportReport(doc as SupportReportStoredDocument);
}

export async function isSupportReportOwnedByReporter(input: {
  readonly reportId: string;
  readonly userId: string;
  readonly email: string;
}): Promise<boolean> {
  const report = await findSupportReportByIdForReporter(input);
  return report !== null;
}

export async function findSupportReportByIdForAdmin(reportId: string): Promise<SupportReportRecord | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(reportId)) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne({ _id: new ObjectId(reportId) });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return mapSupportReport(doc as SupportReportStoredDocument);
}

export async function addStaffReplyToSupportReport(params: {
  readonly reportId: string;
  readonly message: string;
  readonly staffEmail: string;
}): Promise<SupportReportRecord | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(params.reportId)) {
    return null;
  }
  const trimmedMessage = params.message.trim();
  if (trimmedMessage.length < MIN_SUPPORT_REPORT_REPLY_LENGTH) {
    throw new Error(`Reply must be at least ${MIN_SUPPORT_REPORT_REPLY_LENGTH} character.`);
  }
  if (trimmedMessage.length > MAX_SUPPORT_REPORT_REPLY_LENGTH) {
    throw new Error(`Reply must be at most ${MAX_SUPPORT_REPORT_REPLY_LENGTH} characters.`);
  }
  const staffEmail = params.staffEmail.trim().toLowerCase();
  if (staffEmail.length === 0) {
    throw new Error('Staff email is required.');
  }
  const reply: SupportReportReplyDocument = {
    _id: new ObjectId(),
    message: trimmedMessage,
    authorEmail: staffEmail,
    isStaffReply: true,
    createdAt: new Date(),
  };
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(params.reportId) },
    {
      $push: { replies: reply },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' },
  );
  if (result === null || result._id === undefined) {
    return null;
  }
  return mapSupportReport(result as SupportReportStoredDocument);
}

export async function addReporterReplyToSupportReport(params: {
  readonly reportId: string;
  readonly userId: string;
  readonly email: string;
  readonly message: string;
  readonly settings?: SupportSettingsValues;
}): Promise<{ readonly report: SupportReportRecord; readonly replyPolicy: SupportReportReporterReplyPolicy } | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(params.reportId)) {
    return null;
  }
  const existing = await findSupportReportByIdForReporter({
    reportId: params.reportId,
    userId: params.userId,
    email: params.email,
  });
  if (existing === null) {
    return null;
  }
  const settings = params.settings ?? (await getSupportSettings());
  assertReporterCanSendFollowUp(existing, settings);
  const trimmedMessage = params.message.trim();
  if (trimmedMessage.length < MIN_SUPPORT_REPORT_REPLY_LENGTH) {
    throw new Error(`Reply must be at least ${MIN_SUPPORT_REPORT_REPLY_LENGTH} character.`);
  }
  if (trimmedMessage.length > MAX_SUPPORT_REPORT_REPLY_LENGTH) {
    throw new Error(`Reply must be at most ${MAX_SUPPORT_REPORT_REPLY_LENGTH} characters.`);
  }
  const reporterEmail = params.email.trim().toLowerCase();
  if (reporterEmail.length === 0) {
    throw new Error('Reporter email is required.');
  }
  const reply: SupportReportReplyDocument = {
    _id: new ObjectId(),
    message: trimmedMessage,
    authorEmail: reporterEmail,
    isStaffReply: false,
    createdAt: new Date(),
  };
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    {
      $and: [{ _id: new ObjectId(params.reportId) }, buildReporterOwnershipFilter({ userId: params.userId, email: params.email })],
    },
    {
      $push: { replies: reply },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' },
  );
  if (result === null || result._id === undefined) {
    return null;
  }
  const report = mapSupportReport(result as SupportReportStoredDocument);
  const replyPolicy = computeSupportReportReporterReplyPolicy(report, settings);
  return { report, replyPolicy };
}

export async function readSupportReportScreenshotBuffer(reportId: string): Promise<{
  readonly contentType: string;
  readonly buffer: Buffer;
} | null> {
  if (!process.env.MONGODB_URI || !ObjectId.isValid(reportId)) {
    return null;
  }
  const collection = await getCollection();
  const doc = await collection.findOne(
    { _id: new ObjectId(reportId) },
    { projection: { screenshotContentType: 1, screenshotData: 1, screenshotByteLength: 1 } },
  );
  if (
    doc === null ||
    doc.screenshotData === undefined ||
    doc.screenshotData === null ||
    doc.screenshotContentType === undefined ||
    doc.screenshotContentType === null ||
    doc.screenshotByteLength === null ||
    doc.screenshotByteLength <= 0
  ) {
    return null;
  }
  return {
    contentType: doc.screenshotContentType,
    buffer: Buffer.from(doc.screenshotData.buffer),
  };
}
