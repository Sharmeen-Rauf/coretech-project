# Installer Mobile Consolidation Plan

Status: Phase 0 deferred (see note below). **Phases 1-5 all built, merged to `master`, and
verified working on a real device, 2026-09-02/03.** Phase 3 in particular took several
live-testing round trips to actually get working — see its section below for the full list of
real bugs found only by testing on a real device, not by review. Phase 5 (see its section
below) shipped the client's self-report-only reframing, the rejection-message fix, and the
UI/animation polish pass — confirmed working via OTA update, followed by one more real bug
(`AnimatedPressable` collapsing its child to near-zero size, breaking the Jobs screen's four
filter tabs and every other Phase-5-polished button/card) found in that same round of live
testing and fixed via a second OTA update — see "Post-Phase-5 fix" below. User confirmed
"all working fine now" after that second update, 2026-09-03.

**Phase 6 built and merged to `master`, 2026-09-03/04** — all nine items (6.1-6.9: crop UX,
gallery multi-select, upload performance, the floating "+" button, Jobs tab renames, the
stock/sold_out bug + backfill, Paid/Unpaid visibility, and the real app icon/splash) shipped on
one branch, verified via `tsc`/`expo-doctor`/Metro export before merge, then built via EAS
(`preview` profile) and installed for client testing. **Client testing surfaced four real UI
bugs**, all diagnosed and explained but not yet fixed — see "Post-Phase-6 UI fixes" below.

**What's genuinely still outstanding, as of 2026-09-04:**
- Phase 0 (security/RLS) — still deferred, not started, see its section below.
- Post-Phase-6 UI fixes (see below) — four client-reported issues, diagnosed, not yet built.
- `app/api/test-db/route.ts`'s hardcoded production DB password + unauthenticated schema-reload
  endpoint — flagged in Phase 1, never fixed, explicitly out of scope for this plan.
- Retiring the two web installer pages + QR button (see the final section below) — the plan's
  own gate condition (native app verified on-device to do everything they did) is now actually
  true, but this hasn't been done yet.

**Housekeeping done, 2026-09-03:** the 8 old `.aab` EAS build artifacts (~284 MB) that had been
committed directly to `coretech-mobile/` were removed from the working tree and all future
commits (`chore/remove-old-aab-builds`, merged to `master`). `.gitignore` already excluded new
ones from Phase 3 onward; this cleaned up the 8 that predated that fix. Note: this does not
rewrite git history — the ~284 MB remains in already-existing commits until/unless a separate,
more disruptive history rewrite (`git filter-repo` + force-push) is explicitly requested.

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
  setup, not a config change. Once both land in this one build, everything in Phase 4 is pure
  JavaScript and can ship via `eas update` in seconds instead of another 10-35 minute cloud
  build each time.

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

## Phase 4 — Navigation, Jobs/History consolidation, and Profile detail

Scope finalized 2026-09-03, from client-facing UX gaps found during Phase 3's live testing
(not from `bug_mobile.md` originally, except where noted) plus the two standalone crash fixes
and error boundary already planned. Absorbs what was previously a separate "Phase 5" — the
visibility fix below is the same underlying problem as that phase, just grouped here since
it's the same screen as the rest of this work, not a reason to touch it twice.

1. **Launch/login destination:** an approved installer currently lands on the Jobs tab both
   on cold app launch (`index.tsx`) and right after signing in (`login.tsx`) — a choice made
   during Phase 2 without checking first. Both change to land on the Dashboard tab
   (`/(tabs)/index`) instead.

2. **Combine the separate Jobs and History screens into one Jobs screen with four filter
   tabs: All, Active, Rejected, Completed.** Today they're two different tab-bar
   destinations with two separate queries; this merges them into a single screen where the
   tab row changes what's shown, not what route you're on.
   - **All** — every job the installer has, regardless of status. New addition per this
     conversation, alongside the three status-grouped tabs below.
   - **Active** — `assigned`, `in_progress`, `pending_verification`, and `pending_approval`
     all together: anything not yet finally decided one way or the other. This is what fixes
     the actual bug behind it — a submitted job currently vanishes completely the moment it
     moves into review, because the underlying database query
     (`.in("status", ["assigned", "in_progress", "rejected"])` in `app/(tabs)/jobs.tsx`)
     never even asks for `pending_verification`/`pending_approval` rows in the first place.
     Folding those two statuses into Active fixes this at the query level, not just the tab
     label. This is `bug_mobile.md` #2.
   - **Rejected** — unchanged from today's behavior, already works correctly.
   - **Completed** — `approved` jobs; this is today's separate History tab's data, renamed
     to match how the client actually described it (not a generic "History" label) and
     folded into this same screen instead of being a distinct tab-bar destination.
   - **"Assigned" stops being its own user-facing filter category** — per the client's actual
     spec, it was never meant to be a distinct tab an installer picks; it becomes just one of
     the statuses grouped into Active.

3. **Expand the Profile tab to show real installer detail.** Today it shows four things —
   name, designation, phone number, and a job-count summary (total/completed/pending) — while
   the account actually has CNIC, address, city, state, marital status, payment provider, and
   payout account number sitting in the database from registration, none of it surfaced here.
   Expand the screen to show the fuller picture, matching what the Sign-Up screen (Phase 2)
   actually collects, plus the account's own approval status (mirroring the "Pending
   Review"/"Approved"/"Rejected" badge web's installer portal already shows).

4. **Job Details screen:** guard against rendering with no job data mid-navigation-back
   (`bug_mobile.md` #1) — a real crash if the fetch fails and the screen renders once more
   before the "go back" navigation actually completes.

5. **Profile screen:** safe-guard the initials computation against a missing `first_name`
   (`bug_mobile.md` #3) — directly relevant now since item 3 above is already touching this
   exact screen.

6. **Root-level error boundary** so any other unhandled error shows a recoverable screen
   instead of killing the whole app outright (`bug_mobile.md` #4) — a safety net for anything
   the earlier phases, or this one, miss.

## Phase 5 — Self-report-only reframing, rejection message fix, UI polish

Scoped 2026-09-03, from a direct clarification the client gave the user: **there is no
admin-assignment step in the real workflow at all.** An installer does the physical
installation entirely on their own first, with no app involvement during the actual work, and
only opens the app afterward to fill out the submission form and prove what they already
finished. A job does not exist in the system in any form until that submission happens. This
means the "+" self-report entry point built in Phase 3 isn't an alternate path alongside a
primary admin-assigned flow — it's the *only* real flow this app has. See "Resolved decision"
below for how this changes that earlier framing.

1. **Fix a real bug found while scoping this phase: the rejection-message box reads the wrong
   database column.** Confirmed directly in `app/actions/products.ts` —
   `rejectJobStage1Action`/`rejectJobStage2Action` both route through `rejectJobInternal`,
   which requires the reviewer to type a real rejection reason and saves it into
   `approval_note`. Web's own installer portal (`app/installer/page.tsx`) reads it back
   correctly with a fallback chain: `job.approval_note || job.verification_note ||
   job.remarks || "Rejected during audit review."`. Mobile's rejection box in
   `app/job/[id].tsx`, however, only reads `job.verification_note` — a field rejection never
   actually populates — so it shows blank for a genuinely rejected submission even though the
   reviewer typed a real reason. Fix: use the same fallback chain web already uses.

2. **Simplify the Dashboard and Jobs screen around what actually happens.** `assigned` and
   `in_progress` are states nothing will ever put a real job into, since a job is never
   created until it's already submitted — Phase 4's "Active" tab currently groups those two
   dead states together with the two real in-review statuses, and the Dashboard has separate
   "Assigned"/"In Progress" tiles that will always read zero in real use. Replace the
   Dashboard's four tiles (Assigned, In Progress, Pending Review, Approved) with ones that
   reflect what actually happens: under review, rejected (needs fixing), approved/completed.
   Simplify the Jobs screen's status grouping the same way — "Active" becomes, in practice,
   just "currently under review," not a grouping of live and dead states together.

3. **Promote the self-report "+" entry point from a secondary FAB to the primary action.**
   Since it's not one option among several, it deserves to be the prominent, obvious action on
   the Dashboard and/or Jobs screen, not a small floating button tucked into the tab bar.

4. **Keep the rejected → edit → resubmit path exactly as it is structurally.** This is still a
   real, legitimate case — an installer coming back to an existing record after rejection —
   the client explicitly confirmed this stays. Only the rejection-message field bug from item
   1 needs fixing there, nothing about the flow itself changes.

5. **UI/animation polish pass across Dashboard, Profile, Login, Sign-Up, and the Job
   screens.** Same color scheme throughout (the cyan/blue `#00B4D8` palette already in use) —
   this is about motion and visual feel, not a redesign: smoother transitions between screens
   instead of instant cuts, real press/feedback animation on buttons and cards, better loading
   states (skeleton/shimmer instead of a bare spinner), a polished entrance for list items,
   and more considered empty/error states. Genuinely substantial, mostly-visual work, distinct
   in kind from the bug-fixing and structural work in Phases 1-4 — treated as its own focused
   effort within this phase rather than a quick pass tacked onto the other four items.

### Built and verified end-to-end on a real device — 2026-09-03

All five items above shipped, on their own branch, merged to `master`, shipped as a pure-JS
OTA update (no new native dependency — `Animated` is React Native's own built-in API, chosen
specifically to avoid a fourth instance of the "library needs special native/babel setup we
didn't verify" class of bug that hit `expo-asset`, `expo-file-system`, and the Blob upload
earlier in this project). New shared components: `AnimatedPressable.tsx` (press/feedback
scale animation), `FadeInView.tsx` (entrance fade + slide), `SkeletonBlock.tsx` (pulsing
loading placeholder) — applied across the Dashboard, Jobs, Profile, Login, Sign-Up, and Job
Details screens per item 5, plus the rejection-message fallback-chain fix from item 1 and the
Dashboard/Jobs simplification from item 2.

### Post-Phase-5 fix — `AnimatedPressable` layout collapse — 2026-09-03

Found in the very next round of live device testing after the OTA update above: the Jobs
screen's four filter tabs visually disappeared, and the user asked to check whether anything
else was also silently broken. Root cause was in the shared component itself, not any one
screen: `AnimatedPressable.tsx` had been applying the incoming `style` prop (carrying `flex:
1` and other sizing) to the inner `Animated.View` instead of the outer `Pressable`, so any
usage relying on flex or fixed sizing collapsed to near-zero. Because the component is shared,
this silently affected every Phase 5 usage at once, not just the Jobs tabs: the Dashboard's
CTA card and stat tiles, the Profile sign-out button, the Login/Sign-Up submit buttons, and
Job Details' three action buttons. Fixed once, in the shared component, by moving `style` onto
the `Pressable` and keeping only `{ transform: [{ scale }] }` on the inner `Animated.View` —
correcting all of those usages retroactively without touching any of the individual screens.
Shipped via a second OTA update; user confirmed afterward, "all working fine now."

## Phase 6 — Capture UX, upload performance, FAB reposition, Jobs tabs, Paid status, app branding, and a critical stock/inventory bug

Scoped 2026-09-03, from live-testing feedback plus a data-integrity issue found and confirmed
directly against production while scoping this phase. Nine items — one (6.6) flagged urgent and
not actually mobile-specific, worth fixing ahead of the rest of this phase.

### 6.1 — Stop forcing the native crop screen after every photo/video

Today, both `launchCameraAsync` and `launchImageLibraryAsync` (`app/job/[id].tsx`, photo and
video, camera and gallery — four call sites total) pass `allowsEditing: true`. This is what
forces Android's native crop activity open the instant the checkmark is tapped — it's not a
separate optional step today, it's baked into the same call as the capture/pick itself, and
`expo-image-picker` has no way to make the confirm button proceed directly while still offering
crop as a choice from inside that one call.

Fix: set `allowsEditing: false` on all four calls, and add a lightweight in-app review step
after a photo/video is captured — the raw file shown with two real actions, "Use Photo" (ties
to today's tick behavior, proceeds straight to upload) and "Crop" (opens cropping only if
tapped). The crop action itself needs a second library — `expo-image-manipulator` — since
`expo-image-picker`'s own cropper can't be invoked standalone outside its capture flow. This is
a genuinely new native dependency, so it goes through the same on-device verification this
project has needed for every native module added so far (`expo-camera`, `expo-file-system`),
not assumed to work from a clean `expo-doctor`/`tsc` pass alone.

### 6.2 — Multi-select from the gallery

Today `handlePickPhoto`/`handlePickVideo` only ever read `result.assets[0]` — one file per tap,
uploaded immediately, no matter how many were selectable. `expo-image-picker` supports
`allowsMultipleSelection: true` (plus a `selectionLimit`) on the gallery call specifically,
returning an array of assets instead of one — a real, supported mode, and mechanically
compatible with the existing per-file `uploadFileToStorage` function (loop over the array
instead of indexing `[0]`).

**Decided 2026-09-03:** multi-select applies to **photos from the gallery only**. Camera capture
stays single-shot per tap (no such thing as multi-select from a live camera), and video stays
single-file regardless of source (camera or gallery) — a job stores exactly one video today (a
single URL embedded in `notes`, not a list), and that stays unchanged.

### 6.3 — Upload performance (second upload slower than the first)

One concrete, code-confirmed inefficiency: `uploadFileToStorage` calls `supabase.auth.getUser()`
— a real network round-trip to Supabase's auth server — at the top of every single photo/video
upload, even though the result is only used for a "someone's logged in" guard, nothing else in
the function. For a job with 3+ photos plus a video, that's 4+ avoidable round-trips stacked on
top of the actual file uploads, on every single submission. Removing/caching this is a clear win
regardless of anything else found here.

That alone may not fully explain "first job fast, second job slow" — getting full confidence on
the rest needs the same live, on-device, per-step timing check this project has used for every
other real bug (permission → file read → upload, timed on a real repro), not a guess from static
review. Scope: ship the `getUser()` removal immediately, then instrument and watch the next slow
case live if the symptom persists.

### 6.4 — Floating "+" button, moved out of the tab bar

Today it isn't really a floating button — `app/(tabs)/_layout.tsx` wires it in as a fake fourth
`Tabs.Screen` (`new-installation`), just raised above the bar with a negative top margin so it
pokes up into it. That's why it looks cramped instead of like a real floating action button.

Fix: remove it from the tab bar entirely (back to 3 real tabs — Dashboard, Jobs, Profile), and
render a true floating overlay button — `position: absolute`, bottom-right, sitting above screen
content and clear of the tab bar — matching the positioning/elevation/isolation of the reference
screenshot the client provided (WhatsApp's compose button: a raised button separate from its own
bottom navigation bar, not embedded in it).

**Decided 2026-09-03:** keep the existing circular cyan button style (already consistent with
the rest of the app, not switching to the screenshot's rounded-square shape), and float it on
all three tabs — Dashboard, Jobs, and Profile — not just two of them. Since it needs to render
consistently across all three tab screens rather than living inside one screen's own layout,
this puts it at the shared `(tabs)/_layout.tsx` level, positioned to overlay whichever screen is
active rather than duplicated per screen.

### 6.5 — Jobs tab renames + new "Paid" tab

Label-only change in `app/(tabs)/jobs.tsx`'s existing filter config, no structural change:
"Active" → "In Progress", "Completed" → "Approved". The new "Paid" tab is a natural extension of
the same filtering logic and is the mobile-side surface for 6.7 below (installers currently
can't see paid/unpaid status anywhere) — built together, not as two separate features.

### 6.6 — URGENT, and not actually mobile-specific: Stage 2 approval never moves stock to sold-out

Reported as "only happens on mobile-originated approvals" — checked directly against live
production data rather than assumed, and **it isn't mobile-specific at all**. Of the 30 most
recently approved installations (a mix of web and mobile submissions, spanning 2026-08-25
through 2026-09-03), **26 still have their matched stock item sitting as `active` in
inventory** — including installations approved back in August, submitted through the web page,
weeks before mobile self-report existed. The 4 that do show `sold_out` are coincidental: each
one's `sold_out_at` timestamp is from *before* that job's own `approved_at` — meaning something
else marked that stock item sold out, unrelated to this approval.

**Root cause, confirmed by reproducing it directly against the schema:** `approveJobStage2Action`
(`app/actions/products.ts`) writes the job's own `id` into `stock.sold_out_by_installer_id` —
a column that, despite the name, is meant to hold the real installer's id, and carries a live
foreign-key constraint pointing at `profiles.id`. A job id essentially never matches a real
profile id, so the write violates that constraint and Postgres rejects it — on effectively every
approval. Nobody has seen an error because this specific `.update()` call is the only step in
the whole function that never checks its result: the `installer_jobs` status update right above
it does check and would throw, but the stock update's outcome is silently discarded either way,
so the admin sees "Installation fully approved & stock deducted," the job flips to `approved`
correctly, and the stock line item just never moves.

Fix: pass the real installer id (available on the job row as `installer_id`) instead of the job
id, and add proper error handling on this update so a future failure surfaces instead of
vanishing silently. Because this is a backend/database bug with no mobile-app dependency, it can
and should ship on its own, ahead of the rest of Phase 6 — it needs a normal Vercel deploy, not
a mobile build.

**Decided 2026-09-03: also run a one-time backfill**, correcting stock status on the real
backlog of already-approved-but-never-marked-sold-out items this uncovered (26 of the last 30
approved installations alone, spanning back to 2026-08-25). Backfill approach: for every
`installer_jobs` row with `status = 'approved'`, find its matching `stock` row by
`serial_number` and, if that stock row isn't already `sold_out`, set it to `sold_out` with the
real installer id and the job's own `approved_at` as `sold_out_at` (not "now," so the historical
record reflects when the installation was actually approved, not when this backfill happened to
run) — mirroring exactly what `approveJobStage2Action` should have done at approval time. Given
this writes real inventory state, worth a dry-run pass first (list what would change, without
writing) for a manual sanity check before applying it for real.

### 6.7 — Paid/Unpaid incentive status, visible to installers

The data and admin-side logic already exist and are real: `installer_jobs.payment_status`
(`"unpaid"`/`"paid"`), set via `setJobPaymentPaidAction` (admin-only, one-way, only once a job
is `approved` — Stage 2 complete). Today this is only ever shown on the admin Job Assignment
page's "Incentive Status" column; **no installer-facing surface shows it at all, on web or
mobile** — web's own installer portal shows the incentive *amount* but never whether it's been
paid. Fix: add `payment_status` to mobile's existing job queries (Job Details, and the new
"Paid" Jobs tab from 6.5) and render it with the same paid/unpaid badge styling already used on
the admin page, gated the same way (only meaningful once a job is `approved`).

**Decided 2026-09-03: mobile only** — the web installer page has the identical gap
(`app/installer/page.tsx` shows the incentive amount but never paid/unpaid status either), but
fixing that is explicitly out of scope here. Not touched as part of this plan.

### 6.8 — Real app icon and splash screen

Confirmed: `coretech-mobile/assets/icon.png`, `adaptive-icon.png`, `favicon.png`, and
`splash.png` are all the exact same file, byte-for-byte — Expo's generic starter-template
graphic, never replaced since the app was scaffolded. The real logo already exists and is
usable as-is: `public/logo.svg` in the main web app is a clean, square vector mark (a circular
"CT" badge) in the same cyan/blue gradient (`#00B4D8`) already standardized on throughout the
mobile app's Phase 5 UI polish — no new design work needed, just generating properly-sized PNGs
from it for each slot (icon, Android adaptive-icon foreground with safe-zone padding, splash,
favicon).

Important distinction from everything else in this plan: icon/splash are baked into the native
app package, not shippable via OTA update — this needs a real EAS rebuild, the same as the
barcode scanner or the `expo-file-system` fix earlier. Worth setting expectations with the
client that a changed icon/name can make Android briefly treat it as "a new app" on some
launchers until the new build is actually reinstalled, not just opened.

### 6.9 — Suggested build order

6.6 (stock bug) first and separately — pure backend, no mobile build needed, fixes a live data
integrity problem affecting installations already approved. Then, in one native-rebuild pass
(since 6.1, 6.2, and 6.8 all need a rebuild regardless): 6.1 (crop UX), 6.2 (multi-select), 6.4
(FAB reposition), 6.8 (icon/splash). 6.3 (the `getUser()` removal) and 6.5/6.7 (tab
renames + Paid tab + status badge) are pure JS and can ship via OTA either in the same pass or
ahead of it.

### Actually shipped — 2026-09-03/04

All nine items built on one branch, verified (`tsc` clean, `expo-doctor` 18/18, Metro bundle
export clean, main Next.js app's `npm run build` still clean), merged to `master`. 6.6's backfill
ran for real against production: 36 already-approved jobs corrected, 1 (a genuine duplicate-serial
case, "Apna solar.pk") left for manual review rather than guessed. EAS `preview` build (APK,
matching how every prior on-device test build has been distributed — not `production`, which
outputs a Play-Store-only `.aab` that can't be sideloaded; an initial `production` build was
caught and canceled before it consumed real build time) installed and handed to the client for
testing.

## Post-Phase-6 UI fixes — client-reported, 2026-09-04

Four real UI bugs found by the client testing the Phase 6 build, each diagnosed against the
actual code (not guessed) but not yet built.

1. **System splash screen shows a small icon on black instead of a plain white screen.** Not
   the app's own custom splash image — this is Android 12+'s mandatory OS-level splash layer,
   which renders *before* the app's JS or its own splash screen loads. `expo-splash-screen`
   (`0.30.10`) supports separate light/dark configuration; `app.json` currently only sets one
   flat `backgroundColor: "#FFFFFF"` with no explicit dark-mode variant, so a phone in system
   dark mode (the client's is) falls back to Android's own dark default for that brief phase -
   black background, small boxed icon. Fix: explicitly set the dark-mode variant to the same
   white background so the very first frame is white regardless of the phone's theme. Native
   config only, no screen code involved - still needs a real rebuild (splash config is baked in
   at build time).

2. **Profile screen doesn't scroll, cutting off "Sign Out Account."** Confirmed in
   `profile.tsx`: the screen's content sits in a plain `View`, not a `ScrollView`, so anything
   below the visible fold - worse now that the floating "+" button from 6.4 also sits over the
   same bottom-right corner - is clipped rather than scrollable. Fix: wrap the content in a
   `ScrollView` like every other screen already does, with enough bottom padding to clear the
   floating button. (Jobs history itself is already fine - `jobs.tsx` is built on a `FlatList`,
   which scrolls by default, so a long job history was never actually at risk here.)

3. **Sign Out button's icon and text stack vertically instead of sitting side by side** - a
   real, separate bug from the `AnimatedPressable` fix that shipped after Phase 5, found by
   reading the component again. That earlier fix corrected which element receives *sizing*
   (`style`, e.g. `flex: 1`) - it now correctly lands on the outer `Pressable`. This is a
   different property: *row-vs-column arrangement of multiple children*. `logoutButton`'s
   `flexDirection: "row"` is on the outer `Pressable`, but the `LogOut` icon and the text are
   both nested one level deeper, inside the inner `Animated.View` that exists only to hold the
   press-scale animation - and that inner view has no `flexDirection` of its own, so React
   Native's default (`column`) applies to its children regardless of what the outer `Pressable`
   is set to. Confirmed this also affects the Dashboard's "Submit New Installation" button
   (`app/(tabs)/index.tsx`), which has the same shape (an icon `View` and a text-block `View` as
   two direct children) - its icon is very likely also stacked above its title/subtitle instead
   of beside them, just not separately reported. Every other `AnimatedPressable` usage in the
   app only ever passes a single child (one `Text`, or one wrapping `View` that manages its own
   internal layout), so this specific bug is scoped to just these two buttons, not universal.
   **Real fix, not a patch:** stop nesting a second, unstyled `Animated.View` between the
   `Pressable` and its children - merge the caller's `style` directly onto the same
   `Animated.View` that holds the scale transform, and leave `Pressable` itself unstyled (touch
   handling only). One styled container instead of two mismatched ones removes this whole class
   of "which layer does this style prop need to reach" bug, rather than fixing properties one at
   a time as they're separately discovered.

4. **Marital Status should drop "Divorced" and "Widowed."** Confirmed in `register.tsx`:
   `MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"]`. Fix: trim the array down to
   `["Single", "Married"]`.

5. **Login email field placeholder text.** Confirmed in `login.tsx`: `placeholder="enter
   email/admin/user"` - leftover wording with no admin/user concept relevant to this app. Fix:
   replace with plain `"Enter email"`.

All five are small and low-risk, no new native dependency among them - only item 1 (the splash
dark-mode fix) strictly requires a native rebuild on its own; items 2-5 are pure JS/UI and could
ship in the same rebuild pass or via OTA.

## Resolved decision — self-report an unassigned installation

Decided 2026-09-03: yes, build it — see Phase 3's "+" button item above. Turned out not to
need a separate yes/no ahead of Phase 1 after all: `submitInstallationAction` already had a
branch for a brand-new job (not just updating an existing one) from the original web-supporting
logic, untouched by the Phase 1 ownership fix, so Phase 1's endpoint already supported this
without any changes — the only real work is the mobile-side entry point in Phase 3.

**Superseded 2026-09-03 by Phase 5 above** — at the time this was decided, self-report was
understood as *an* option alongside admin-assigned jobs, which is why Phase 3 built it as a
secondary entry point (a small FAB) rather than the main one. The client's direct clarification
in Phase 5 establishes it was never optional — it's the only flow this app actually has. The
decision to build it stands unchanged; what changes is how central it should have been treated
from the start.

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

**Status, 2026-09-03: gate condition met, step not yet done.** Phases 1-5 are built, merged,
and verified on-device — the native app now genuinely does everything the web pages did, plus
the server-side re-validation and self-report reframing they never had. The web pages
themselves have not been removed yet; this remains a separate action to take whenever
explicitly requested. Note this doesn't reduce Phase 0's underlying database exposure either
way, since that risk lives in the schema/RLS layer both surfaces share, not in which
front-end is used.
