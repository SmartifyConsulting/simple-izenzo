# Three fixes: the search box, the sub-step indent, and the match pills

## What I checked

The Search Prompt box in your screenshot is in place and working: description on the left, drop
zone on the right (with the spinner while files are being read), the help line beneath, and one
Submit button. It already disappears as soon as a file is attached. What it does not do is
disappear when you press Submit with only a typed description and no file — so it stays on screen
while the search runs. That is the gap to close.

## Changes

1. **Search box goes away once you submit.** Pressing Submit hides the description box, the drop
   zone and the help line immediately, so the workspace shows the search running instead of the
   form you just sent. It stays hidden afterwards.
2. **Sub-steps move further left.** Every sub-step under a step name shifts left again, so they sit
   just inside the step name rather than halfway across.
3. **Percentage pills go black.** The "% match" pills in the search results become solid black with
   white text, instead of the light blue outline.

## Technical detail

- `DocumentUploadStep.tsx`: add a `submitted` state set true in the Submit handler; the Search
  Prompt block renders on `docs.length === 0 && !submitted`.
- `ClassicView.tsx`: the invisible bracket-width spacer's inner span goes from `w-1/2` to `w-1/4`,
  halving the remaining indent for all sub-step rows and the finished-step row.
- `MatchResultsPanel.tsx`: the score pill class becomes `bg-foreground text-background` with a
  matching border, replacing `border-primary/40 bg-primary/10 text-primary`.
- No changes to search logic, scoring, or token costs.
