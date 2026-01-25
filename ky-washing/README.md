<a href="https://ky-wash.vercel.app/">
  <h1 align="center">KY-Wash - Laundry Management System</h1>
</a>

<p align="center">
 A modern laundry management system built with Next.js and Supabase
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#setup"><strong>Setup Guide</strong></a> ·
  <a href="#documentation"><strong>Documentation</strong></a>
</p>
<br/>

## 🎯 Features

### ✅ Machine Management
- Real-time machine status monitoring
- Start/complete/collect cycles
- Queue management
- Machine availability tracking
- Maintenance logs

### ✅ Analytics & Tracking
- Google Analytics integration
- Custom event tracking
- Machine usage analytics
- Peak hour identification
- User behavior analytics

### ✅ User Experience
- Auto-unlock timer with grace period
- Enhanced notification system (ring + continuous alerts)
- Session tracking
- User notifications
- Machine queue notifications

### ✅ Data Persistence
- **17 PostgreSQL tables** for complete data storage
- All machine cycles tracked
- User sessions logged
- Analytics events recorded
- Real-time synchronization with Supabase

### 🏗️ Tech Stack
- [Next.js](https://nextjs.org) - App Router & Server Components
- [Supabase](https://supabase.com) - PostgreSQL Database & Auth
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - Components
- [Google Analytics](https://analytics.google.com/) - Event Tracking

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start using the app!

## 📋 Complete Setup Guide

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Enter project name: "KY-Wash"
4. Create a strong database password
5. Wait for setup to complete

### Step 2: Get Your Credentials
1. Go to **Settings → API**
2. Copy your **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Step 3: Update Environment Variables
Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

### Step 4: Create Database Tables
1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire SQL schema from [SUPABASE_SCHEMA.md](./SUPABASE_SCHEMA.md)
4. Paste into the editor
5. Click **Run**
6. Verify all 17 tables created

### Step 5: Start the App
```bash
npm run dev
```

### Step 6: Verify Connection
1. Open browser console (F12)
2. Log in to the app
3. Go to Supabase → Table Editor
4. Check `user_sessions` table for your login
5. Check `analytics_events` table for tracked events

---

## 📚 Documentation

- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Complete setup checklist & verification
- **[SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md)** - Integration guide with code examples
- **[SUPABASE_SCHEMA.md](../SUPABASE_SCHEMA.md)** - Database schema & SQL (run in Supabase)
- **[FEATURE_GUIDE.md](./FEATURE_GUIDE.md)** - Feature documentation
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference guide

---

## 🗂️ Project Structure

```
ky-washing/
├── app/
│   ├── machines/          # Machine management page
│   ├── analytics/         # Analytics dashboard
│   └── auth/             # Authentication pages
├── lib/
│   ├── services/         # ✅ Supabase service layer
│   │   ├── machineCycles.ts
│   │   ├── analytics.ts
│   │   ├── machines.ts
│   │   ├── userSessions.ts
│   │   └── notifications.ts
│   ├── supabase/         # Supabase client setup
│   ├── dataCollection.ts # ✅ Now syncs to Supabase
│   └── ...
├── components/           # UI components
├── types/
│   └── supabase.ts      # TypeScript types
└── README.md
```

---

## 💾 Data Syncing

All data is **automatically synced** to Supabase:
- ✅ Machine cycles (start, complete, collect)
- ✅ User sessions (login, logout)
- ✅ Analytics events (all user actions)
- ✅ Notifications (cycle complete, collections, etc.)
- ✅ Machine status (real-time updates)

### Example: Starting a Machine

```typescript
import { useDataCollection } from '@/lib/dataCollection';

export function MyComponent() {
  const { trackEvent } = useDataCollection();

  const handleStart = async () => {
    // Automatically synced to machine_cycles table
    await trackEvent('machine_started', {
      userId: 'user-123',
      machineId: 1,
      machineType: 'washer',
      duration: 45,
    });
  };
}
```

---

## 🔍 API/Service Layer

### Machine Cycles Service
```typescript
import { machineCyclesService } from '@/lib/services/machineCycles';

// Start cycle
await machineCyclesService.startCycle({...});

// Complete cycle
await machineCyclesService.completeCycle(cycleId, {...});

// Mark as collected
await machineCyclesService.markAsCollected(cycleId);
```

### Analytics Service
```typescript
import { analyticsService } from '@/lib/services/analytics';

// Track event
await analyticsService.trackEvent({...});

// Get user analytics
const data = await analyticsService.getUserAnalytics(userId);
```

### Other Services
- **machinesService** - Get/update machine data
- **userSessionsService** - Manage sessions
- **notificationsService** - Send notifications

See [SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md) for complete API docs.

---

## Clone and run locally

1. You'll first need a Supabase project which can be made [via the Supabase dashboard](https://database.new)

2. Create a Next.js app using the Supabase Starter template npx command

   ```bash
   npx create-next-app --example with-supabase with-supabase-app
   ```

   ```bash
   yarn create next-app --example with-supabase with-supabase-app
   ```

   ```bash
   pnpm create next-app --example with-supabase with-supabase-app
   ```

3. Use `cd` to change into the app's directory

   ```bash
   cd with-supabase-app
   ```

4. Rename `.env.example` to `.env.local` and update the following:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[INSERT SUPABASE PROJECT API PUBLISHABLE OR ANON KEY]
  ```
  > [!NOTE]
  > This example uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which refers to Supabase's new **publishable** key format.
  > Both legacy **anon** keys and new **publishable** keys can be used with this variable name during the transition period. Supabase's dashboard may show `NEXT_PUBLIC_SUPABASE_ANON_KEY`; its value can be used in this example.
  > See the [full announcement](https://github.com/orgs/supabase/discussions/29260) for more information.

  Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` can be found in [your Supabase project's API settings](https://supabase.com/dashboard/project/_?showConnect=true)

5. You can now run the Next.js local development server:


   ```bash
   npm run dev
   ```

   The starter kit should now be running on [localhost:3000](http://localhost:3000/).

6. This template comes with the default shadcn/ui style initialized. If you instead want other ui.shadcn styles, delete `components.json` and [re-install shadcn/ui](https://ui.shadcn.com/docs/installation/next)

> Check out [the docs for Local Development](https://supabase.com/docs/guides/getting-started/local-development) to also run Supabase locally.

## Feedback and issues

Please file feedback and issues over on the [Supabase GitHub org](https://github.com/supabase/supabase/issues/new/choose).

## More Supabase examples

- [Next.js Subscription Payments Starter](https://github.com/vercel/nextjs-subscription-payments)
- [Cookie-based Auth and the Next.js 13 App Router (free course)](https://youtube.com/playlist?list=PL5S4mPUpp4OtMhpnp93EFSo42iQ40XjbF)
- [Supabase Auth and the Next.js App Router](https://github.com/supabase/supabase/tree/master/examples/auth/nextjs)
