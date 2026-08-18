import type { FormEvent } from 'react';

/** Capture form before async work — avoids null currentTarget after re-render. */
export function formFromEvent(e: FormEvent<HTMLFormElement>): HTMLFormElement {
  return e.currentTarget;
}

/** Safe reset when form may have unmounted after await. */
export function safeResetForm(form: HTMLFormElement | null | undefined): void {
  try {
    form?.reset();
  } catch {
    /* form detached */
  }
}
