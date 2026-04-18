-- The original schema.sql only defined INSERT / UPDATE / SELECT policies on
-- vehicles, notes, stage_history and parts_holds. Without a matching DELETE
-- policy, PostgREST silently drops DELETE requests (returns 0 rows, no
-- error), which is why the "Delete" button appeared to do nothing.

-- Drop any existing "Users can delete ..." policies so this migration can be
-- re-run safely, then re-create them idempotently.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['vehicles', 'notes', 'stage_history', 'parts_holds', 'vehicle_audit'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete %s" ON public.%I', t, t);
  END LOOP;
END $$;

CREATE POLICY "Users can delete vehicles" ON public.vehicles
  FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete notes" ON public.notes
  FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete stage_history" ON public.stage_history
  FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete parts_holds" ON public.parts_holds
  FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete vehicle_audit" ON public.vehicle_audit
  FOR DELETE USING (auth.role() = 'authenticated');

-- Seed recon cost estimates for any vehicle that has no breakdown yet, so
-- the bulk-imported inventory lands with ballpark numbers that can be edited
-- per-car. Only touches rows where every category is zero/null.
UPDATE public.vehicles
SET
  cost_mechanical = CASE grade
    WHEN 'A' THEN 100 WHEN 'B' THEN 500 WHEN 'C' THEN 700 WHEN 'D' THEN 1200 ELSE 500
  END,
  cost_body = CASE grade
    WHEN 'A' THEN 50 WHEN 'B' THEN 100 WHEN 'C' THEN 200 WHEN 'D' THEN 300 ELSE 100
  END,
  cost_detail = CASE grade
    WHEN 'A' THEN 300 WHEN 'B' THEN 300 WHEN 'C' THEN 300 WHEN 'D' THEN 400 ELSE 300
  END,
  cost_parts = CASE grade
    WHEN 'A' THEN 50 WHEN 'B' THEN 200 WHEN 'C' THEN 300 WHEN 'D' THEN 500 ELSE 200
  END,
  cost_vendor = CASE grade
    WHEN 'A' THEN 0 WHEN 'B' THEN 100 WHEN 'C' THEN 200 WHEN 'D' THEN 100 ELSE 100
  END,
  estimated_cost = CASE grade
    WHEN 'A' THEN 500 WHEN 'B' THEN 1200 WHEN 'C' THEN 1700 WHEN 'D' THEN 2500 ELSE 1300
  END
WHERE (
  COALESCE(cost_mechanical, 0) + COALESCE(cost_body, 0) + COALESCE(cost_detail, 0)
  + COALESCE(cost_parts, 0) + COALESCE(cost_vendor, 0)
) = 0
AND COALESCE(estimated_cost, 0) = 0
AND NOT is_rejected;
