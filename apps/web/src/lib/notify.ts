import { toast } from 'sonner';

export function notifySuccess(message: string): void {
  toast.success(message);
}

export function notifyError(message: string): void {
  toast.error(message);
}

export function notifyInfo(message: string): void {
  toast.info(message);
}

export function notifyActionResult(ok: boolean, successMessage: string, failureMessage: string): void {
  if (ok) {
    notifySuccess(successMessage);
    return;
  }
  notifyError(failureMessage);
}
