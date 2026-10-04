# CrackQuick

Personal DSA interview tracker with spaced revision (Next.js 16 + MongoDB). Spec: [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md).

## Run

1. Copy `.env.example` to `.env.local` and fill in your Atlas connection string.
2. `npm install`
3. `npm run dev` and open http://localhost:3000
4. **+ Add** → **From LeetCode / GFG**: enter problem numbers (`1, 15, 146`, `200-210`), links or names.

## Using it

- **Log** on a question → *Blanked* or confidence 1–5. That schedules the next review on your ladder (Settings → Revision intervals, default 1 / 3 / 7 / 14 / 30 / 60 / 90 days).
- **Review** steps through what's due with notes and topics hidden until you reveal them. Keys: `Space` reveal, `1–5` grade, `B` blanked, `S` skip.
- **Platform** and **Pattern** are dropdowns you manage: “+ Add new…” in the dropdown, **Manage** to rename/delete (also in Settings).
- Solved something before using the app? Tick **“already solved”** when adding it, with the date.
- **Undo last log** on the question page reverts a mis-click.
- All dates and "today" are in IST by default (Settings → Timezone), whatever the device or server timezone.

## Scripts

- `npm run reset-db`: shows what's in the database. `npm run reset-db -- --yes` backs everything up to `backups/` and deletes all questions and history (settings kept).
- `npm run update:companies`: refreshes LeetCode company tags from the community dataset into `src/data/leetcode-companies.json`.

## Layout

- `src/lib/revision.ts`: schedule rules
- `src/lib/attempts.ts`: logging + undo
- `src/lib/stats.ts`: Desk / Progress numbers
- `src/lib/platforms.ts`: LeetCode / GFG lookups
- `src/lib/dates.ts`: calendar helpers in the app timezone
- `src/lib/options.ts`: platform / pattern lists (rename & delete cascade to questions)
- `src/models/`: Question, ActivityEvent, Settings, ListOption
