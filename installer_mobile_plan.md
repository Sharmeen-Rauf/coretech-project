# Installer Mobile Consolidation Plan

Status: Phase 0 deferred (see note below). Phases 1, 2, and 3 all merged to `master` and
**verified end-to-end on a real physical device against live production**, 2026-09-02/03.
Phase 3 in particular took several live-testing round trips to actually get working — see its
section below for the full list of real bugs found only by testing on a real device, not by
review. Ready to move on to Phase 4 (or further scope) whenever.

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

## Phase 0 — Security foundation — DEFERRED 2026-09-02, not started

Decision: deferred at the client's explicit call, not a technical blocker. The mobile app
(and the web installer page it mirrors) never asks for anyone else's data — every query is
already self-scoped by convention (`.eq("id", session.user.id)` /
`.eq("installer_id", session.user.id)`), so nothing in Phases 1-5 depends on this being done
first. What stays true while deferred: the three exposures already confirmed live in
`bug_mobile.md` (#6-8) remain real — any authenticated account could, via a direct API call
(not through any app screen), read/edit another installer's job record, read another
installer's CNIC/payout info, or overwrite/delete another installer's uploaded proof photo or
video. Accepted as a known, existing risk for now, not newly introduced by anything in this
plan. Can be picked up independently at any later point — it's a pure database change with no
dependency on, or from, any of the app-side phases below.

Design notes from the investigation already done, kept here for whenever this is picked back
up: `installer_jobs` should defer to the real Role Management system (`role_permissions` /
`installer.verify_installer` / `installer.verify_installation`) rather than a hardcoded role
list, confirmed live-granted today to admin, country_head, employee, and retail_manager only
(not marketing_manager or rsm, despite being "office" roles). `profiles` has no single
permission key to defer to (read from too many unrelated pages/features), so self + the six
office roles as a group remains the fallback design there. `job-photos`: only the uploader
should be able to replace/delete their own file; public read stays untouched either way.

Pure database/policy work, no app code changes, whenever it's picked back up:

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

### Built and tested — 2026-09-02

Three routes shipped, each a thin transport wrapper around the existing server actions rather
than a rewrite:

- `POST /api/installer/register` — public, no auth (mirrors `createUserAction`'s existing
  `allowAnonymousInstallerCreate` allowance). Added real input validation at the route
  boundary — `createUserAction` assumes its caller already validated required fields (true
  for the web form, which checks client-side first), and crashed with a raw JS error
  (`Cannot read properties of undefined`) on a missing field instead of a clean message. Not
  a new bug, just a gap this route is a more direct, unguarded path into than the web form
  was — fixed by validating the same fields the web form's own `validate()` already checks
  before calling the action.
- `POST /api/installer/verify-serial` — requires a Bearer token, wraps
  `verifySerialNumberAction` unchanged (already safe, fails closed, no identity concern for a
  read-only inventory lookup).
- `POST /api/installer/submit` — requires a Bearer token, wraps `submitInstallationAction`.

**Real vulnerability found and fixed while building this, not before:**
`submitInstallationAction` had no caller-identity check at all — it trusted whatever
`installer_id` the client sent on a new submission, and matched an update by job id alone,
never checking the job actually belonged to whoever was calling. Fixed by:
- Extending `getCallerSessionId`/`getCallerIdentity` (`app/actions/users.ts`) to accept an
  optional access token, verified via `supabase.auth.getUser(token)`, alongside the existing
  cookie-based path — backward compatible, every existing call site is unaffected since the
  parameter is optional and defaults to the old cookie behavior.
- `submitInstallationAction` now resolves the caller via this (accepting the same optional
  token, threaded through from the new route), requires `caller.role === "installer"`, and
  overrides `payload.installer_id` with the verified caller's id rather than trusting the
  client's value.
- Resubmission of an existing job now checks the job's real `installer_id` against the
  caller before allowing the update, both as a pre-check and as an added `AND installer_id =
  $N` clause on the `UPDATE` itself (defense in depth, not just the pre-check).

**Verified end-to-end against production**, not just unit-tested in isolation: registered two
real test installer accounts through the new route, signed in as each to get a real access
token, confirmed a legitimate submission correctly stamps the real caller's id (not whatever
the client sent), then confirmed the second test installer's token was refused
(`"Not authorized to modify this installation record"`) when it tried to hijack the first
installer's job by id — the exact attack the old code was vulnerable to. Job's title was
confirmed unchanged after the failed attempt. All test accounts, the test job, and their
`allowed_users` whitelist entries were deleted afterward — nothing test-related left in
production.

**Also found, not yet fixed, flagged separately:** `app/api/test-db/route.ts` — a pre-existing,
unrelated route — has a hardcoded production database password as a fallback default and is a
public, unauthenticated endpoint that also triggers a PostgREST schema reload on every `GET`.
Live and deployed today, not just old git history like the `scratch_*` files. Worth its own
fix, out of scope for this plan.

## Phase 2 — Native Sign-Up screen

Once Phase 1's registration endpoint exists:

- Build the missing `register.tsx` in `app/(auth)/`, with the same field set as web (name,
  contact, email, password, CNIC with the same format+validate behavior, address, city,
  state dropdown, marital status, payment provider, payout account).
- Wire up the currently-dead "Register for free" link on the login screen to it (today it's
  plain `<Text>` with no `onPress` and no screen to navigate to).
- Submit through the new API route — new accounts land in `pending_verification`, same as
  web.
- Add the missing `profile.status` check to `handleLogin` (today it only checks `role`, never
  `status`, so a not-yet-approved installer can currently get straight into the app). Exact
  behavior per status, decided 2026-09-02:
  - `pending_verification`: login succeeds, but the installer lands on a "Profile Under
    Review" screen instead of the normal app (mirroring web's `app/installer/page.tsx`,
    which reads and displays `profileStatus` rather than blocking the login outright).
  - `rejected` / blocked: login is refused entirely — same outcome and same generic message
    as the role-mismatch/wrong-password case below, not a distinct "your account was
    rejected" message (that would leak the same kind of account-existence information a
    rejected applicant's own credentials shouldn't reveal any more precisely than a stranger's
    wrong password does).
  - This is purely app-side login logic — no change needed to Phase 0's RLS design, since the
    self-read policy there (`auth.uid() = id`) already lets an installer read their own
    `status` regardless of its value; RLS was never what would have blocked this.
- Unify login error presentation: today, a wrong password and a correct-password-but-wrong-role
  attempt show two different `Alert.alert` popups ("Login Error" vs. "Access Denied") — which
  leaks account-existence/role information to anyone probing credentials, since the two cases
  are distinguishable from outside. Replace both with a single generic inline red-text error
  on the login screen itself (not a native popup), identical wording and appearance regardless
  of which of the two actually happened.

## Phase 3 — Upgrade the Job submission screen

Scope finalized 2026-09-03 (expanded twice from the original plan — barcode scanning and the
self-report "+" entry point were both added after the initial version below). Once Phase 1's
submission endpoint exists:

- Route `handleSubmitProof` (`app/job/[id].tsx`) through it instead of the current raw
  client-side `supabase.from(...).update(...)` call — this is what actually gives mobile the
  server-side re-validation it's missing today. Foundational change everything else in this
  phase builds on.
- **Add barcode/QR scanning as a second way to enter the serial number**, alongside the
  existing typing option. A "Scan" mode opens the phone's camera in a scanner view; the moment
  it reads a barcode, that value fills the same text field manual typing already uses —
  Verify and the server-side check work identically either way, since the backend only ever
  sees a string, not whether it was typed or scanned. Needs a real native camera/barcode
  module (`expo-camera`'s built-in scanning, since the older standalone
  `expo-barcode-scanner` package is deprecated on this Expo SDK version) — a genuinely new
  native dependency, not just new screens.
- **Add a "+" button, centered at the bottom of the main screens, to start a self-reported,
  unassigned installation** — matching web's "New Installation Record" mode. The installer
  fills in their own job title and address first (no existing assigned job to attach to), then
  goes through the same serial (typed or scanned), photo, and video flow as normal. The
  backend already supports this — `submitInstallationAction` already has a branch for a
  brand-new job (not just updating an existing one), and the ownership fix from Phase 1 works
  the same way for both cases — so this is pure mobile UI work, no backend changes needed.
  Resolves the "self-report an unassigned installation?" open decision from the original plan.
- **Preserve the existing camera/gallery and record/library options for photos and video** —
  these already exist in the current screen (separate "Camera"/"Gallery" buttons for photos,
  "Record"/"Library" for video, via `expo-image-picker`'s two launch modes) and already meet
  what was asked for here; the job in this phase is making sure they survive the refactor
  around the new submission call, not rebuilding them.
- Raise the photo minimum to match web (3, not 1), and actually enforce the video requirement
  the screen already labels "Required" but never checks.
- Fix the fail-open serial-verification fallback so an unmatched or errored lookup is a real
  rejection, not a fabricated "verified" result (today it falls back to a
  `"CoreTech Solar Product (Manual Fallback)"` object even on error) — matters even more now
  that a bad barcode scan needs to fail honestly too, not get papered over.
- Fix bug 5 from `bug_mobile.md` (unsafe `ilike` wildcard matching on serial numbers) in the
  same pass, since it's the same code being touched — escape `%`/`_`, or switch to an exact,
  case-folded match.
- Add an offline-save fallback (AsyncStorage), mirroring what the web page already does with
  `localStorage`, so a failed submit isn't silently lost.
- Set up `expo-updates` (OTA), added to this phase's scope 2026-09-03 rather than as separate
  work, since Phase 3 already needs one more full native build regardless — and now for two
  reasons, not one: this OTA setup, and the new barcode-scanning native module above. Not
  currently installed at all (`expo-updates` isn't in `package.json`), so this is net-new
  setup, not a config change. Once both land in this one build, everything after this phase
  (Phase 4's crash fixes, Phase 5's visibility fix) is pure JavaScript and can ship via
  `eas update` in seconds instead of another 10-35 minute cloud build each time.

### Built and verified end-to-end on a real device — 2026-09-02/03

All nine items above shipped. Confirmed live, on a physical phone against production: typed
and self-report entry both work, camera and gallery photo capture upload successfully, video
capture/library upload successfully, a submitted job lands correctly in the database tied to
the real caller, and it's correctly visible and actionable through the real two-stage web
admin approval flow (verified by watching a test submission get Stage 1 verified and Stage 2
rejected on the web dashboard within a minute of submitting it from the phone).

Getting there took several live-testing round trips, each surfacing a real bug that no amount
of code review or type-checking had caught — the same lesson as the original `expo-asset`
crash, repeated three more times in this one phase:

1. **Camera/gallery permission dialog flashed and vanished before it could be tapped.**
   `handlePickPhoto`/`handlePickVideo` had no guard against being invoked twice for one tap,
   so a fast double-tap fired two concurrent permission requests that raced each other's
   dialog off screen. Fixed with a ref-based lock covering the whole
   permission-through-upload flow, not just the upload phase the existing `isUploading` flags
   already covered. Shipped via `eas update` (pure JS, no rebuild).
2. **After that fix, camera/gallery still silently did nothing after permission was granted.**
   `launchCameraAsync`/`launchImageLibraryAsync` had no error handling around them at all —
   only the upload phase after a successful pick did. Added a real try/catch with a visible
   Alert on failure, plus temporary debug logging to see the actual native error instead of
   guessing further from Android system logs. That error was:
   `Module 'expo.modules.interfaces.filesystem.AppDirectories' not found` — the exact same
   *class* of bug as the original `expo-asset` crash: `expo-file-system` was only resolving to
   `node_modules/expo/node_modules/expo-file-system` (nested under `expo`'s own tree) instead
   of the top level, invisible to autolinking, because nothing required it directly - only
   `expo` itself did, transitively. Fixed the same way as before: declared it as a direct
   dependency, hoisting it to the top level. This one needed a real rebuild (new native
   dependency), not OTA.
3. **After the rebuild, camera/gallery picking worked, but every upload failed** with
   `StorageUnknownError: Network request failed` — confirmed via the same debug-logging
   approach that the file read succeeded every time (blob size logged correctly) but the
   Supabase Storage upload itself always failed. This is a known React Native + Supabase
   incompatibility: `fetch(uri).blob()` doesn't produce a spec-compliant `Blob` in React
   Native's environment, and Supabase Storage's `upload()` is unreliable with it there even
   though the identical code works fine on web. Fixed by switching to Supabase's own
   documented React Native approach — read the file as base64
   (`FileSystem.readAsStringAsync`) and upload as an `ArrayBuffer`
   (`base64-arraybuffer`'s `decode`) instead. Pure JS, shipped via `eas update`.

Net effect: three real, load-bearing bugs, none of them visible from source review, `tsc`, or
`expo-doctor` — all three only surfaced by actually running the app on a physical device and
watching it fail. Reinforces the same conclusion the original crash investigation reached:
this class of "native module silently missing" bug is structurally invisible to static
checks, and React Native's file-handling APIs (`fetch().blob()` here) can behave differently
enough from their web equivalents to fail in ways that only show up on-device too.

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

## Resolved decision — self-report an unassigned installation

Decided 2026-09-03: yes, build it — see Phase 3's "+" button item above. Turned out not to
need a separate yes/no ahead of Phase 1 after all: `submitInstallationAction` already had a
branch for a brand-new job (not just updating an existing one) from the original web-supporting
logic, untouched by the Phase 1 ownership fix, so Phase 1's endpoint already supported this
without any changes — the only real work is the mobile-side entry point in Phase 3.

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
