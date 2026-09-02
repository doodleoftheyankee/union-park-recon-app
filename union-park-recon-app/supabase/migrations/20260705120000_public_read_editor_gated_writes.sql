-- ---------------------------------------------------------------------------
-- Access model: public read, admin/recon-manager write
--
-- Per Brian's decision after the July session:
--   * Anonymous visitors can VIEW the dashboard / board / sales pages.
--   * Only admins and recon managers can INSERT / UPDATE / DELETE anything.
--   * Service and detail techs are read-only in this pass (was: limited edit).
--   * Profile and inventory_imports rows stay behind auth — they hold
--     employee info and file paths that don't belong in public view.
--
-- Rollback plan: revert this migration file and RLS goes back to authenticated
-- reads only.
-- ---------------------------------------------------------------------------

-- Helper: does the current caller have edit rights?
CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'recon_manager')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_editor() TO anon, authenticated;

-- Vehicles: public read, editor-only writes.
DROP POLICY IF EXISTS "Users can view all vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can insert vehicles"   ON public.vehicles;
DROP POLICY IF EXISTS "Users can update vehicles"   ON public.vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles"   ON public.vehicles;

CREATE POLICY "vehicles_public_select" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "vehicles_editor_insert" ON public.vehicles FOR INSERT WITH CHECK (public.is_editor());
CREATE POLICY "vehicles_editor_update" ON public.vehicles FOR UPDATE USING (public.is_editor());
CREATE POLICY "vehicles_editor_delete" ON public.vehicles FOR DELETE USING (public.is_editor());

-- Notes.
DROP POLICY IF EXISTS "Users can view all notes"    ON public.notes;
DROP POLICY IF EXISTS "Users can insert notes"      ON public.notes;
DROP POLICY IF EXISTS "Users can update notes"      ON public.notes;
DROP POLICY IF EXISTS "Users can delete notes"      ON public.notes;

CREATE POLICY "notes_public_select"   ON public.notes FOR SELECT USING (true);
CREATE POLICY "notes_editor_insert"   ON public.notes FOR INSERT WITH CHECK (public.is_editor());
CREATE POLICY "notes_editor_update"   ON public.notes FOR UPDATE USING (public.is_editor());
CREATE POLICY "notes_editor_delete"   ON public.notes FOR DELETE USING (public.is_editor());

-- Stage history.
DROP POLICY IF EXISTS "Users can view all stage history" ON public.stage_history;
DROP POLICY IF EXISTS "Users can insert stage history"   ON public.stage_history;
DROP POLICY IF EXISTS "Users can update stage history"   ON public.stage_history;
DROP POLICY IF EXISTS "Users can delete stage_history"   ON public.stage_history;

CREATE POLICY "stage_history_public_select" ON public.stage_history FOR SELECT USING (true);
CREATE POLICY "stage_history_editor_insert" ON public.stage_history FOR INSERT WITH CHECK (public.is_editor());
CREATE POLICY "stage_history_editor_update" ON public.stage_history FOR UPDATE USING (public.is_editor());
CREATE POLICY "stage_history_editor_delete" ON public.stage_history FOR DELETE USING (public.is_editor());

-- Shop bills.
DROP POLICY IF EXISTS "Users can view shop_bills"     ON public.shop_bills;
DROP POLICY IF EXISTS "Users can insert shop_bills"   ON public.shop_bills;
DROP POLICY IF EXISTS "Users can update shop_bills"   ON public.shop_bills;
DROP POLICY IF EXISTS "Users can delete shop_bills"   ON public.shop_bills;

CREATE POLICY "shop_bills_public_select" ON public.shop_bills FOR SELECT USING (true);
CREATE POLICY "shop_bills_editor_insert" ON public.shop_bills FOR INSERT WITH CHECK (public.is_editor());
CREATE POLICY "shop_bills_editor_update" ON public.shop_bills FOR UPDATE USING (public.is_editor());
CREATE POLICY "shop_bills_editor_delete" ON public.shop_bills FOR DELETE USING (public.is_editor());

-- Stage settings: read public, edit editor.
DROP POLICY IF EXISTS "stage_settings_select" ON public.stage_settings;
DROP POLICY IF EXISTS "stage_settings_upsert" ON public.stage_settings;
DROP POLICY IF EXISTS "stage_settings_insert" ON public.stage_settings;

CREATE POLICY "stage_settings_public_select" ON public.stage_settings FOR SELECT USING (true);
CREATE POLICY "stage_settings_editor_update" ON public.stage_settings FOR UPDATE USING (public.is_editor());
CREATE POLICY "stage_settings_editor_insert" ON public.stage_settings FOR INSERT WITH CHECK (public.is_editor());

-- Inventory imports: KEEP auth-gated. Filenames + error messages aren't for
-- the public sales floor.
-- (Original policies preserved.)

-- Profiles: KEEP auth-gated. Emails / staff names.
-- (Original policies preserved.)
