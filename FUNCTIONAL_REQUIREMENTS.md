# CrackQuick — Functional Requirements

DSA tracker for product-company interview prep. Multi-user: one shared question catalog curated by editors and admins; each user's progress, notes, schedule and settings are their own.
Goal: keep every question in one place, never miss a revision, and see progress at a glance.

Stack: Next.js (App Router) full stack + MongoDB (Atlas) via Mongoose; sign-in with Better Auth (same database).

> **Revision 6 (2026-10-09)**: accounts and role-based access (user / editor / admin, stored per account). Sign in with email + password, GitHub or Google; anyone can sign up. Questions split into a shared catalog (admin-owned) and per-user progress. Users suggest new questions and edits; admins approve them. Timezone, ladder, interview date and playlists are per user.

> **Revision 5 (2026-10-04)**: simplified. Gamification (XP, levels, badges, daily quests, review debt, leech/rusty labels, mistake tags, “mastery” score, pattern field) was removed so the dashboard only shows what's needed to track yourself. Nothing is hard-coded: timezone is a setting (default IST, `Asia/Kolkata`), the revision ladder is editable in Settings, and dropdown options come from your own data.

---

## 0. Accounts and roles

- **Sign in**: email + password (8+ characters), **GitHub** or **Google** (each button appears once its OAuth keys are set). Anyone can sign up. A GitHub/Google login with the same verified email as an existing account signs in to that account.
- Signed-out visitors are sent to `/login` (then back to the page they wanted). Every API route checks the session on the server, and the permission it needs.
- **Role-based access** (`src/lib/rbac.ts`). Each account has one role, stored on the account in the database (new accounts: `user`). Roles grant permissions; the server checks permissions, never role names. The role is read from the database on each request, so a change applies on the user's next click.

  | Permission | What it allows | user | editor | admin |
  | --- | --- | :-: | :-: | :-: |
  | `practice.track` | Practise: Desk, Review, Progress; log / undo attempts, star, notes, hide, reset status; interview date and revision ladder; music player and playlists; personal export | ✓ | ✓ | |
  | `catalog.edit` | Add (LeetCode/GFG lookup of up to 100 at once, manual, JSON import), edit and retire questions; fill company tags | | ✓ | ✓ |
  | `catalog.delete` | Delete questions | | | ✓ |
  | `lists.manage` | Add / rename / delete Platforms and Patterns | | ✓ | ✓ |
  | `submissions.review` | See everyone's suggestions; approve / reject | | ✓ | ✓ |
  | `users.manage` | **Users** page: see all accounts, change roles | | | ✓ |

- **Without any permission** a signed-in account can browse the catalog, set its timezone and **suggest** new questions and edits (§2a). Practising needs `practice.track`, which users and editors have.
- **Admins are management-only**: no Desk, Review or Progress (those pages send them to the catalog), no log / star / notes / hide, no interview date or revision ladder, no music. Their Questions list is the catalog (no personal filters; sorted by recently updated), and a question page shows its details with Edit / Retire / Delete. The server refuses practice requests from them (403), not just the UI.
- **Users page** (admins): every account with its sign-in methods and join date, and a role picker. The last admin can't be demoted. The first admin is made from the command line: `npm run set-role -- <email> admin` (the account must exist).
- New users see the whole catalog straight away, every question starting as todo.

## 1. Data

### 1.1 Question (shared catalog, changed with `catalog.edit`)

| Field | Purpose |
| --- | --- |
| title | Problem name |
| platform | Chosen from the **Platforms** list (§1.4) |
| platformUrl | Link to the problem; stored in canonical form and used to detect duplicates |
| externalId | LeetCode problem number / GFG problem id; searchable (“146”) and shown as “LeetCode #146” |
| videoUrls[] | Explanation videos (any number of links) |
| topics[] | From the platform's tags on import, or typed in |
| companies[] | Companies that ask it (§3.3) |
| difficulty | Easy / Medium / Hard |
| pattern | Chosen from the **Patterns** list (§1.4), e.g. Two pointers, Sliding window |
| retired | Taken out of the catalog by an editor/admin: gone from everyone's lists, history kept |

### 1.1a Progress (per user, per question)

Created on the user's first change to a question; absent = untouched (todo).

| Field | Purpose |
| --- | --- |
| status | `todo` / `in_progress` / `done` |
| timesSolved, lapses | Successful solves/revisions; times blanked |
| lastSolvedAt, nextRevisionAt, revisionStage, confidence | Revision schedule |
| timeSpentMinutes, totalMinutes | Last and total time |
| notes | Markdown: approach, pitfalls, complexity, code (private) |
| isStarred, archived | Pin; **hide for me** (out of my lists and queue, history kept) |

### 1.2 Attempt (activity log, per user)

One per Log attempt: `userId`, `questionId`, `type` (`solved` first time / `revised` later / `failed_recall` blanked), `at`, `confidence`, `minutes`, `onTime`, `difficulty` snapshot, `backfill` flag, and `prev` (schedule before the attempt, for **Undo last log**). History, streak, heatmap and period progress all come from these.

### 1.3 Settings (per user)

`interviewDate`, `intervals` (revision ladder in days, default `1, 3, 7, 14, 30, 60, 90`), `timezone` (default `Asia/Kolkata`, IST), music `playlists`.

### 1.4 Platforms and patterns (managed lists, `lists.manage`)

- Two shared lists that editors and admins control (everyone picks from them): **Platforms** (LeetCode, Codeforces, …) and **Patterns** (Two pointers, Sliding window, …). Nothing is pre-filled.
- **Create**: “+ Add new…” at the bottom of the dropdown while adding/editing a question, or in Settings.
- **Rename**: in the dropdown's **Manage** dialog or Settings; every question using the old name is updated. Names are unique ignoring case.
- **Delete**: shows how many questions use it; those questions keep everything else and just lose that value.
- A value used by a question is always in its list: importing from LeetCode/GFG adds that platform automatically; a platform detected from a pasted link is added when the question is saved.

---

## 2. Questions

Adding and editing below needs `catalog.edit` (others suggest instead, §2a).

- **Add from LeetCode / GeeksforGeeks** (default on the Add page):
  - LeetCode: numbers (`1, 15, 146`), ranges (`200-210`), links, slugs or exact names.
  - GeeksforGeeks: links, problem ids, slugs or names.
  - Up to 100 per lookup; preview with checkboxes in your input order; ones already in the library are flagged.
  - Fills title, difficulty, topics (platform tags), companies, problem number and a YouTube search link for a video.
  - Optional pattern applied to everything imported.
- **Add manually**: pasting a LeetCode/GFG link fetches the same details.
- **Already solved before using the app?** Any user can tick it in the Log dialog for an untouched question (editors/admins also when adding) with the date and how well they know it. It's scheduled from that date, so old solves land in the review queue if they're due.
- Admins edit the catalog fields. Each user's own status can be reset to todo / in progress on the question page (clears their schedule; history kept). **Done is reached only by logging an attempt.**
- **Hide for me** (any user): out of your lists, queue and totals; history kept; undo with Unhide.
- **Retire** (`catalog.edit`): out of the catalog for everyone; history kept; Restore brings it back. **Delete** (`catalog.delete`) removes the question with all progress and attempts on it, and is refused while other users have attempts on it.
- Library: search (title, your notes, topics, companies, pattern, problem number), filters (schedule, difficulty, status, last done, confidence, topic, pattern, company, platform, starred, hidden by me; with `catalog.edit` also retired), sort, 50 per page, filters kept in the URL.

## 2a. Submissions

- **Suggest a question** (users; “+ Suggest”): the same two ways in as adding: **From LeetCode / GFG** (one problem per lookup: number, link or name; details filled in) or **Manual** (pasting a link fills details too). Optional pattern and note, then **Send for review**. Refused if the problem is already in the catalog.
- **One at a time**: a user can have only one new-question suggestion pending. The next is allowed once a reviewer approves or rejects it (or they withdraw it). Enforced on the server (and by a unique index, so two simultaneous submits can't both get in); the Suggest page shows the waiting one instead of the form.
- **Suggest an edit** (users, on a question): the same form prefilled; only changed fields are sent (e.g. add a video or company, fix the pattern).
- **Submissions** page: users see theirs with status (pending / approved / rejected) and the reviewer's note, and can withdraw pending ones. Reviewers (`submissions.review`) get the review queue (pending, approved, rejected, mine): new questions show all fields, edits show old → new per field; Approve applies it to the catalog (re-checking duplicate links), Reject takes an optional reason.

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

- Everyone: interview date, revision intervals, timezone (default IST), music playlists; **Export** their backup (catalog + their progress, notes, attempts, settings).
- With `lists.manage`: Platforms and Patterns lists (add / rename / delete). With `catalog.edit`: Import JSON (catalog questions only), Fill missing company tags.
- `npm run set-role -- <email> <user|editor|admin>`: sets a role (used once for the first admin); with no arguments lists accounts and roles.
- `npm run migrate-accounts -- --owner <email>` (dry run) / `… --yes`: one-time move of pre-accounts data (progress, notes, attempts, settings, playlists) to that account, creating it if needed; backs up to `backups/` first.
- `npm run reset-db` (dry run) / `npm run reset-db -- --yes`: backs up to `backups/` then deletes all questions, progress, history and submissions (accounts and settings kept).

## 5a. Music player

- **♪ Music** button (bottom-right, every page once signed in) opens a small player for your own YouTube playlists (Settings → Music playlists: add / edit / delete / reorder; any YouTube playlist, mix or video link).
- Playlist dropdown, song title, “Song n of N”, previous / play-pause / next. Unplayable songs are skipped automatically. Remembers the last playlist on this device.
- Keeps playing while you move between pages. **Minimize (–)** hides the player completely (video included) while the music keeps playing; the floating button shows the current song with play/pause and reopens the player. ✕ stops it.
- Note: YouTube's embed terms ask for a visible player; hiding it is a deliberate choice for this personal app.

## 5b. Admin tools

- **Dashboard** (`/` for management-only roles; learners keep their Desk): pending suggestions banner with the oldest one's date; tiles for users, active this week (signed in or practised), new this week, pending suggestions, live questions, added this week, retired (and retired in the last 30 days), attempts this week by all learners; recent catalog changes; newest users. Each section shows only if the viewer has its permission (`catalog.edit`, `submissions.review`, `users.manage`).
- **Insight** (question page, `catalog.edit`): done / in progress / not started across all learners, attempts and how many people made them, blank rate, average confidence and time, starred / hidden counts. Totals only, never an individual's data. Hints appear once there's enough data (5+ attempts): often blanked (suggests a better or first video), difficulty that looks wrong for how people rate it, low confidence, hidden by 3+ people.
- **Audit log** (`catalog.edit`): every catalog write is recorded with who, when, how (by hand, import, approved suggestion, bulk action, company backfill, revert) and each field's old → new value: create, edit, retire, restore, delete. Shown per question (“Changes” on the question page) and as a feed (**Changes** in the admin nav, `/audit`, 50 per page). **Revert** undoes an edit / retire / restore once, only if those fields haven't changed again since (otherwise the later change must be reverted first); the revert is itself recorded.
- **Bulk actions** (Questions list, `catalog.edit`): tick rows, “Select page”, or “Select all N matching” (every question the current filters match, resolved on the server). Actions: set pattern (or clear it), set difficulty, add / remove topic, add / remove company (case-insensitive, no duplicates), retire, restore. Asks for confirmation with the exact count; up to 5,000 at once; each changed question gets its own audit entry under one batch.

## 5c. Moderation

- **Suspend** (Users page, `users.manage`; optional reason): the account is signed out everywhere at once, can't sign in by any method (“This account is suspended.”), gets 403 on every API call and sees an “Account suspended” page. Its pending suggestions are hidden from the review queue and dashboard. Data is kept; **Restore** undoes it all. You can't suspend yourself or the last active admin (the last-admin rule for role changes also ignores suspended admins).
- **Rate limits** (per user, fixed windows, counted in the database so they hold across server instances): LeetCode / GFG lookups 30 an hour; suggestions (new or edit) 20 a day, which stops withdraw-and-resubmit loops; at most 5 pending edit suggestions (and 1 pending new question, §2a). Editors and admins aren't limited on lookups or suggestions. Over the limit → 429 with when to try again. Sign-in (5 tries a minute) and sign-up (5 an hour) are limited per IP by Better Auth, in every environment. **Rate limits** on the Users page lists the last 7 days per user and action: requests, busiest window against the limit, and refusals, refusals first.
- **Saved rejection reasons** (`submissions.review`): one-click “Reject as: …” chips on each pending suggestion; a typed note is added after the reason. The list (defaults: Already in the catalog, Premium-only problem, Not a DSA problem, Link doesn't work, Not enough detail) is edited in Settings → Rejection reasons: add, move up, remove; up to 20.
- **Duplicate finder** (`/duplicates`, “Find duplicates” on the catalog list, a dashboard tile; `catalog.edit`): pairs of live questions with the same title ignoring case, punctuation and leading numbers, the same title with different spacing, a one-letter typo in up to two words in the same place, or the same problem link. Words are compared in order, so “Directed” / “Undirected”, “Queue using Stacks” / “Stack using Queues” and numbered variants (“House Robber II”) don't match. Each side shows platform, learners, attempts, videos and companies. **Not duplicates** hides the pair for good. **Keep this one** (`catalog.delete` too) merges the other into it: every learner's progress and attempts move over (a learner with progress on both gets one record: the more recently solved schedule, the better status, added counts, both notes, starred if either), its videos / topics / companies are added, pending edit suggestions on it are closed, and it's retired with `mergedInto` set; both changes go in the audit log as “via duplicate merge”.

## 5d. Catalog quality

- **Health report** (`/health`, “Health” on the catalog list, a dashboard tile; `catalog.edit`): live questions grouped by what to fix: broken problem links, broken video links, LeetCode Premium only, only a YouTube *search* link (what import adds when it has no video), no video, no problem link, no pattern, no topics, no companies. Each group shows its count and expands to the questions; each row opens that question with its editor already open.
- **Link check** (“Check links now” on the Health page): checks every problem and video link in the live catalog, 50 per request until done, with progress (≈30 s for ~570 links). LeetCode links are checked against LeetCode's full problem list (one request; also gives the Premium flag); YouTube links via YouTube's oEmbed (a removed video answers 404); other links by loading the page (404 / 410 = broken). Anything that can't be confirmed (blocked, timed out, private) is not reported as broken. GeeksforGeeks answers 200 even for missing problems, so a dead GFG link isn't detected. Results are kept per link; the page shows when the last full run finished.
- **Question of the day** (Desk card for learners with their status and Log; dashboard card for admins with cycle progress): one question per calendar date, the same for everyone, picked automatically the first time anyone opens that day. Picks are random among live questions not yet featured in the current cycle, so **no question repeats until every live question has been featured**; then a new cycle starts. New questions join the current cycle's pool; a featured question that gets retired is replaced that day. The date is each user's own “today” (their timezone).

## 6. Non-functional

- Secrets (`MONGODB_URI`, `BETTER_AUTH_SECRET`, OAuth keys) only in `.env.local` (git-ignored); `.env.example` lists them.
- Timezone comes from the user's Settings (default IST), not the device or server: the server resolves it per request (so concurrent users in different zones don't mix), and the root layout passes it to the browser so both agree on “today”.
- A failed MongoDB connect isn't cached, so the app recovers when the DB is back.
- LeetCode/GFG lookups use their public (unofficial) endpoints server-side; if they change, lookup shows an error and manual add still works.
- Works at phone width.

## 7. Out of scope

Gamification, leaderboards, email verification / password reset (needs an email provider), private per-user questions, code execution, native apps, AI solving. Future ideas if needed: reminders (calendar feed), time-to-solve analytics. Planned admin features are in §8.

## 8. Planned admin features (not built yet)

Proposals, not current behaviour (except 8.1, 8.2 and 8.3, now built). Priority: **P1** = most useful day to day; **P2** = moderation and catalog quality; **P3** = nice to have. Each lists the permission it would sit behind (§0); a new permission is named where none fits.

### 8.1 Highest value (P1): done

Built; see §5b (admin dashboard, per-question insight, audit log, bulk actions).

### 8.2 Moderation and abuse protection (P2): done

Built; see §5c (suspension, rate limits, saved rejection reasons, duplicate finder).

### 8.3 Catalog quality (P2): done (9, 11); 10 dropped

9 (health report) and 11 (question of the day, made automatic) are built; see §5d. 10 (curated lists) was dropped.

### 8.4 Users (P3)

12. **User detail page** (from the Users page): sign-in methods, join date, last active, streak, counts of done / in progress, submissions with outcomes, role history. For support (“my progress vanished”). Read-only; no notes content. *Permission*: `users.manage`.
13. **Announcements**: a dismissible banner on everyone's Desk (“New: Graph section added”), with start / end dates. *Permission*: new `announcements.manage` (admin).

### 8.5 Operations (P3)

14. **Backups from the UI**: run the same backup `reset-db` writes, list past backups with size and date, download one. Restore stays a command-line step. *Permission*: new `ops.backup` (admin).

