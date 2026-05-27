'use client';

import { Eye } from 'lucide-react';
import { useCallback, useState, type ReactElement } from 'react';
import { getAdminPrimaryActionButtonClass } from '@/components/admin/admin-settings-action-button-classes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError } from '@/lib/notify';

type TemplatePreview = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly subject: string;
  readonly html: string;
};

type AdminEmailTemplatePreviewDialogProps = {
  readonly bookingConfirmationSubject: string;
};

const EMAIL_TEMPLATE_PREVIEWS_API_URL = buildApiUrl('/api/admin/email-template-previews');

export function AdminEmailTemplatePreviewDialog(props: AdminEmailTemplatePreviewDialogProps): ReactElement {
  const { bookingConfirmationSubject } = props;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [templates, setTemplates] = useState<readonly TemplatePreview[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('booking_payment_confirmed');
  const executeLoadPreviews = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (bookingConfirmationSubject.trim().length > 0) {
        params.set('bookingConfirmationSubject', bookingConfirmationSubject.trim());
      }
      const query = params.toString();
      const url = query.length > 0 ? `${EMAIL_TEMPLATE_PREVIEWS_API_URL}?${query}` : EMAIL_TEMPLATE_PREVIEWS_API_URL;
      const response = await fetch(url);
      const data = (await response.json()) as { templates?: TemplatePreview[]; error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load email previews');
      }
      const nextTemplates = data.templates ?? [];
      setTemplates(nextTemplates);
      if (nextTemplates.length > 0) {
        setActiveTemplateId((currentId) =>
          nextTemplates.some((template) => template.id === currentId)
            ? currentId
            : (nextTemplates[0]?.id ?? 'booking_payment_confirmed'),
        );
      }
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to load email previews.');
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [bookingConfirmationSubject]);
  const handleOpenChange = useCallback(
    (open: boolean): void => {
      setIsOpen(open);
      if (open) {
        void executeLoadPreviews();
      }
    },
    [executeLoadPreviews],
  );
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? templates[0] ?? null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={getAdminPrimaryActionButtonClass('gap-2')}
        onClick={() => handleOpenChange(true)}
      >
        <Eye className="size-4" aria-hidden />
        Preview templates
      </Button>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[min(90dvh,880px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
            <DialogTitle className="text-base">Email template preview</DialogTitle>
            <DialogDescription>
              Sample data is used so you can see layout and branding. The booking confirmation subject reflects your
              current field value (including unsaved edits).
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading previews…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates available.</p>
            ) : (
              <Tabs
                value={activeTemplate?.id ?? templates[0]?.id}
                onValueChange={setActiveTemplateId}
                className="flex min-h-0 flex-1 flex-col gap-4"
              >
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
                  {templates.map((template) => (
                    <TabsTrigger key={template.id} value={template.id} className="text-xs sm:text-sm">
                      {template.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {templates.map((template) => (
                  <TabsContent key={template.id} value={template.id} className="mt-0 flex min-h-0 flex-1 flex-col gap-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">{template.description}</p>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                      <p className="mt-1 font-mono text-sm text-foreground">{template.subject}</p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-[#f4f4f5]">
                      <iframe
                        title={`${template.label} email preview`}
                        srcDoc={template.html}
                        sandbox=""
                        className="h-[min(52dvh,520px)] w-full border-0 bg-[#f4f4f5]"
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
