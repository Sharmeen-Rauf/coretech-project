# Installer Mobile Consolidation Plan

Status: planning, not started. Branch: `installer-mobile-consolidation`.

## Goal

Retire the temporary web installer experience — `app/installer/page.tsx` (submission form)
and `app/installer/register/page.tsx` (signup), plus the "Installer QR Code" button on the
admin Installer List page that opens the signup page — by giving the native `coretech-mobile`
app everything those pages do, and fixing every bug currently logged in `bug_mobile.md` along
the way. Once the native app has full parity, verified on-device, it becomes the sole
installer-facing surface and the web pages come out.

## The architecture decision this plan is built around

The mobile app can't safely absorb signup + submission by just copying the web forms' UI
into React Native, because the web forms work as well as they do thanks to server-side
re-validation (`createUserAction`, `submitInstallationAction`) that runs with privileged
access, invisible to the client. The mobile app has no equivalent today — it writes straight
to Supabase with the public anon key, which is exactly why bugs 6-8 in `bug_mobile.md` (RLS
off on `installer_jobs`, wide-open `profiles` read policy, fully public `job-photos` bucket)
and the "no server-side backstop on submission" gap exist.

**Confirmed direction:** build that missing backend as new API routes inside the existing
`coretech-project` Next.js app, reusing the same validation logic already proven on web,
rather than duplicating a second, weaker copy of it inside the mobile app.

## Phase 0 — Security foundation (starts first, independent of everything else)

Pure database/policy work, no app code changes, can begin immediately:

- Enable RLS on `installer_jobs` with real per-role policies (installer sees/writes only
  their own rows; admin/RM/CH see what their role should).
- Tighten the wide-open `profiles` read policy so installers can't read every other
  installer's CNIC and payout details.
- Make the `job-photos` storage bucket private and ownership-scoped instead of fully public
  read/write/update/delete.

Prerequisite for trusting the mobile app's *existing* direct-to-Supabase reads (job lists,
dashboard stats, profile data) once real user data is flowing through a more heavily-used app.

## Phase 1 — Build the backend API routes

New routes inside the same Next.js codebase already deployed at coretechsolar.com — e.g.
registration, serial verification, and installation submission endpoints — reusing the logic
behind `createUserAction`, `verifySerialNumberAction`, and `submitInstallationAction` rather
than rewriting it from scratch. Design constraints for this phase:

- **Authentication:** mobile has no browser session/cookies, so each request needs to carry
  the installer's Supabase-issued JWT, verified server-side on every call — not the
  cookie-based auth the web pages currently rely on.
- **Connection handling:** `submitInstallationAction` currently opens a brand-new raw
  Postgres connection (`new pg.Client(...)`) on every single call — a real, verified latency
  and connection-exhaustion risk on serverless infrastructure. The new routes need a
  pooled/reused connection instead of copy-pasting that exact pattern.
- **Keep each route narrow and lean** — purpose-built for exactly what it needs to check, not
  a grab-bag, so it isn't exposed to unrelated inefficiency elsewhere in the app.
- **Test each route's own response time** before wiring the mobile app to it — cold-start
  latency on this infrastructure is a real factor regardless of how lean the route's own
  logic is.

## Phase 2 — Native Sign-Up screen

Once Phase 1's registration endpoint exists:

- Build the missing `register.tsx` in `app/(auth)/`, with the same field set as web (name,
  contact, email, password, CNIC with the same format+validate behavior, address, city,
  state dropdown, marital status, payment provider, payout account).
- Wire up the currently-dead "Register for free" link on the login screen to it (today it's
  plain `<Text>` with no `onPress` and no screen to navigate to).
- Submit through the new API route — new accounts land in `pending_verification`, same as
  web.
- Add the missing `profile.status` check to `handleLogin`, so a not-yet-approved installer is
  actually blocked from getting in, matching web's behavior (web's `app/installer/page.tsx`
  reads and gates on `profileStatus`; mobile's login today only checks `role`, never
  `status`).

## Phase 3 — Upgrade the Job submission screen

Once Phase 1's submission endpoint exists:

- Route `handleSubmitProof` (`app/job/[id].tsx`) through it instead of the current raw
  client-side `supabase.from(...).update(...)` call — this is what actually gives mobile the
  server-side re-validation it's missing today.
- Raise the photo minimum to match web (3, not 1), and actually enforce the video requirement
  the screen already labels "Required" but never checks.
- Fix the fail-open serial-verification fallback so an unmatched or errored lookup is a real
  rejection, not a fabricated "verified" result (today it falls back to a
  `"CoreTech Solar Product (Manual Fallback)"` object even on error).
- Fix bug 5 from `bug_mobile.md` (unsafe `ilike` wildcard matching on serial numbers) in the
  same pass, since it's the same code being touched — escape `%`/`_`, or switch to an exact,
  case-folded match.
- Add an offline-save fallback (AsyncStorage), mirroring what the web page already does with
  `localStorage`, so a failed submit isn't silently lost.

## Phase 4 — The standalone crash fixes + error boundary

Independent of Phases 1-3, cheap, can run in parallel with the backend work:

- Job Details screen: guard against rendering with no job data mid-navigation-back
  (`bug_mobile.md` #1).
- Profile screen: safe-guard the initials computation against a missing `first_name`
  (`bug_mobile.md` #3).
- Root-level error boundary so any other unhandled error shows a recoverable screen instead
  of killing the whole app outright (`bug_mobile.md` #4) — also a safety net for anything the
  earlier phases miss.

## Phase 5 — Fix the "My Jobs" / "History" visibility gap

Update both tabs' status filters (`app/(tabs)/jobs.tsx`, `app/(tabs)/history.tsx`) to include
the in-review statuses (`pending_verification`, `pending_approval`,
`pending_installation_approval`) — `bug_mobile.md` #2 — so a submitted job doesn't vanish
from the installer's own view the moment they submit it. More important than ever once real
submission (Phase 3) is live and installers are actively watching this state.

## Open decision — self-report an unassigned installation?

Web's form has a "New Installation Record" mode (installer reports something nobody assigned
them). Mobile has no equivalent today. This changes what Phase 1's submission endpoint needs
to accept (an installer-typed job title/address, not just an existing job ID), so it needs an
explicit yes/no before Phase 1 is built, rather than being assumed into scope.

## Deployment — no new infrastructure

The new API routes live in the same repo already deployed to Vercel from `master`. Process is
the one already established in this project: build on a branch -> `npm run build && npm run
start` locally to verify (`npm run dev` is the known-broken workflow here, see main
`CLAUDE.md`) -> PR -> merge to `master` -> Vercel auto-deploys. The mobile app needs one new
EAS build to learn the new API URL (baked into `app.json`'s `extra`, same as `supabaseUrl`
already is today) — but after that, most future changes to the validation logic behind these
routes are just a normal Vercel deploy, no new mobile build or reinstall required, unless the
request/response shape itself changes.

## Execution approach

- Phased delivery on this branch — each phase built, tested on a real device (same
  `adb`/Logcat + EAS-build discipline used for the `expo-asset` crash fix), and committed
  separately, not one giant PR spanning backend + signup + submission + five bug fixes at
  once.
- Phase 0 (security) and Phase 4 (crash fixes) have no dependency on anything else and can
  start in parallel with Phase 1's backend work.
- Everything from Phase 2 onward is blocked on Phase 1 existing.

## Only after all of the above is verified on-device — retire the web pages

`app/installer/page.tsx`, `app/installer/register/page.tsx`, and the "Installer QR Code"
button on the admin Installer List page get removed only once the native app is confirmed, on
a real phone, to actually do everything they did. Not before.
