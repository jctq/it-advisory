/**
 * Shared visitor-session transport settings for browser and native clients.
 */
export const VISITOR_SESSION_CONFIG = {
  mobileDeviceIdHeaderName: 'x-device-id',
  maxVisitorIdLength: 200,
} as const;
