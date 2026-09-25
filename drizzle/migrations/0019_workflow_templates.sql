CREATE TABLE public.workflow_templates (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  domain text NOT NULL DEFAULT 'commodity_trading',
  is_default boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  lexicon jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_directives jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workflow_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read templates" ON public.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert templates" ON public.workflow_templates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update unlocked templates" ON public.workflow_templates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND NOT locked) WITH CHECK (public.has_role(auth.uid(), 'admin') AND NOT locked);
CREATE POLICY "Admins delete unlocked templates" ON public.workflow_templates FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND NOT locked AND NOT is_default);
CREATE TRIGGER workflow_templates_touch BEFORE UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS workflow_template_key text DEFAULT 'izenzo_default';