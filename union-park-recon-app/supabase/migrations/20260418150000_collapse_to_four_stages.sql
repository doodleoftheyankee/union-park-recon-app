-- Collapse legacy 9-stage workflow into the simplified 4-stage one.
-- Old → New mapping:
--   appraisal                                                     -> stock_in
--   service_queue, service, parts_hold, approval, vendor          -> in_service
--   detail, inspection                                            -> detail
--   frontline                                                     -> frontline (unchanged)
-- Anything weird (NULL, custom values) gets parked in stock_in so it shows up.

UPDATE public.vehicles
SET stage = CASE
  WHEN stage = 'frontline' THEN 'frontline'
  WHEN stage IN ('detail', 'inspection') THEN 'detail'
  WHEN stage IN ('service_queue', 'service', 'parts_hold', 'approval', 'vendor') THEN 'in_service'
  ELSE 'stock_in'
END
WHERE stage NOT IN ('stock_in', 'in_service', 'detail', 'frontline')
  OR stage IS NULL;

-- Also collapse the stage_history table so the visible timeline is consistent.
UPDATE public.stage_history
SET stage = CASE
  WHEN stage = 'frontline' THEN 'frontline'
  WHEN stage IN ('detail', 'inspection') THEN 'detail'
  WHEN stage IN ('service_queue', 'service', 'parts_hold', 'approval', 'vendor') THEN 'in_service'
  WHEN stage = 'appraisal' THEN 'stock_in'
  ELSE stage
END
WHERE stage NOT IN ('stock_in', 'in_service', 'detail', 'frontline');
