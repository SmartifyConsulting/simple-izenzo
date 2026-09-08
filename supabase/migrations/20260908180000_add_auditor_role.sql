-- Adds the 'auditor' role ahead of Deletion/Forensic Events Access (rebuild requirements section 6).
-- Section 0 lists 'auditor' among the reserved-for-later roles in the real platform's 13-role
-- model. Split into its own migration because Postgres will not let a new enum value be added and
-- used in the same transaction.
ALTER TYPE public.app_role ADD VALUE 'auditor';
