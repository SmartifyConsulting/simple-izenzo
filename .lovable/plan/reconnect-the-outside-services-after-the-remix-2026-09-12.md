# Reconnect the outside services after the remix

Short answer: no, I don't have the keys. The remix started with a brand-new, empty
backend — the saved services table is empty, and the two carried-over values
(the Bright Data address and the encryption key) are stored encrypted and can
never be read back, by me or by anyone. Every key has to be re-entered once.

## What's involved

The app already has an Admin → Integrations screen built for exactly this: it
stores each service's details, keeps the passwords encrypted, and has a
"Test connection" button that calls the real service and records the result.
Nothing new needs building — the values just need re-entering.

## What I'll do

1. Reset the two remix-carried values first, since the vault depends on them:
   - the encryption key that protects everything else you save
   - the Bright Data browser address used for the online media checks
2. Walk you through Admin → Integrations service by service, in the order the
   workflow needs them:
   - Didit (ID, company and sanctions checks) — key, webhook secret, three workflow IDs
   - Bright Data (online media checks)
   - Resend (emails)
   - Payments: whichever of Ozow / Stitch / Peach / PayFast you actually use
   - Currency rates: exchangerate.host or Open Exchange Rates
   - Optional: Onfido, ComplyAdvantage, Twilio, CIPC, SARS, AWS archive
3. For each one, press "Test connection" and confirm it answers, so we know it's
   live rather than just saved.
4. Report back a list showing which services are green and which still need a key.

## Where the values come from

Each key is re-copied from that provider's own dashboard (Didit console, Bright
Data zone details, Resend, your payment provider, etc.). If any account was
under the previous project's name, that provider may need to reissue the key.

## Notes

- No code, database or workflow changes — this is configuration only.
- Values are entered in a secure form; they are never shown in chat.
- Anything you can't find a key for, tell me and I'll mark that service as off
  rather than leave the app half-connected.
