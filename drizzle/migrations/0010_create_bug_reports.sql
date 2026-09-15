CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT,
  type TEXT NOT NULL DEFAULT 'bug',
  title TEXT NOT NULL,
  description TEXT,
  created_via TEXT NOT NULL DEFAULT 'typed',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bug_reports_type_check CHECK (type IN ('bug','fix','nice_to_have')),
  CONSTRAINT bug_reports_status_check CHECK (status IN ('open','done')),
  CONSTRAINT bug_reports_via_check CHECK (created_via IN ('typed','voice'))
);

CREATE INDEX idx_bug_reports_status_created ON public.bug_reports (status, created_at DESC);
CREATE INDEX idx_bug_reports_user ON public.bug_reports (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bug reports"
ON public.bug_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create their own bug reports"
ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update bug reports"
ON public.bug_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bug reports"
ON public.bug_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();