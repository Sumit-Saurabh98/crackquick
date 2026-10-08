# CrackQuick

DSA interview tracker with spaced revision (Next.js 16 + MongoDB). Shared question catalog curated by editors and admins (role-based access); every user has their own progress, notes and schedule. Spec: [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md).

## Run

1. Copy `.env.example` to `.env.local`: Atlas connection string, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), and optionally GitHub / Google OAuth keys (callback URLs are in the file).
2. `npm install`
3. `npm run dev`, open http://localhost:3000 and create an account. Make it the first admin with `npm run set-role -- you@example.com admin`; after that, roles are changed on the **Users** page.
4. Admin / editor: **+ Add** → **From LeetCode / GFG**: enter problem numbers (`1, 15, 146`, `200-210`), links or names. Users see **+ Suggest** instead; their suggestions wait in **Submissions** for review.

## Using it

- **Log** on a question → *Blanked* or confidence 1–5. That schedules the next review on your ladder (Settings → Revision intervals, default 1 / 3 / 7 / 14 / 30 / 60 / 90 days).
- **Review** steps through what's due with notes and topics hidden until you reveal them. Keys: `Space` reveal, `1–5` grade, `B` blanked, `S` skip.
- **Platform** and **Pattern** are dropdowns editors and admins manage: “+ Add new…” in the dropdown, **Manage** to rename/delete (also in Settings).
- **♪ Music** (bottom-right) plays your YouTube playlists from Settings → Music playlists, with previous / play-pause / next. Minimize (–) hides it while the music keeps playing; the floating button shows the song and reopens it.
- Solved something before using the app? Tick **“already solved”** in the Log dialog, with the date.
- **Hide for me** takes a question out of your lists only. Editors and admins can **Retire** a question (out of the catalog for everyone, history kept); admins can Delete it.
- **Undo last log** on the question page reverts a mis-click.
- All dates and "today" are in IST by default (Settings → Timezone), whatever the device or server timezone.

## Scripts

- `npm run set-role -- you@example.com admin`: sets a role (`user`, `editor`, `admin`); with no arguments, lists accounts.
- `npm run reset-db`: shows what's in the database. `npm run reset-db -- --yes` backs everything up to `backups/` and deletes all questions, progress, history and submissions (accounts and settings kept).
- `npm run update:companies`: refreshes LeetCode company tags from the community dataset into `src/data/leetcode-companies.json`.

## Layout

- `src/lib/revision.ts`: schedule rules
- `src/lib/attempts.ts`: logging + undo
- `src/lib/stats.ts`: Desk / Progress numbers
- `src/lib/platforms.ts`: LeetCode / GFG lookups
- `src/lib/dates.ts`: calendar helpers in the user's timezone (per request on the server: `requestContext.ts`)
- `src/lib/rbac.ts`: roles → permissions (the whole access policy)
- `src/lib/auth.ts`, `src/lib/viewer.ts`: sign-in config; `route({ permission })` wraps every API route with the session / permission check
- `src/lib/catalog.ts`, `src/lib/submissions.ts`: shared catalog fields; suggest → approve
- `src/lib/options.ts`: platform / pattern lists (rename & delete cascade to questions)
- `src/models/`: Question (catalog), Progress (per user), ActivityEvent, Settings, ListOption, Submission
