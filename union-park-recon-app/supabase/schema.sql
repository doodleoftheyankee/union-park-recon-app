-- Union Park Recon Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'recon_manager', 'service', 'detail')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stock_number TEXT NOT NULL,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  vin TEXT,
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D')),
  service_location TEXT NOT NULL CHECK (service_location IN ('gmc', 'honda')),
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  actual_cost DECIMAL(10,2) DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'appraisal',
  priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'sold', 'customer_waiting', 'hot_unit')),
  decision TEXT CHECK (decision IN ('retail', 'wholesale')),
  vendors TEXT[] DEFAULT '{}',
  appraiser_id UUID REFERENCES public.profiles(id),
  appraiser_name TEXT,
  inspection_checklist JSONB DEFAULT '{}',
  inspected_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stage history table (tracks time in each stage)
CREATE TABLE public.stage_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exited_at TIMESTAMP WITH TIME ZONE,
  moved_by_id UUID REFERENCES public.profiles(id),
  moved_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes table (communication log)
CREATE TABLE public.notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'note' CHECK (note_type IN ('note', 'movement', 'priority', 'parts', 'inspection', 'approval')),
  created_by_id UUID REFERENCES public.profiles(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts hold table
CREATE TABLE public.parts_holds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  part_number TEXT,
  supplier TEXT,
  ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expected_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  ordered_by_id UUID REFERENCES public.profiles(id),
  ordered_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_vehicles_stage ON public.vehicles(stage);
CREATE INDEX idx_vehicles_priority ON public.vehicles(priority);
CREATE INDEX idx_vehicles_created_at ON public.vehicles(created_at);
CREATE INDEX idx_stage_history_vehicle ON public.stage_history(vehicle_id);
CREATE INDEX idx_notes_vehicle ON public.notes(vehicle_id);
CREATE INDEX idx_parts_holds_vehicle ON public.parts_holds(vehicle_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_holds ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read all data
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all vehicles" ON public.vehicles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all stage history" ON public.stage_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all notes" ON public.notes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view all parts holds" ON public.parts_holds
  FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies: Authenticated users can insert
CREATE POLICY "Users can insert vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can insert stage history" ON public.stage_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can insert notes" ON public.notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can insert parts holds" ON public.parts_holds
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies: Authenticated users can update
CREATE POLICY "Users can update vehicles" ON public.vehicles
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update stage history" ON public.stage_history
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update parts holds" ON public.parts_holds
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'service')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for vehicles and notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stage_history;

-- Insert initial users (run after users sign up, or use Supabase dashboard)
-- Example: After Brian signs up, update his role:
-- UPDATE public.profiles SET role = 'admin', full_name = 'Brian Callahan' WHERE email = 'bcallahan@unionpark.com';
