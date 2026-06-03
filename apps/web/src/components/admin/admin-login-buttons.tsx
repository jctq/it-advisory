'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

type AdminLoginButtonsProps = {
  readonly next: string;
  readonly hasGoogle: boolean;
  readonly hasMicrosoft: boolean;
};

export function AdminLoginButtons(props: AdminLoginButtonsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {props.hasGoogle ? (
        <Button
          type="button"
          variant="default"
          className="w-full"
          onClick={() =>
            signIn('google', { callbackUrl: props.next }, { prompt: 'select_account' })
          }
        >
          Sign in with Google
        </Button>
      ) : null}
      {props.hasMicrosoft ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() =>
            signIn('microsoft-entra-id', { callbackUrl: props.next }, { prompt: 'select_account' })
          }
        >
          Sign in with Microsoft
        </Button>
      ) : null}
      {!props.hasGoogle && !props.hasMicrosoft ? (
        <p className="text-center text-sm text-muted-foreground">
          OAuth is not configured. Set AUTH_GOOGLE_* or AUTH_MICROSOFT_ENTRA_ID_* on the server.
        </p>
      ) : null}
    </div>
  );
}
