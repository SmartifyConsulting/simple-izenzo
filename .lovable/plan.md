# Resolve the document-upload AI busy error

## Confirmed diagnosis

- The file is uploaded successfully before this message appears.
- The message comes from the follow-up OpenAI document-reading request, which summarizes the uploaded file.
- OpenAI returned HTTP 429. The app makes this request once and immediately reports "AI is busy" unless OpenAI explicitly names exhausted credits.
- The saved OpenAI connection is a free plan. Free accounts allow very few requests per minute and a very small daily allowance, so an upload that sends a photo or a large PDF is refused almost every time. This is an account limit, not a fault in the app.

## Plan

1. Route document reading through the same bounded retry handling already used by the other OpenAI features, respecting OpenAI's requested wait time, so a brief limit resolves itself instead of failing straight away.
2. Rewrite the messages so a free-plan limit reads plainly: say the OpenAI account has reached its request allowance, that it will work again shortly, and that adding paid credit removes the limit. Keep the separate wording for exhausted credits, rejected keys, oversized documents and service failures.
3. Keep the upload non-blocking: the file stays stored when reading fails, and the existing **Try again** action remains.
4. Send the documents one request at a time rather than alongside the other checks, so a single upload does not spend several of the small number of requests a free plan allows at once.
5. Apply the same handling to filename classification and material-term extraction so one upload cannot produce conflicting messages.
6. Verify with the automated checks, a clean build, and a signed-in upload — confirming both the success and the limit path keep the uploaded file.

## What this does and does not fix

The app will stop showing a confusing error and will retry sensibly, but a free OpenAI account will still refuse frequent or large document reads. Reading documents reliably needs paid credit on that OpenAI account, or switching this workspace to the built-in AI service.

## No workflow changes

No changes to trade rules, AI+ governance, tenant isolation, document records, or POI/WaD/Execution/Finality controls.
