# Bug / Fix reporting, in the header next to the mail icon

Bring across the report tool from the Personal Bestie app: a small bug icon in the top bar, right beside the mail icon, that opens a panel where anyone signed in can report a bug, a fix, or a nice-to-have — by typing or by speaking it.

## What you will see

- A bug icon in the header, immediately to the left of the mail icon (same round outline style, same size).
- Clicking it opens a panel with:
  - Three choices: Bug, Fix, Nice to have.
  - A one-line box to type the report, plus a microphone button to dictate it instead (the recording is transcribed automatically and submitted).
  - A Send button, with a confirmation message once saved.
  - A list of reports underneath, newest first, with a search box.
- Ordinary users see the open reports; admins additionally get Open / Done / All filters, type filters, and buttons to tick a report as done or reopen it.
- Everything follows the app's existing colours, fonts and dark/light theme — no new styling language.

## Data

New `bug_reports` table (same shape as the source app): who reported it, their display name, type (bug / fix / nice-to-have), title, whether typed or spoken, status (open / done), timestamps. Row security: signed-in users can read and create; only admins can mark done, reopen, or delete. Grants for the signed-in role and service role included in the same migration.

## Technical notes

- New `src/components/BugReportMenu.tsx` — a dropdown/sheet triggered by a `Bug` lucide icon, adapted from Personal Bestie's `ReportFixBar.tsx`. It is header-mounted rather than a bottom bar, and reads the current user, profile name and admin role from the app's existing `useAuth()` instead of calling `supabase.auth.getUser()` and querying `user_roles` itself.
- Reads/writes go through the existing browser Supabase client with React Query, matching the inbox pattern already in `MainHeader.tsx`.
- Voice: the source app used a Supabase edge function. Here it becomes a server function `src/lib/bugReport.functions.ts` that posts the recorded audio to the Lovable AI gateway for transcription (Gemini flash, audio input), returning the text which is then submitted as a report. Browser recording uses `MediaRecorder` as in the original.
- Header wiring in `src/components/layout/MainHeader.tsx`: render `<BugReportMenu />` just before the existing `/inbox` mail link, inside the signed-in branch only.
- Migration adds the table, indexes, `updated_at` trigger, RLS policies using the existing `has_role(auth.uid(),'admin')`, and grants.
