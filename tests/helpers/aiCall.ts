import { waitFor } from "@testing-library/react";

/**
 * The call id the form of `button` sends with its AI action (AiCallField): what lets the
 * teacher stop that action on leaving the page.
 */
export async function expectAiCallId(button: HTMLElement): Promise<void> {
  const form = button.closest("form");
  await waitFor(() => {
    const field = form?.querySelector<HTMLInputElement>('input[name="aiCall"]');
    if (!field?.value.match(/^[A-Za-z0-9-]{8,64}$/)) throw new Error("no AI call id in the form");
  });
}
