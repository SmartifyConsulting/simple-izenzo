# Resolve the document-upload AI busy error

## Confirmed diagnosis

- The file is uploaded successfully before this message appears.
- The message comes from the follow-up OpenAI document-reading request, which summarizes the uploaded file.
- OpenAI returned HTTP 429. The app currently makes this request once and immediately reports “AI is busy” unless OpenAI explicitly identifies exhausted credits.
- The saved OpenAI integration is enabled, but it has no recorded connection test result. This path does not use Lovable AI.

## Plan

1. Route document reading through the same bounded retry handling already used by the other OpenAI features, respecting OpenAI’s requested wait time.
2. Distinguish temporary request limits from exhausted credits, spending limits, rejected keys, oversized documents, and service failures; show the specific safe message returned by OpenAI.
3. Keep the upload non-blocking: the file remains stored if document reading fails, and the existing **Try again** action remains available.
4. Apply the same error handling to filename classification and material-term extraction so one upload does not produce conflicting messages.
5. Verify with automated checks, a clean build, and a signed-in document upload. Confirm both success and failure states preserve the uploaded file.

## No workflow changes

No changes to trade rules, AI+ governance, tenant isolation, document records, POI/WaD/Execution/Finality controls, or the selected OpenAI connection.
