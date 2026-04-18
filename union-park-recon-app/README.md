# Union Park Buick GMC — Recon Tracker

Hyper-intelligent pre-owned vehicle reconditioning management system.
Live at **www.unionparkgmcrecon.com** (Supabase + Vercel + Next.js 14).

---

## What's new in v2

### 🧠 Built-in intelligence
- **Auto-routing by make** — every vehicle is classified as *domestic*, *import*, or *high-end* the moment you type the make. Domestics go to the GMC shop, imports go to Honda, and high-end brands are flagged automatically.
- **High-end auto-reject** — Audi, BMW, Mercedes, Volvo, Range Rover, Porsche, Jaguar, Bentley, Ferrari, Lamborghini, Rolls-Royce, Aston Martin, McLaren, Maserati, Saab, Lotus, Smart, Land Rover — all flagged "wholesale, don't recondition" with a one-click override.
- **Grade suggestion** — suggests A/B/C/D from mileage, age, and estimated cost when you haven't typed one.
- **VIN validation + year / country decode** — works offline as you type.
- **Risk surfacing** — every vehicle shows aging, stuck-in-stage, over-budget, or sold-but-stalling risks inline.
- **Recommended actions** — one-click "auto-route to GMC", "flag as high-end", "assign grade" suggestions on each vehicle.
- **Predicted frontline ETA** — rolling prediction of when a vehicle will be frontline-ready, based on remaining stages.

### 📥 Bulk inventory import
- Upload a CSV exported from any DMS (vAuto, HomeNet, Cox, Dealertrack, etc.) — column names are auto-detected.
- Preview grid shows every row with auto-classification, high-end flags, and suggested grade before you commit.
- Reject individual rows or remove duplicates in the preview.
- Duplicates by stock number or VIN are **updated**, not duplicated.
- Every import batch is logged in `inventory_imports` with totals.

### ✏️ Full manual editing
- Every field on every vehicle profile can be edited in-place (with role permissions).
- Identity, specs, acquisition, pricing, recon budget (broken into Mechanical / Body / Detail / Parts / Vendor) — all editable.
- Every edit writes to `vehicle_audit` with before/after values, editor name, and timestamp.
- One-click **Flag Wholesale** button captures a reason and removes the car from the active pipeline.

### 🗂 New views
- **Pipeline** (original kanban, enhanced with new mileage/ETA/risk indicators)
- **Inventory** — searchable, filterable, sortable table of the entire fleet with CSV export.
- **Analytics** — KPIs for time-to-frontline, aging buckets, stage distribution, grade mix, shop split (GMC vs Honda), and recon spend by category.

### 🔎 Better day-to-day UX
- Aging alert dropdown in the header.
- Real-time updates across all users (vehicles, notes, stage moves).
- Stock-number deduping on both manual add and CSV import.
- Holding cost and cost rollup visible on every detail card.

---

## Setup (first-time)

### 1. Supabase
1. Sign in at [supabase.com](https://supabase.com) and create a project.
2. In **SQL Editor**, run `supabase/schema.sql` to create the base schema.
3. Then run `supabase/schema-v2.sql` to add v2 columns (rich vehicle fields,
   audit log, inventory imports, view). The migration is idempotent — safe to
   re-run if you upgrade later.
4. Get your `Project URL` and `anon public` key from **Settings → API**.

### 2. Seed users
In **Authentication → Users**, create each user. Click "Show metadata" when
creating and add:
```json
{ "full_name": "Brian Callahan", "role": "admin" }
```

| Email | Role |
|-------|------|
| bcallahan@unionpark.com | admin |
| evandyke@unionpark.com | admin |
| glashbrook@unionpark.com | admin |
| mmolin@unionpark.com | recon_manager |
| dtesta@unionpark.com | service |
| jpatterson@unionpark.com | service |
| bjames@unionpark.com | detail |
| louis@unionpark.com | detail |

(Run `supabase/seed-users.sql` afterward if roles need fixing.)

### 3. Vercel
1. Import the repo into Vercel.
2. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Add `www.unionparkgmcrecon.com` under **Settings → Domains**.

---

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev                         # http://localhost:3000
```

---

## Roles & permissions

| Role | Add | Import | Edit any field | Approve | Move any stage | Flag wholesale |
|------|-----|--------|----------------|---------|----------------|----------------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| recon_manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| service | ❌ | ❌ | limited | ❌ | service / parts | ❌ |
| detail | ❌ | ❌ | limited | ❌ | detail | ❌ |

Service users can edit `cost_mechanical`, `cost_parts`, engine, transmission.
Detail users can edit `cost_detail`.

---

## Workflow stages

1. **Appraisal** — 1d — graded A/B/C/D
2. **Trade Decision** — 1d — retail or wholesale
3. **Service Queue** — 1d — waiting for bay
4. **In Service** — 2d — mechanical
5. **Parts Hold** — 3d — waiting on parts
6. **Approval Needed** — 1d — over budget
7. **Vendor Work** — 2d — PDR, Wheel Medic, etc.
8. **Detail** — 1d
9. **Final Inspection** — 1d
10. **Frontline Ready** — available for sale

Target end-to-end turnaround: **5 days** from stock-in.

---

## Grade thresholds

| Grade | Max expected cost | Description |
|-------|-------------------|-------------|
| A | $500 | Detail only |
| B | $1,200 | Light mechanical |
| C | $1,700 | Moderate work |
| D | $1,700+ | Heavy work or wholesale candidate |

## Approval thresholds

| Cost range | Approver |
|------------|----------|
| Under $1,200 | Auto-approved |
| $1,200–$1,500 | Micah |
| $1,500–$1,700 | Micah or Eric |
| $1,700–$2,000 | Eric |
| Over $2,000 | Eric + Greg |

## Brand classification (for auto-routing)

- **Domestic → GMC shop**: Chevrolet, Buick, GMC, Cadillac, Ford, Lincoln, Chrysler, Dodge, Jeep, Ram, Tesla, Rivian
- **Import → Honda shop**: Honda, Acura, Toyota, Lexus, Nissan, Infiniti, Mazda, Subaru, Mitsubishi, Hyundai, Kia, Genesis, Volkswagen, MINI, Fiat, Alfa Romeo
- **High-end (do NOT recondition)**: Audi, BMW, Mercedes-Benz, Volvo, Range Rover / Land Rover, Jaguar, Porsche, Maserati, Bentley, Ferrari, Lamborghini, Rolls-Royce, Aston Martin, McLaren, Lotus, Saab, Smart

Edit the `BRAND_CLASS` map in `lib/constants.js` if you ever change policy.

---

## Vendor schedule

| Vendor | Days |
|--------|------|
| PDR Guy | Mon, Thu |
| Key Guy | Tue |
| Hubcap Jack | Tue |
| Wheel Medic | Wed |
| Body Shop | As needed |

---

## File structure

```
app/
  dashboard/
    page.js            # orchestrator: auth, data, handlers, tabs
    styles.js          # shared inline styles
    PipelineView.js    # kanban pipeline
    InventoryView.js   # searchable / filterable table + export
    AnalyticsView.js   # KPIs, aging buckets, spend
    AddModal.js        # add a vehicle
    EditModal.js       # full-field editor with audit
    DetailModal.js     # per-vehicle detail with risks + recommended actions
    ImportModal.js     # CSV bulk import with preview
lib/
  constants.js         # roles, grades, stages, brands, cost categories
  intelligence.js      # auto-route, classify, suggest grade, risk analysis
  inventory.js         # CSV parse/export with column auto-mapping
  utils.js             # date math, currency, aging buckets
  supabase.js          # browser client
  supabase-server.js   # server-side client (for future route handlers)
supabase/
  schema.sql           # base schema (v1)
  schema-v2.sql        # migration: new columns + audit + imports + view
  seed-users.sql       # role assignments
```

---

## Support

Contact the developer if you need help with setup or customization.
