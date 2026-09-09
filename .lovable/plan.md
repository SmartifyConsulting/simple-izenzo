# Workflow view defaults, cleaner pulsing, and Admin in the profile menu

Four focused changes to the deal screen and the profile menu. No database, gate, token or workflow-rule changes.

## 1. Workflow map opens by default after signing in

Today the app remembers whichever view you last used, so if you were switched to the classic list (which happens automatically when you register a bid or offer from the map), you land back in the list next time.

Change: each new sign-in starts on the workflow map. Switching views during a session still works and still sticks until you sign out.

## 2. Counterparties frame no longer bordered or pulsing

The results frame currently gets a pulsing highlight while the match search runs. That pulse and its highlight border are removed — the frame stays plain at all times. The existing thin progress ribbon that shows the search is running stays.

## 3. Pulsing follows the step you are actually on

- While matches are being found and shown: only the **Choice** step pulses.
- The moment you press **Continue with counterparties**: the Choice pulse stops and only **Background screening** pulses.

## 4. Progress bar during background screening

While screening runs, the Background screening step shows a progress bar underneath it that fills as each counterparty's checks come back (company register, ID, company, sanctions), with a short "3 of 8 checks complete" style label. It settles at full when screening finishes, and shows a plain failed state if the run errors.

To make this real rather than a fake timer, screening reports each counterparty's result as it completes instead of only returning everything at the end.

## 5. Admin in the profile menu

An **Admin** entry is added to the profile (Settings) menu, above Settings, visible only to users with admin rights. Activity Log and Integrations inside Admin stay system-admin-only, unchanged.

## Technical notes

- `src/lib/viewMode.ts`: store the view choice per session (sessionStorage) rather than persisting across sign-ins; default remains `mahjong`.
- `src/components/canvas/DealCanvas.tsx`: drop the `searching && "animate-throb"` wrapper on `CounterpartyRecord`; add an optional progress prop rendered under the `media` (Background screening) node.
- `src/routes/_authenticated.live-deal-engine.tsx`: `throbStep` becomes `screening ? "media" : flowStep === "results" ? "choice" : null` with the Choice pulse suppressed once `screening` is true; track completed-vs-total counts for the bar.
- `src/lib/screening.functions.ts`: return per-counterparty progress-friendly results (chunked calls per counterparty from the route, so the bar advances) — same checks, same providers, no rule changes.
- `src/components/guided/ProfileAvatarMenu.tsx`: add an admin-gated `Link to="/admin"` using `useAuth().roles`.
