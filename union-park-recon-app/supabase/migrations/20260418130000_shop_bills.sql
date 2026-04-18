-- Shop bills: every invoice entered for a vehicle lives here as its own
-- row. actual_cost on vehicles is an aggregate of these + any manual edits.

CREATE TABLE IF NOT EXISTS public.shop_bills (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  shop TEXT,                    -- 'gmc' | 'honda' | 'pdr' | 'body_shop' | 'wheel_medic' | 'key_guy' | 'hubcap_jack' | 'other'
  category TEXT,                -- 'mechanical' | 'body' | 'detail' | 'parts' | 'vendor'
  invoice_number TEXT,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  billed_on DATE DEFAULT CURRENT_DATE,
  entered_by_id UUID REFERENCES public.profiles(id),
  entered_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_bills_vehicle
  ON public.shop_bills(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_shop_bills_billed_on
  ON public.shop_bills(billed_on DESC);

ALTER TABLE public.shop_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shop bills" ON public.shop_bills
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert shop bills" ON public.shop_bills
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update shop bills" ON public.shop_bills
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete shop bills" ON public.shop_bills
  FOR DELETE USING (auth.role() = 'authenticated');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shop_bills'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_bills;
  END IF;
END $$;
