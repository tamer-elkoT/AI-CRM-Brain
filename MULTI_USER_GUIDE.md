# Multi-User Testing Guide: Sales Reps & Managers

## How it works

```
Zoho CRM deal owner name  ──────►  CRM User `name` field  ──────►  WhatsApp phone_number
     "Ahmed Hassan"          match       "Ahmed Hassan"            +201xxxxxxxxx
```

**The link between Zoho and your CRM is the deal `owner_name`.**  
When the scheduler runs, it looks up users by `name.ilike(deal.owner_name)`.

---

## Step-by-Step: Add a Sales Rep or Manager

### Step 1 — Admin Sends Invite

As admin, go to **Settings → Team** (or use the API directly):

```
POST /api/v1/auth/invite
Authorization: Bearer <your-admin-token>
{
  "email": "ahmed.hassan@company.com",
  "role": "rep"        ← or "manager"
}
```

This generates a **magic link** like:
```
http://localhost:5173/signup/team?token=eyJ...
```

### Step 2 — Rep Signs Up

Rep opens the magic link in browser, fills in:
- **Name** ← MUST match exactly how their name appears in Zoho deal "Owner" field
- **Password**
- **Phone number** ← their WhatsApp number with country code (e.g. +201012345678)

### Step 3 — Rep Logs In

Rep logs in at `http://localhost:5173/auth` with their email and password.

### Step 4 — Zoho Sync Maps the Deals

When deals are synced from Zoho, the `owner_name` on each deal is stored.
The scheduler matches `owner_name` → `User.name` to find who to notify.

### Step 5 — WhatsApp Notifications

The scheduler runs every 60 min and sends alerts to each rep's registered phone.

---

## Roles & Permissions

| Role | Sees | Notes |
|------|------|-------|
| `admin` | All deals, all users | Can invite users, access all settings |
| `manager` | All deals in company | Read-only on team data |
| `rep` | Only their own deals | Filtered by `owner_name` match |

---

## Quick Test: Invite via API

```bash
# 1. Get your admin token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tamerelkot@gmail.com","password":"Admin@1234"}'

# 2. Send invite (replace TOKEN)
curl -X POST http://localhost:8000/api/v1/auth/invite \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"rep@test.com","role":"rep"}'

# 3. Copy the invite_token from the response and open:
#    http://localhost:5173/signup/team?token=<invite_token>
```

---

## Trigger WhatsApp Notifications Manually

```bash
cd /mnt/d/01_Projects/NLP/AI\ CRM\ Brain/AI-CRM-Brain
conda activate CRM
python trigger_scheduler.py
```

---

## Important: Name Must Match Zoho

If Zoho shows deal owner as **"Ahmed Hassan"** then the CRM user's **name** must be exactly **"Ahmed Hassan"** (case-insensitive).

The rep sets this during signup, or you can update it in Settings → Profile.
