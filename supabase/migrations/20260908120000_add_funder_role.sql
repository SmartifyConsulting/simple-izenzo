-- Adds the 'funder' role value ahead of the Funder Workspace build (Phase 5, rebuild
-- requirements section 9). Split into its own migration because Postgres will not let a new enum
-- value be added and used in the same transaction.
ALTER TYPE public.app_role ADD VALUE 'funder';
