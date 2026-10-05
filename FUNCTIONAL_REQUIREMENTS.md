# CrackQuick — Functional Requirements

Personal DSA tracker for product-company interview prep. Single user, no login.
Goal: keep every question in one place, never miss a revision, and see progress at a glance.

Stack: Next.js (App Router) full stack + MongoDB (Atlas) via Mongoose.

> **Revision 5 (2026-10-04)**: simplified. Gamification (XP, levels, badges, daily quests, review debt, leech/rusty labels, mistake tags, “mastery” score, pattern field) was removed so the dashboard only shows what's needed to track yourself. Nothing is hard-coded: timezone is a setting (default IST, `Asia/Kolkata`), the revision ladder is editable in Settings, and dropdown options come from your own data.

---

## 1. Data

### 1.1 Question

| Field | Purpose |
| --- | --- |
| title | Problem name |
| platform | Chosen from your **Platforms** list (§1.4) |
| platformUrl | Link to the problem; stored in canonical form and used to detect duplicates |
| externalId | LeetCode problem number / GFG problem id; searchable (“146”) and shown as “LeetCode #146” |
| videoUrl | Explanation video |
| notes | Markdown: approach, pitfalls, complexity, code |
| topics[] | From the platform's tags on import, or typed by you |
| companies[] | Companies that ask it (§3.3) |
| difficulty | Easy / Medium / Hard |
| status | `todo` / `in_progress` / `done` |
| timesSolved, lapses | Successful solves/revisions; times blanked |
| lastSolvedAt, nextRevisionAt, revisionStage, confidence | Revision schedule |
| timeSpentMinutes, totalMinutes | Last and total time |
| pattern | Chosen from your **Patterns** list (§1.4), e.g. Two pointers, Sliding window |
| isStarred, archived | Pin; hide without losing history |

### 1.2 Attempt (activity log)

One per Log attempt: `questionId`, `type` (`solved` first time / `revised` later / `failed_recall` blanked), `at`, `confidence`, `minutes`, `onTime`, `difficulty` snapshot, `backfill` flag, and `prev` (schedule before the attempt, for **Undo last log**). History, streak, heatmap and period progress all come from these.

### 1.3 Settings

`interviewDate`, `intervals` (revision ladder in days, default `1, 3, 7, 14, 30, 60, 90`), `timezone` (default `Asia/Kolkata`, IST).

### 1.4 Platforms and patterns (managed lists)

- Two lists you control: **Platforms** (LeetCode, Codeforces, …) and **Patterns** (Two pointers, Sliding window, …). Nothing is pre-filled.
- **Create**: “+ Add new…” at the bottom of the dropdown while adding/editing a question, or in Settings.
- **Rename**: in the dropdown's **Manage** dialog or Settings; every question using the old name is updated. Names are unique ignoring case.
- **Delete**: shows how many questions use it; those questions keep everything else and just lose that value.
- A value used by a question is always in its list: importing from LeetCode/GFG adds that platform automatically; a platform detected from a pasted link is added when the question is saved.

---

## 2. Questions

- **Add from LeetCode / GeeksforGeeks** (default on the Add page):
  - LeetCode: numbers (`1, 15, 146`), ranges (`200-210`), links, slugs or exact names.
  - GeeksforGeeks: links, problem ids, slugs or names.
  - Up to 100 per lookup; preview with checkboxes in your input order; ones already in the library are flagged.
  - Fills title, difficulty, topics (platform tags), companies, problem number and a YouTube search link for a video.
  - Optional pattern applied to everything imported.
- **Add manually**: pasting a LeetCode/GFG link fetches the same details.
- **Already solved before using the app?** Tick it when adding (or in the Log dialog for an untouched question) with the date and how well you know it. It's scheduled from that date, so old solves land in the review queue if they're due.
- Edit any field except the schedule (that changes only by logging attempts). Status can be reset to todo / in progress (clears the schedule; history kept). **Done is reached only by logging an attempt.**
- Archive (hide, keep history) or Delete (removes question and its history).
- Library: search (title, notes, topics, companies, pattern, problem number), filters (schedule, difficulty, status, last done, confidence, topic, pattern, company, platform, starred, archived; options come from your data), sort, 50 per page, filters kept in the URL.

## 3. Revision

### 3.1 Log attempt

Two clicks: **Log** → grade. Grades: **Blanked** or confidence **1–5** (1 needed the solution … 5 instant). Optional minutes. Each grade shows the resulting next-review interval before you click.

### 3.2 Schedule

The ladder is the `intervals` list from Settings. Per attempt:

| Result | Step on the ladder |
| --- | --- |
| Blanked or confidence 1 | back to the first step (blank also sets status to in progress) |
| Confidence 2 | one step down |
| Confidence 3 | same step |
| Confidence 4–5 | one step up, unless reviewed early (before its due day) |

Next review = midnight (in the app timezone, IST by default) today + that step's days. **Due today** / **overdue** use the calendar day in that timezone.

### 3.3 Company tags

- GFG: from GFG.
- LeetCode: LeetCode only shows them to Premium users, so they come from the community dataset [liquidslr/leetcode-company-wise-problems](https://github.com/liquidslr/leetcode-company-wise-problems), compiled into `src/data/leetcode-companies.json` (refresh: `npm run update:companies`). All companies kept, biggest first.
- Settings → **Fill missing company tags** backfills older questions.

### 3.4 Review session

Steps through due + overdue (or in progress / low confidence / starred). Notes, pattern and topic tags are hidden until **Reveal** so you recall first. Keys: `Space` reveal, `1–5` grade, `B` blanked, `S` skip. Ends with a short summary.

### 3.5 Undo

**Undo last log** on a question restores its previous schedule and removes that attempt.

## 4. Tracking

### 4.1 Desk (dashboard)

- Done / total with progress bar; in progress; not started.
- Interview countdown and pace needed (if a date is set).
- Due today · Overdue · In progress · Streak (each links to the filtered list).
- **To revise** list (overdue first) with **Start review**.
- **Topics**: done / total per topic, least complete first, overdue count.
- Activity heatmap (as many recent weeks as fit the screen, up to a year).

### 4.2 Progress

Window: today · week · month · quarter · half-year · year · all time. For the window: new solved, revised, blanked, active days, minutes, each compared with the same span of the previous window; difficulty mix of new solves; topics practised; heatmap; all topics with done / total.

## 5. Settings & data

- Interview date, revision intervals, timezone (default IST).
- Platforms and Patterns lists (add / rename / delete).
- Import JSON, export a full JSON backup.
- `npm run reset-db` (dry run) / `npm run reset-db -- --yes`: backs up to `backups/` then deletes all questions and history (settings kept).

## 5a. Music player

- **♪ Music** button (bottom-right, every page) opens a small player for your YouTube playlists (Settings → Music playlists: add / edit / delete / reorder; any YouTube playlist, mix or video link).
- Playlist dropdown, song title, “Song n of N”, previous / play-pause / next. Unplayable songs are skipped automatically. Remembers the last playlist on this device.
- Keeps playing while you move between pages. **Minimize (–)** hides the player completely (video included) while the music keeps playing; the floating button shows the current song with play/pause and reopens the player. ✕ stops it.
- Note: YouTube's embed terms ask for a visible player; hiding it is a deliberate choice for this personal app.

## 6. Non-functional

- `MONGODB_URI` only in `.env.local` (git-ignored); `.env.example` is a placeholder.
- Timezone comes from Settings (default IST), not the device or server: the server applies it on every DB connect, and the root layout passes it to the browser so both agree on “today”.
- A failed MongoDB connect isn't cached, so the app recovers when the DB is back.
- LeetCode/GFG lookups use their public (unofficial) endpoints server-side; if they change, lookup shows an error and manual add still works.
- Works at phone width.

## 7. Out of scope

Accounts, gamification, leaderboards, code execution, native apps, AI solving. Future ideas if needed: more preset lists, reminders (calendar feed), time-to-solve analytics.
