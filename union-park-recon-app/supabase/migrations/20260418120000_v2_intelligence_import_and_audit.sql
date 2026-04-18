-- Union Park Recon Tracker - Schema v2 Migration
-- Run this AFTER schema.sql to upgrade an existing database.
-- Adds: rich vehicle details, inventory imports, edit audit log, recon cost
-- categories, target frontline date, photos, and auto-routing metadata.

-- ============================================================================
-- Extend vehicles table
-- ============================================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS trim TEXT,
  ADD COLUMN IF NOT EXISTS body_style TEXT,
  ADD COLUMN IF NOT EXISTS exterior_color TEXT,
  ADD COLUMN IF NOT EXISTS interior_color TEXT,
  ADD COLUMN IF NOT EXISTS mileage INTEGER,
  ADD COLUMN IF NOT EXISTS drivetrain TEXT,
  ADD COLUMN IF NOT EXISTS fuel_type TEXT,
  ADD COLUMN IF NOT EXISTS transmission TEXT,
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_date DATE,
  ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS target_frontline_date DATE,
  ADD COLUMN IF NOT EXISTS asking_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS origin_class TEXT,
  ADD COLUMN IF NOT EXISTS is_high_end BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS cost_mechanical DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_body DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_detail DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_parts DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_vendor DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frontline_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_stock_unique
  ON public.vehicles(stock_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON public.vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_vehicles_make ON public.vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicles_rejected ON public.vehicles(is_rejected);

-- Relax service_location: high-end / unclassified rows from CSV imports
-- may legitimately have no assigned shop. Allow NULL but still enforce
-- gmc / honda for any non-null value.
ALTER TABLE public.vehicles
  ALTER COLUMN service_location DROP NOT NULL;

DO $$
DECLARE
  cn TEXT;
BEGIN
  FOR cn IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.vehicles'::regclass
      AND pg_get_constraintdef(oid) LIKE '%service_location%'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicles DROP CONSTRAINT %I', cn);
  END LOOP;
END $$;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_service_location_check
  CHECK (service_location IS NULL OR service_location IN ('gmc', 'honda'));

-- ============================================================================
-- Edit audit log - tracks every manual change to a vehicle profile
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_audit (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by_id UUID REFERENCES public.profiles(id),
  changed_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_audit_vehicle
  ON public.vehicle_audit(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_audit_created
  ON public.vehicle_audit(created_at DESC);

ALTER TABLE public.vehicle_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit" ON public.vehicle_audit
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert audit" ON public.vehicle_audit
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- Inventory imports - every bulk upload batch is tracked
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_imports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source TEXT,
  file_name TEXT,
  rows_total INTEGER DEFAULT 0,
  rows_created INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  rows_rejected INTEGER DEFAULT 0,
  meta JSONB DEFAULT '{}',
  imported_by_id UUID REFERENCES public.profiles(id),
  imported_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.inventory_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view imports" ON public.inventory_imports
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert imports" ON public.inventory_imports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- Realtime publication - ensure new tables are streamed
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_audit'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_audit;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'parts_holds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parts_holds;
  END IF;
END $$;

-- ============================================================================
-- KPI helper view
-- ============================================================================

CREATE OR REPLACE VIEW public.vehicle_kpis AS
SELECT
  v.id,
  v.stock_number,
  v.year,
  v.make,
  v.model,
  v.stage,
  v.grade,
  v.priority,
  v.is_high_end,
  v.is_rejected,
  v.service_location,
  v.created_at,
  v.frontline_at,
  v.estimated_cost,
  v.actual_cost,
  (COALESCE(v.cost_mechanical,0) + COALESCE(v.cost_body,0)
   + COALESCE(v.cost_detail,0) + COALESCE(v.cost_parts,0)
   + COALESCE(v.cost_vendor,0)) AS cost_rollup,
  EXTRACT(EPOCH FROM (COALESCE(v.frontline_at, NOW()) - v.created_at)) / 86400.0 AS days_in_recon
FROM public.vehicles v;
