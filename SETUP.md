# Therapy by Carole — App Setup & Deployment Guide

## What You Have

A full-stack exercise prescription app with:

- **Client portal** — sticky header, tabbed exercises/information/progress, 14-day compliance tracker, session logging
- **Therapist portal** — client management, exercise library with AI generation, programme builder, information articles
- **GDPR-compliant auth** — Supabase Auth with consent checkbox on login
- **Responsive video** — YouTube and Vimeo embed, auto-sized for portrait/landscape
- **Brand colours** — #2f456f, #efe7dc, #c47a5a, #333333 throughout

---

## Step 1 — Create Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
3. Name it `therapy-by-carole` (or similar)
4. Choose a strong database password — save it somewhere safe
5. Select **Europe West** as your region (closest to Scotland)
6. Wait ~2 minutes for provisioning

### Run the Database Schema

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `supabase-schema.sql` from this project
4. Paste the entire contents into the editor
5. Click **Run**

You should see "Success" with no errors.

---

## Step 2 — Get Your Supabase Credentials

1. In Supabase, go to **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://abcdefghijkl.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 3 — Create Your Therapist Account

1. In Supabase, go to **Authentication → Users**
2. Click **Invite user**
3. Enter `info@therapybycarole.co.uk`
4. Set a strong password
5. Click **Create user** — note the User ID (UUID)
6. Go to **SQL Editor** and run:

```sql
INSERT INTO profiles (id, full_name, email, role, gdpr_consent, gdpr_consent_date)
VALUES (
  'b1cd5200-a6c7-4d12-9aed-4b732a74a7d4',
  'Carole Andrews',
  'info@therapybycarole.co.uk',
  'therapist',
  true,
  NOW()
);
```
   
---

## Step 4 — Deploy to Netlify

### Option A — Deploy from GitHub (recommended)

1. Push this project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit — Therapy by Carole app"
   git remote add origin https://github.com/your-username/therapy-by-carole.git
   git push -u origin main
   ```

2. Go to [netlify.com](https://netlify.com) and sign up / log in
3. Click **Add new site → Import an existing project**
4. Connect your GitHub account and select your repository
5. Build settings will auto-detect from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `build`
6. Before deploying, click **Environment variables** and add:
   - `REACT_APP_SUPABASE_URL` → your Project URL
   - `REACT_APP_SUPABASE_ANON_KEY` → your anon key
7. Click **Deploy site**

### Option B — Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
cd therapy-app
netlify init
netlify env:set REACT_APP_SUPABASE_URL "https://your-ref.supabase.co"
netlify env:set REACT_APP_SUPABASE_ANON_KEY "your-anon-key"
netlify deploy --prod
```

---

## Step 5 — Configure Supabase Auth Redirect URLs

1. In Supabase, go to **Authentication → URL Configuration**
2. Add your Netlify URL to **Redirect URLs**:
   - `https://your-site-name.netlify.app/*`
   - Later: `https://your-custom-domain.co.uk/*`
3. Set **Site URL** to your Netlify URL

---

## Step 6 — Invite Your First Client

In the therapist portal:

1. Sign in at your Netlify URL with your therapist credentials
2. Go to **Clients → Invite Client**
3. Enter their name and email
4. They receive an invitation email to set their password
5. Once they sign in, you can assign exercises to their programme

---

## Step 7 — Add Exercises to the Library

In the therapist portal under **Exercise Library**:

- **Add manually** — click Add Exercise, fill in name, category, description, video URL, sets/reps
- **AI Generate** — click AI Generate, describe what you need (e.g. "hip hinge suitable for osteoporosis with wall support option"), review and edit the draft, then save

Exercises auto-sort alphabetically within their category.

---

## Custom Domain (Optional)

1. In Netlify, go to **Domain management → Add custom domain**
2. Enter your domain (e.g. `app.therapybycarole.co.uk`)
3. Follow Netlify's DNS instructions — typically adding a CNAME record via your domain registrar
4. Netlify provides free SSL automatically

---

## Apple App Store / Google Play (Future)

When you're ready to go native:

**Option A — Capacitor (recommended)**
Wraps this React app in a native shell with minimal code changes:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init
npx cap add ios
npx cap add android
npm run build
npx cap sync
```
Then open in Xcode (iOS) or Android Studio.

**Option B — Progressive Web App**
Add a `manifest.json` and service worker — users can "Add to Home Screen" without going through the app stores. Good interim step.

---

## GDPR Compliance Checklist

- ✅ Consent checkbox on login — recorded with timestamp
- ✅ Data deletion request: `info@therapybycarole.co.uk`
- ✅ Row Level Security — clients only see their own data
- ✅ Data held in EU (Supabase Europe West region)
- ☐ Add a Privacy Policy page (template available on ICO website)
- ☐ Register with ICO as a data controller (£40/year, required if processing health data)
- ☐ Consider a Data Processing Agreement with Supabase (available in their enterprise tier)

---

## Maintenance

### Backup Your Database
In Supabase → **Database → Backups** — daily backups are automatic on paid plans. Free tier: manual exports via **SQL Editor → Export**.

### Update the App
Push changes to GitHub — Netlify auto-deploys on every push to `main`.

### Monitor Usage
Supabase free tier includes:
- 500MB database
- 1GB file storage  
- 50,000 monthly active users

More than enough to start. Upgrade to Pro ($25/month) when you're ready.

---

## Troubleshooting

**Login not working**
→ Check Supabase redirect URLs include your Netlify domain

**"Profile not found" after login**
→ Run the INSERT statement in Step 3 to create your therapist profile

**Exercises not showing for client**
→ Ensure the programme is set to `is_active = true` in Supabase Table Editor

**AI generation fails**
→ The AI feature uses the Claude API via the app's built-in integration. Check your network connection and try again.

**Video not embedding**
→ Paste the full YouTube/Vimeo URL, not a shortened link. YouTube: `https://www.youtube.com/watch?v=XXXX`, Vimeo: `https://vimeo.com/XXXXXXX`

---

## Project File Structure

```
therapy-app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── client/
│   │   │   ├── ClientDashboard.js     ← Main client view
│   │   │   ├── ComplianceTracker.js   ← 14-day progress view
│   │   │   └── LogSessionModal.js     ← Session logging
│   │   ├── therapist/
│   │   │   ├── TherapistDashboard.js  ← Therapist shell
│   │   │   ├── ExerciseLibrary.js     ← Library + AI generation
│   │   │   └── ClientManager.js       ← Client management
│   │   └── shared/
│   │       └── VideoPlayer.js         ← YouTube/Vimeo embed
│   ├── hooks/
│   │   └── useAuth.js                 ← Auth context
│   ├── lib/
│   │   └── supabase.js                ← DB client + categories
│   ├── pages/
│   │   └── LoginPage.js               ← GDPR login
│   ├── styles/
│   │   └── globals.css                ← Brand styles
│   ├── App.js                         ← Router
│   └── index.js                       ← Entry point
├── supabase-schema.sql                ← Run this in Supabase
├── netlify.toml                       ← Netlify config
├── .env.example                       ← Credentials template
└── package.json
```

---

Questions? Email info@therapybycarole.co.uk or check [Supabase docs](https://supabase.com/docs) and [Netlify docs](https://docs.netlify.com).
