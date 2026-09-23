# Fix AI service availability failure

## Changes
- Remove the unreliable environment-only preflight that stops counterparty search before any real AI request is attempted.
- Let the existing provider routing make the request and surface the actual safe error from OpenAI or Lovable AI.
- Apply the same correction to related search actions that share this false preflight, without changing search ranking, selection, credits, or governance.
- Keep real failures terminal except for the existing bounded retries on rate limits and temporary service errors.

## Validation
- Run the focused automated tests and TypeScript checks.
- Confirm the preview builds cleanly.
- Exercise the signed-in search flow and confirm it no longer produces the false “No AI service is available” blank screen.
