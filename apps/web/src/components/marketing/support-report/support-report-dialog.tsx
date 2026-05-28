'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { toast } from 'sonner';
import { AppImageLightbox } from '@/components/ui/app-image-lightbox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { captureViewportScreenshotBlob } from '@/lib/marketing/capture-viewport-screenshot';
import { buildPhilippineMobileE164FromNationalDigits, normalizePhilippineMobileNationalDigits } from '@/lib/marketing/philippine-profile-phone';
import { parseGuestSupportReportContact } from '@/lib/marketing/support-report-guest-contact';
import { submitSupportReport } from '@/lib/marketing/submit-support-report';
import { useSupportReport } from '@/components/marketing/support-report/support-report-context';

const MIN_MESSAGE_LENGTH = 3;
const AUTH_ME_URL = '/api/auth/me';

export function SupportReportDialog(): ReactElement {
  const { isDialogOpen, closeReportDialog } = useSupportReport();
  const pathname = usePathname();
  const [message, setMessage] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhoneNationalDigits, setReporterPhoneNationalDigits] = useState('');
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const resetForm = useCallback(() => {
    setMessage('');
    setReporterName('');
    setReporterEmail('');
    setReporterPhoneNationalDigits('');
    setIsGuest(null);
    setScreenshotBlob(null);
    setCaptureError(null);
    setScreenshotPreviewUrl((previous) => {
      if (previous !== null) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  }, []);
  const executeCapture = useCallback(async () => {
    setIsCapturing(true);
    setCaptureError(null);
    try {
      const blob = await captureViewportScreenshotBlob();
      setScreenshotBlob(blob);
      setScreenshotPreviewUrl((previous) => {
        if (previous !== null) {
          URL.revokeObjectURL(previous);
        }
        return URL.createObjectURL(blob);
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture screenshot.';
      setCaptureError(errorMessage);
      setScreenshotBlob(null);
    } finally {
      setIsCapturing(false);
    }
  }, []);
  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }
    queueMicrotask(() => {
      void executeCapture();
      void fetch(AUTH_ME_URL, { credentials: 'include' })
        .then((response) => response.json())
        .then((payload: { readonly user?: unknown }) => {
          setIsGuest(payload.user === null || payload.user === undefined);
        })
        .catch(() => {
          setIsGuest(true);
        });
    });
  }, [executeCapture, isDialogOpen]);
  useEffect(() => {
    if (isDialogOpen) {
      return;
    }
    queueMicrotask(() => {
      resetForm();
    });
  }, [isDialogOpen, resetForm]);
  const executeSubmit = async (): Promise<void> => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
      toast.error(`Please enter at least ${MIN_MESSAGE_LENGTH} characters.`);
      return;
    }
    let guestContact: { readonly reporterName: string; readonly reporterEmail: string; readonly reporterMobile: string } | null =
      null;
    if (isGuest === true) {
      const parsedContact = parseGuestSupportReportContact({
        reporterName,
        reporterEmail,
        reporterMobile: reporterPhoneNationalDigits,
      });
      if (!parsedContact.ok) {
        toast.error(parsedContact.error);
        return;
      }
      guestContact = parsedContact.contact;
    }
    setIsSubmitting(true);
    const result = await submitSupportReport({
      message: trimmedMessage,
      route: pathname,
      source: 'web',
      screenshot: screenshotBlob,
      reporterName: guestContact?.reporterName ?? null,
      reporterEmail: guestContact?.reporterEmail ?? null,
      reporterMobile: guestContact?.reporterMobile ?? null,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Report sent. Thank you for the feedback.');
    closeReportDialog();
  };
  const trimmedMessage = message.trim();
  const guestContactReady =
    isGuest !== true ||
    parseGuestSupportReportContact({
      reporterName,
      reporterEmail,
      reporterMobile: reporterPhoneNationalDigits,
    }).ok;
  const canSubmit =
    trimmedMessage.length >= MIN_MESSAGE_LENGTH &&
    guestContactReady &&
    isGuest !== null &&
    !isCapturing &&
    !isSubmitting;
  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeReportDialog()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            We capture what you see on screen right now and send it with your message to our team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Screenshot preview</Label>
            <div className="overflow-hidden rounded-md border border-border bg-muted/30">
              {isCapturing ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Capturing screen…</p>
              ) : screenshotPreviewUrl !== null ? (
                <AppImageLightbox
                  alt="Screenshot preview"
                  caption="Screenshot preview"
                  frameClassName="max-h-48 min-h-[120px]"
                  imageClassName="max-h-48"
                  src={screenshotPreviewUrl}
                  useNativeImg
                />
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {captureError ?? 'No screenshot captured.'}
                </p>
              )}
            </div>
            {captureError !== null ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void executeCapture()} disabled={isCapturing}>
                Retry capture
              </Button>
            ) : null}
          </div>
          {isGuest === true ? (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">Your contact details</p>
              <p className="text-xs text-muted-foreground">
                So we can follow up on your report. Sign in to skip this step next time.
              </p>
              <div className="space-y-2">
                <Label htmlFor="support-report-name">Full name</Label>
                <Input
                  id="support-report-name"
                  autoComplete="name"
                  value={reporterName}
                  onChange={(event) => setReporterName(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-report-email">Email</Label>
                <Input
                  id="support-report-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={reporterEmail}
                  onChange={(event) => setReporterEmail(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-report-mobile">Mobile number</Label>
                <p className="text-xs text-muted-foreground">Philippine mobile only (+63).</p>
                <div className="flex w-full rounded-md border border-input shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                  <span className="flex shrink-0 items-center border-r border-input bg-muted/60 px-3 text-sm font-medium text-muted-foreground">
                    +63
                  </span>
                  <Input
                    id="support-report-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="9xx xxx xxxx"
                    value={reporterPhoneNationalDigits}
                    onChange={(event) =>
                      setReporterPhoneNationalDigits(normalizePhilippineMobileNationalDigits(event.target.value))
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="support-report-message">Your message</Label>
            <Textarea
              id="support-report-message"
              placeholder="What went wrong? What were you trying to do?"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={closeReportDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void executeSubmit()} disabled={!canSubmit}>
            {isSubmitting ? 'Sending…' : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
