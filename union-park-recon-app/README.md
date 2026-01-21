# Union Park Buick GMC - Recon Tracker

Pre-owned vehicle reconditioning management system with real-time updates, role-based access, and workflow tracking.

## Features

- **Real-time Dashboard** - See all vehicles in pipeline, updates appear instantly
- **Role-based Access** - Admins, Recon Manager, Service, Detail each see what they need
- **Priority Flags** - Mark vehicles as SOLD-Rush, Customer Waiting, Hot Unit
- **Aging Alerts** - Automatic warnings when vehicles exceed stage time limits
- **Communication Log** - Notes thread on each vehicle, everyone can comment
- **Parts Hold Tracking** - Track parts on order with ETA
- **Stage Workflow** - Appraisal → Service → Detail → Inspection → Frontline
- **Holding Cost Calculator** - $32/day automatically calculated

---

## Setup Instructions

### Step 1: Create Supabase Project (5 minutes)

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Name it `union-park-recon`
4. Set a strong database password (save this!)
5. Choose region closest to you (e.g., East US)
6. Wait for project to initialize (~2 minutes)

### Step 2: Set Up Database (3 minutes)

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the ENTIRE contents of `supabase/schema.sql` from this project
4. Paste into the SQL editor
5. Click "Run" (or Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned"

### Step 3: Get Your API Keys

1. In Supabase, go to **Settings** (gear icon) → **API**
2. Copy these two values:
   - `Project URL` (looks like `https://xxxxx.supabase.co`)
   - `anon public` key (long string starting with `eyJ...`)

### Step 4: Create Users in Supabase

1. Go to **Authentication** → **Users**
2. Click "Add User" → "Create New User"
3. Add each user:

| Email | Password | Role (add in metadata) |
|-------|----------|------------------------|
| bcallahan@unionpark.com | (set password) | admin |
| evandyke@unionpark.com | (set password) | admin |
| mmolin@unionpark.com | (set password) | recon_manager |
| glashbrook@unionpark.com | (set password) | admin |
| dtesta@unionpark.com | (set password) | service |
| jpatterson@unionpark.com | (set password) | service |
| bjames@unionpark.com | (set password) | detail |
| louis@unionpark.com | (set password) | detail |

**Important:** When creating users, click "Show metadata" and add:
```json
{
  "full_name": "Brian Callahan",
  "role": "admin"
}
```

### Step 5: Deploy to Vercel (5 minutes)

1. Push this code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and login
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. In "Environment Variables", add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL from Step 3
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key from Step 3
6. Click "Deploy"
7. Wait for build to complete (~2 minutes)
8. Your app is live at the URL Vercel gives you!

### Step 6: Set Up Custom Domain (Optional)

1. In Vercel, go to your project → Settings → Domains
2. Add your domain (e.g., `recon.unionpark.com`)
3. Follow DNS instructions Vercel provides

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env.local file
cp .env.local.example .env.local
# Edit .env.local with your Supabase keys

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## User Roles & Permissions

| Role | Add Vehicles | Approve $ | Move Any Stage | Allowed Stages |
|------|--------------|-----------|----------------|----------------|
| admin | ✅ | ✅ | ✅ | All |
| recon_manager | ✅ | ✅ | ✅ | All |
| service | ❌ | ❌ | ❌ | Service Queue, Service, Parts Hold |
| detail | ❌ | ❌ | ❌ | Detail |

---

## Workflow Stages

1. **Appraisal** (max 1 day) - Vehicle graded A/B/C/D
2. **Trade Decision** (max 1 day) - Retail or Wholesale
3. **Service Queue** (max 1 day) - Waiting for service bay
4. **In Service** (max 2 days) - Mechanical work
5. **Parts Hold** (max 3 days) - Waiting on parts
6. **Approval Needed** (max 1 day) - Over budget, needs approval
7. **Vendor Work** (max 2 days) - PDR, Wheel Medic, etc.
8. **Detail** (max 1 day) - Interior/exterior detail
9. **Final Inspection** (max 1 day) - Quality check
10. **Frontline Ready** - Available for sale

---

## Grade Thresholds

| Grade | Max Expected Cost | Description |
|-------|-------------------|-------------|
| A | $500 | Detail only |
| B | $1,200 | Light mechanical |
| C | $1,700 | Moderate work |
| D | $1,700+ | Heavy work or wholesale candidate |

---

## Approval Thresholds

| Cost Range | Who Approves |
|------------|--------------|
| Under $1,200 | Auto-approved |
| $1,200-$1,500 | Micah |
| $1,500-$1,700 | Micah or Eric |
| $1,700-$2,000 | Eric |
| Over $2,000 | Eric + Greg |

---

## Vendor Schedule

| Vendor | Days |
|--------|------|
| PDR Guy | Monday, Thursday |
| Key Guy | Tuesday |
| Hubcap Jack | Tuesday |
| Wheel Medic | Wednesday |
| Body Shop | As needed |

---

## Support

Contact the developer if you need help with setup or customization.
