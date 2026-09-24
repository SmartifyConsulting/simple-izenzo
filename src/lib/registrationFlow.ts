/** Tracks that a sign-up is mid-wizard.
 *
 * Creating an account signs the person in immediately, which is what the surrounding screens watch
 * for: the home page and the sign-in page both bounce a signed-in visitor straight into the app. On
 * the sign-up form that is wrong — it fires while step 3 (the ID number and document) is still
 * waiting to be filled in, unmounting the form before that step can render.
 *
 * Kept in session storage rather than React state because the screens that must not redirect are
 * separate components from the form that sets it. Session-scoped, so abandoning the tab clears it.
 */
const KEY = "izenzo:registration-in-progress";

export function beginRegistration(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* best-effort only */
  }
}

export function endRegistration(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* best-effort only */
  }
}

export function registrationInProgress(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
