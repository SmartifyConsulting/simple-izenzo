# Footer, profile picture, and Dashboard update

## What changes

### 1. Footer on every page, with a Privacy link
- Add **Privacy** to the shared footer links, next to Terms & Glossary, Docs, Status, Pricing, Support (the `/privacy` page already exists).
- Add **Terms & Conditions** alongside it so the legal links live in one place.
- Show the footer on every signed-in page too, not just the marketing pages: it is added once at the bottom of the app shell, so Dashboard, Trades, Admin, Developer Centre and all other in-app pages get the same footer.

### 2. Move "Switch to light mode" under Support
In the profile menu (top-right avatar), the light/dark switch currently sits at the top. It moves below **Support**, so the order becomes: Settings → Support → Switch to light/dark mode → Sign out → legal links.

### 3. Profile picture upload with clear failure messages
Today a failed upload shows only the raw technical error. Instead:
- Check the file before uploading: must be an image (PNG, JPG, WEBP or GIF) and under 5 MB, with a plain message when it isn't.
- Translate upload failures into readable messages, for example "You need to be signed in to change your picture", "That image is too large — pick one under 5 MB", "Picture storage isn't set up yet", or "Upload failed — please check your connection and try again".
- Show the failure inline under the picture as well as in the toast, so it does not disappear before it is read.

### 4. Click any avatar to see it larger
- A new shared avatar viewer: clicking a profile picture anywhere (top-right avatar, Settings, member and counterparty lists) opens it enlarged in a dialog with the person's name, closable with Escape or a click outside.
- Where the picture can also be changed (Settings), the enlarged view keeps a "Change image" action so the upload flow still works.
- People with no picture show their initials enlarged instead.

### 5. Menu: "Deals" becomes "Dashboard", with real figures
- The top-bar **Deals** button is renamed **Dashboard** (it already points at `/dashboard`).
- The Dashboard page gains a summary band above the deal canvas, built from the records already in the database — no invented numbers:
  - Open deals, deals sealed, total deals
  - Token balance and tokens spent (from the token ledger)
  - Counterparties in the registry, and compliance items needing attention
  - A "Recent activity" list from the deal history/activity records, each linking to its deal
  - A "Your deals" list with status and last-updated date
- The live deal canvas stays on the Dashboard, below the summary, exactly as it works now.
- If a section has no records yet, it shows a short "nothing yet" line instead of a zeroed-out tile.

## Technical notes
- `src/components/layout/SiteFooter.tsx`: add `/privacy` and `/terms` links.
- `src/components/layout/AppShell.tsx`: render `<SiteFooter />` after `<main>`; rename the Deals button label to Dashboard. Other shells (`DeveloperShell`, `GovernanceShell`) get the same footer.
- `src/components/guided/ProfileAvatarMenu.tsx`: reorder items; make the trigger avatar also offer "View picture" opening the new viewer.
- New `src/components/AvatarViewer.tsx`: dialog-based enlarged avatar, reused by the menu, Settings and any list avatars.
- `src/components/AvatarUpload.tsx`: client-side type/size validation, mapped error messages, inline error state, click-to-enlarge when a picture already exists.
- `src/routes/_authenticated.dashboard.tsx`: add queries against `transactions`, `token_ledger`, `registry_companies`/organisations, `deal_history`/activity tables scoped by the existing RLS, rendered as summary tiles plus recent lists above the existing `DealCanvas`.
- No database schema, workflow, gate, token or permission changes.
