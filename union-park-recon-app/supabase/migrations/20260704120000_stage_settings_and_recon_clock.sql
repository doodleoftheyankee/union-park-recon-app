-- ---------------------------------------------------------------------------
-- Feature drop (July 2026):
--   * Per-stage green / yellow / red thresholds, admin-editable
--   * Recon clock: separate timer that starts when a car moves stock_in -> in_service
--
-- Brian wants each pipeline stage to have its own aging thresholds instead of
-- one hard-coded max-days. A card renders green under `yellow_at_days`, yellow
-- between yellow and red, red past `red_at_days`. Ships with reasonable
-- defaults matching the "5-6 day flip" target (2.5d service + 2.5d detail).
--
-- Recon clock: total-days is the DMS "days in stock" (already carried as
-- acquisition_date). But that isn't the number Brian's team is measured on.
-- The recon clock starts the moment we begin actually working the car — the
-- move from stock_in into in_service. Column is nullable; a null value means
-- recon hasn't started yet.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stage_settings (
  stage_id TEXT PRIMARY KEY,
  yellow_at_days NUMERIC NOT NULL DEFAULT 2,
  red_at_days NUMERIC NOT NULL DEFAULT 3,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_id UUID,
  updated_by_name TEXT
);

INSERT INTO public.stage_settings (stage_id, yellow_at_days, red_at_days) VALUES
  ('stock_in',   1,   2),
  ('in_service', 2,   3),
  ('detail',     2,   3),
  ('frontline',  15,  30)
ON CONFLICT (stage_id) DO NOTHING;

ALTER TABLE public.stage_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_settings_select" ON public.stage_settings;
CREATE POLICY "stage_settings_select" ON public.stage_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stage_settings_upsert" ON public.stage_settings;
CREATE POLICY "stage_settings_upsert" ON public.stage_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "stage_settings_insert" ON public.stage_settings;
CREATE POLICY "stage_settings_insert" ON public.stage_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Recon clock on the vehicle row itself. Denormalized for read-speed on the
-- dashboard; we could compute this from stage_history but every card render
-- would then walk the history array.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS recon_started_at TIMESTAMP WITH TIME ZONE;

-- Backfill: for any vehicle that has already been in in_service at some
-- point, seed recon_started_at from the earliest stage_history entry.
UPDATE public.vehicles v
SET recon_started_at = sh.entered_at
FROM (
  SELECT vehicle_id, MIN(entered_at) AS entered_at
  FROM public.stage_history
  WHERE stage = 'in_service'
  GROUP BY vehicle_id
) sh
WHERE v.id = sh.vehicle_id
  AND v.recon_started_at IS NULL;

-- Also: for cars currently in detail or frontline that never saw in_service
-- (edge case from before this feature landed), assume recon started when
-- they left stock_in.
UPDATE public.vehicles v
SET recon_started_at = sh.entered_at
FROM (
  SELECT DISTINCT ON (vehicle_id) vehicle_id, entered_at
  FROM public.stage_history
  WHERE stage != 'stock_in'
  ORDER BY vehicle_id, entered_at ASC
) sh
WHERE v.id = sh.vehicle_id
  AND v.recon_started_at IS NULL
  AND v.stage IN ('detail', 'frontline');
