# reitbeteiligung.app

A Next.js 14 (App Router, TypeScript) starter for reitbeteiligung.app using Supabase Auth and Postgres.

## What is included

- Supabase browser and server clients in `lib/supabase/client.ts` and `lib/supabase/server.ts`
- Email/password signup and login with Supabase Auth
- Server-side route protection for authenticated pages
- Onboarding flow that inserts the current auth user into `public.profiles` with `owner` or `rider`
- Role-aware dashboard navigation
- Owner horse listing create/edit flow backed by `public.horses`
- Rider profile create/edit flow backed by `public.rider_profiles`
- Minimal Tailwind CSS setup

## Environment variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

These values are used for both browser and server-side Supabase clients. This starter assumes your `public` schema already contains:

- `profiles`
- `horses`
- `rider_profiles`
- `trial_requests`
- `approvals`
- `availability_slots`
- `booking_requests`

It also assumes RLS policies already allow authenticated users to read and write the rows they own.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open `http://localhost:3000`.

## Deployment on Vercel

1. Import the repository into Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project settings.
3. Deploy using the default Next.js build command (`next build`).
4. Make sure your Supabase Auth URL settings include the deployed Vercel domain.

## App routes

- `/` public landing page
- `/signup` email/password signup
- `/login` email/password login
- `/logout` sign-out confirmation page
- `/onboarding` role selection for new authenticated users
- `/dashboard` protected role-aware dashboard
- `/owner/horses` protected owner listing manager
- `/rider/profile` protected rider profile editor

## Notes

- On login, the app checks whether the current auth user already has a row in `public.profiles`. If not, it redirects to `/onboarding`.
- The owner dashboard surfaces the `is_premium` flag from `public.profiles` so you can gate availability and booking features later.
- This workspace did not have Node.js or Git available in the shell, so dependency installation, builds, and commits were not run from here.
