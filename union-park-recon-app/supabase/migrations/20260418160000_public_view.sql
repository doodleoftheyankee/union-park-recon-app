-- Public read-only view for the TV / sales-floor pages.
-- Exposes only safe fields. Cost data, recon spend, bills, notes, audit
-- log, and rejected vehicles never leak through this view.

DROP VIEW IF EXISTS public.public_vehicles;

CREATE VIEW public.public_vehicles
WITH (security_invoker = off) AS
SELECT
  id,
  stock_number,
  year,
  make,
  model,
  trim,
  exterior_color,
  interior_color,
  mileage,
  stage,
  service_location,
  acquisition_date,
  asking_price,
  created_at,
  frontline_at
FROM public.vehicles
WHERE COALESCE(is_rejected, FALSE) = FALSE;

GRANT SELECT ON public.public_vehicles TO anon, authenticated;
