'use client';

import { Maximize2 } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import { cn } from '@/lib/utils';

type AppImageLightboxProps = {
  readonly src: string;
  readonly alt: string;
  readonly caption?: string;
  readonly className?: string;
  readonly frameClassName?: string;
  readonly imageClassName?: string;
  readonly sizes?: string;
  readonly unoptimized?: boolean;
  /** Use a plain `img` for blob: URLs or other non-optimized sources. */
  readonly useNativeImg?: boolean;
  readonly children?: ReactNode;
};

/**
 * Click-to-enlarge image with Yet Another React Lightbox, themed to match app UI tokens.
 */
export function AppImageLightbox(props: AppImageLightboxProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const executeOpen = useCallback((): void => {
    setIsOpen(true);
  }, []);
  const executeClose = useCallback((): void => {
    setIsOpen(false);
  }, []);
  const caption = props.caption ?? props.alt;
  return (
    <>
      <button
        type="button"
        className={cn(
          'group relative block w-full overflow-hidden rounded-xl text-left',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          props.className,
        )}
        onClick={executeOpen}
        aria-label={`View larger: ${props.alt}`}
      >
        <span className={cn('relative block w-full bg-muted/30', props.frameClassName)}>
          {props.useNativeImg ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob / dynamic preview URLs
            <img
              alt={props.alt}
              className={cn('h-full w-full object-contain object-top', props.imageClassName)}
              src={props.src}
            />
          ) : (
            <Image
              alt={props.alt}
              className={cn('object-contain object-top', props.imageClassName)}
              fill
              sizes={props.sizes ?? '(max-width: 768px) 100vw, 720px'}
              src={props.src}
              unoptimized={props.unoptimized ?? true}
            />
          )}
          <span
            className={cn(
              'pointer-events-none absolute inset-0 flex items-end justify-end p-3',
              'bg-linear-to-t from-foreground/25 via-transparent to-transparent',
              'opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
            aria-hidden
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-sm">
              <Maximize2 className="size-3.5" />
              Enlarge
            </span>
          </span>
        </span>
        {props.children}
      </button>
      <Lightbox
        open={isOpen}
        close={executeClose}
        plugins={[Captions, Zoom]}
        captions={{ showToggle: false, descriptionTextAlign: 'start' }}
        zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
        carousel={{ finite: true }}
        animation={{ fade: 220, swipe: 280 }}
        controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
        render={{
          buttonPrev: () => null,
          buttonNext: () => null,
        }}
        slides={[
          {
            src: props.src,
            alt: props.alt,
            title: caption,
            description: 'Scroll or pinch to zoom · Esc to close',
          },
        ]}
      />
    </>
  );
}

/**
 * Card wrapper matching marketing/admin report screenshot panels.
 */
export function AppImageLightboxCard(props: AppImageLightboxProps & { readonly label?: string }): ReactElement {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      {props.label !== undefined ? (
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">{props.label}</div>
      ) : null}
      <div className="p-2">
        <AppImageLightbox {...props} className={cn('rounded-lg', props.className)} />
      </div>
    </div>
  );
}
