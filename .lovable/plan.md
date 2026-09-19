# Resolve the document-upload AI busy error

## Confirmed diagnosis

- The file is uploaded successfully before this message appears.
- The message comes from the follow-up OpenAI document-reading request, which summarises the uploaded file.
- OpenAI returned HTTP 429. The app makes this request once and immediately reports "AI is busy" unless OpenAI explicitly names exhausted credits.
- The saved OpenAI connection is a free account. Free accounts allow very few requests per minute and a very small daily allowance, so an upload that sends a photo or a large PDF is refused almost every time. This is an account limit, not a fault in the app.

## Decision on which AI account is used

The app keeps using the OpenAI account saved under Admin → Integrations. It will not be switched to the built-in Lovable AI service, so client usage is never billed to your Lovable credits. Nothing in this plan changes which account pays.

The lasting fix is pay-as-you-go credit on that OpenAI developer account (not a ChatGPT Plus subscription, which apps cannot use). Once the client adds credit to their own OpenAI account and that key is saved in Admin → Integrations, the cost sits with them and these limits disappear.

## Plan

1. Route document reading through the same bounded retry handling already used by the other OpenAI features, respecting OpenAI's requested wait time, so a brief limit resolves itself instead of failing straight away.
2. Rewrite the messages so a free-account limit reads plainly: the OpenAI account has reached its request allowance, it will work again shortly, and adding credit to that OpenAI account removes the limit. Keep the separate wording for exhausted credits, rejected keys, oversized documents and service failures.
3. Keep the upload non-blocking: the file stays stored when reading fails, and the existing **Try again** action remains.
4. Send the documents as a single request rather than alongside the other checks, so one upload does not spend several of the few requests a free account allows at once.
5. Apply the same handling to filename classification and material-term extraction so one upload cannot produce conflicting messages.
6. Verify with the automated checks, a clean build, and a signed-in upload — confirming both the success path and the limit path keep the uploaded file.

## What this does and does not fix

The app will stop showing a confusing error and will retry sensibly, but a free OpenAI account will still refuse frequent or large document reads. Reading documents reliably needs credit on that OpenAI account.

## No workflow changes

No changes to trade rules, AI+ governance, tenant isolation, document records, or POI/WaD/Execution/Finality controls.
