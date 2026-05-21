'use client';

import {
  closeImageDialog$,
  imageDialogState$,
  imageUploadHandler$,
  saveImage$,
} from '@mdxeditor/editor';
import { useCellValues, usePublisher } from '@mdxeditor/gurx';
import { ImageIcon, Loader2, Upload } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
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
import { uploadBlogImage } from '@/lib/blog-image-upload';
import { cn } from '@/lib/utils';

const MAX_BLOG_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_BLOG_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

type ImageDialogFormState = {
  readonly src: string;
  readonly altText: string;
  readonly title: string;
};

const EMPTY_FORM: ImageDialogFormState = {
  src: '',
  altText: '',
  title: '',
};

function validateImageFile(file: File): string | null {
  if (!ALLOWED_BLOG_IMAGE_TYPES.has(file.type)) {
    return 'Use JPEG, PNG, GIF, or WebP.';
  }
  if (file.size > MAX_BLOG_IMAGE_BYTES) {
    return 'Image is too large. Maximum size is 5 MB.';
  }
  return null;
}

function readFilePreview(file: File, onLoad: (url: string) => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      onLoad(reader.result);
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Replaces MDXEditor's default image dialog with an admin-styled upload flow.
 */
export function AdminBlogImageDialog(): ReactElement | null {
  const [dialogState, imageUploadHandler] = useCellValues(imageDialogState$, imageUploadHandler$);
  const saveImage = usePublisher(saveImage$);
  const closeImageDialog = usePublisher(closeImageDialog$);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<ImageDialogFormState>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isOpen = dialogState.type !== 'inactive';
  const isEditing = dialogState.type === 'editing';
  const canUploadFromDevice = imageUploadHandler !== null;

  const executeResetForm = useCallback((): void => {
    setForm(EMPTY_FORM);
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setIsDragging(false);
    if (fileInputRef.current !== null) {
      fileInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => {
        executeResetForm();
      });
      return;
    }
    if (dialogState.type === 'editing') {
      const initial = dialogState.initialValues;
      queueMicrotask(() => {
        setForm({
          src: initial.src ?? '',
          altText: initial.altText ?? '',
          title: initial.title ?? '',
        });
        setPreviewUrl(initial.src ?? null);
        setSelectedFile(null);
        setErrorMessage(null);
      });
      return;
    }
    queueMicrotask(() => {
      executeResetForm();
    });
  }, [dialogState, executeResetForm, isOpen]);

  const executeApplyFile = useCallback((file: File): void => {
    const validationError = validateImageFile(file);
    if (validationError !== null) {
      setErrorMessage(validationError);
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
    readFilePreview(file, setPreviewUrl);
  }, []);

  const executeHandleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      if (file === undefined) {
        return;
      }
      executeApplyFile(file);
    },
    [executeApplyFile],
  );

  const executeHandleDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const executeHandleDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const executeHandleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file === undefined) {
        return;
      }
      executeApplyFile(file);
    },
    [executeApplyFile],
  );

  const executeHandleOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) {
        closeImageDialog();
        executeResetForm();
      }
    },
    [closeImageDialog, executeResetForm],
  );

  const executeHandleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setErrorMessage(null);
      let resolvedSrc = form.src.trim();
      if (selectedFile !== null) {
        if (!canUploadFromDevice) {
          setErrorMessage('Upload is not available. Use an image URL instead.');
          return;
        }
        setIsSubmitting(true);
        try {
          resolvedSrc = await uploadBlogImage(selectedFile);
        } catch {
          setIsSubmitting(false);
          return;
        }
      }
      if (resolvedSrc.length === 0) {
        setErrorMessage('Choose an image file or enter an image URL.');
        setIsSubmitting(false);
        return;
      }
      saveImage({
        src: resolvedSrc,
        altText: form.altText.trim(),
        title: form.title.trim(),
      });
      executeResetForm();
      setIsSubmitting(false);
    },
    [canUploadFromDevice, form.altText, form.src, form.title, saveImage, selectedFile, executeResetForm],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open onOpenChange={executeHandleOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-lg" showCloseButton>
        <form onSubmit={executeHandleSubmit}>
          <DialogHeader className="space-y-1.5 border-b px-6 py-4 text-left">
            <DialogTitle>{isEditing ? 'Edit image' : 'Insert image'}</DialogTitle>
            <DialogDescription>
              {canUploadFromDevice
                ? 'Drag and drop a file, browse your device, paste into the editor, or use an image URL.'
                : 'Enter an image URL and optional accessibility text.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-5">
            {canUploadFromDevice ? (
              <div className="space-y-2">
                <Label htmlFor={fileInputId} className="text-sm font-medium">
                  Image file
                </Label>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drop image here or browse files"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={executeHandleDragOver}
                  onDragLeave={executeHandleDragLeave}
                  onDrop={executeHandleDrop}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
                    'hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
                  )}
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Upload className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {selectedFile !== null ? selectedFile.name : 'Drop an image here'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse · JPEG, PNG, GIF, WebP · max 5 MB
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="sr-only"
                    onChange={executeHandleFileChange}
                  />
                </div>
              </div>
            ) : null}
            {canUploadFromDevice ? (
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or use URL</span>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="blog-image-src" className="text-sm font-medium">
                Image URL
              </Label>
              <Input
                id="blog-image-src"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://example.com/image.webp"
                value={form.src}
                disabled={selectedFile !== null}
                onChange={(event) => {
                  const nextSrc = event.target.value;
                  setForm((current) => ({ ...current, src: nextSrc }));
                  if (selectedFile === null) {
                    setPreviewUrl(nextSrc.trim().length > 0 ? nextSrc : null);
                  }
                }}
              />
              {selectedFile !== null ? (
                <p className="text-xs text-muted-foreground">
                  Clear the selected file to enter a URL instead.
                  {' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      if (fileInputRef.current !== null) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    Clear file
                  </button>
                </p>
              ) : null}
            </div>
            {previewUrl !== null ? (
              <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={form.altText.trim().length > 0 ? form.altText : 'Image preview'}
                  className="mx-auto max-h-40 w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-xs text-muted-foreground">
                <ImageIcon className="size-4 shrink-0" aria-hidden />
                Preview appears after you choose a file or enter a URL.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="blog-image-alt" className="text-sm font-medium">
                  Alt text
                </Label>
                <Input
                  id="blog-image-alt"
                  type="text"
                  placeholder="Describe the image for screen readers"
                  value={form.altText}
                  onChange={(event) => setForm((current) => ({ ...current, altText: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Brief description of what the image shows. Improves accessibility and SEO.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="blog-image-title" className="text-sm font-medium">
                  Title <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="blog-image-title"
                  type="text"
                  placeholder="Tooltip text on hover"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
            </div>
            {errorMessage !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 border-t px-6 py-4 sm:gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => executeHandleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Uploading…
                </>
              ) : isEditing ? (
                'Save changes'
              ) : (
                'Insert image'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
