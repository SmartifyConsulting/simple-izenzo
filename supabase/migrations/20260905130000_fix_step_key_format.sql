-- The transactions.step default and some seeded rows use underscores ('bid_offer'),
-- but the app's step keys are hyphenated ('bid-offer') everywhere else. The mismatch
-- means stepIndex() can't find the row's step in the flat step list, so every step
-- (including the very first one) reports as locked for affected transactions.

ALTER TABLE public.transactions ALTER COLUMN step SET DEFAULT 'bid-offer';

UPDATE public.transactions
SET step = 'bid-offer'
WHERE stage = 'trading' AND step = 'bid_offer';
