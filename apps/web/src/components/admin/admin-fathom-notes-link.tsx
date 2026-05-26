import type { ReactElement } from 'react';

type AdminFathomNotesLinkProps = {
  readonly fathomShareUrl?: string | null;
  readonly recordingOptIn?: boolean;
  readonly className?: string;
};

/**
 * Admin link to Fathom meeting notes when a share URL exists; otherwise a short pending hint when opted in.
 */
export function AdminFathomNotesLink(props: AdminFathomNotesLinkProps): ReactElement | null {
  const url = typeof props.fathomShareUrl === 'string' ? props.fathomShareUrl.trim() : '';
  if (url.length > 0) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={
          props.className ??
          'font-medium text-primary underline-offset-4 hover:underline'
        }
      >
        Open Fathom notes
      </a>
    );
  }
  if (props.recordingOptIn === true) {
    return <span className={props.className ?? 'text-sm text-muted-foreground'}>Notes pending</span>;
  }
  return null;
}
