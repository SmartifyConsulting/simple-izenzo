# Restore the uploaded-bid workspace and fix the file error

## What will change

### 1. Fix the attached `docType` error
- Stop destructuring the file-classification response until it has been checked.
- If classification returns no result, use the existing filename-based fallback so the upload still completes.
- Keep the direction guess optional; it must never block saving a file.

### 2. Never ask for the same documents again
- Treat the document query’s loading state separately from a genuinely empty document list.
- Once any saved document exists for the bid, never render the upload frame again—even during refreshes, tab changes, or delayed data loading.
- Show **Fetch Interest** after the saved files and summary instead.

### 3. Generate and save a proper bid title
- Extend document reading to return a concise bid title based only on the uploaded documents and Search Prompt.
- Save that title on the bid when its current title is generic.
- Display it directly under the BID ID and above the registration date and time.

### 4. Make saved attachments authoritative
- Build the BID INFORMATION attachment list from the saved document records, rather than a second local copy that can become stale.
- Keep every file attached to its bid after refresh.
- Keep visible preview and download controls for every stored file; disable them only when an older record genuinely has no stored copy.

### 5. Restore the proposal summary
- Display the saved AI summary as bullet points in BID INFORMATION.
- Bold material keywords and values such as the subject, quantities, prices, currencies, dates, delivery terms, payment terms, specifications, and locations.
- Keep the retry control only for a real document-reading failure; do not replace saved attachments with the upload frame.

## Verification
- Reproduce the failed upload and confirm the `docType` error no longer appears.
- Refresh and switch away from the bid, then reopen it and confirm the upload frame does not return.
- Confirm the BID ID, generated title, registration date/time, summary, and attachment preview/download controls all remain visible.
- Confirm **Fetch Interest** appears once documents are saved.
