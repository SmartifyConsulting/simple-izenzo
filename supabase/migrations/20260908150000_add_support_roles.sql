-- Adds the support roles ahead of the Enterprise Support build (Phase 7, rebuild requirements
-- section 7: "new roles required: support_agent, support_lead, engineer_on_call — distinct from
-- platform_admin, with their own RLS"). Split into its own migration because Postgres will not
-- let a new enum value be added and used in the same transaction.
ALTER TYPE public.app_role ADD VALUE 'support_agent';
ALTER TYPE public.app_role ADD VALUE 'support_lead';
ALTER TYPE public.app_role ADD VALUE 'engineer_on_call';
