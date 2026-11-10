---
id: gotcha-npx-eslint-currently-reports-5-real-errors-not-the-stale-one
type: gotcha
scope: project
title: npx eslint . currently reports 5 real errors (not the stale one in lint.log): createPeer/addPeer/restartMedia are called inside effects/handlers before their function-declaration site, plus a setState-in-effect and an explicit-any violation
triggers: ["errores de lint actuales en meets","current real lint errors meets","react-hooks immutability accessed before declared"]
anchors: [{"path":"src/app/room/[roomId]/page.tsx","symbol":"createPeer"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
Verified by actually running `npx eslint .` (2026-08-02), not by trusting the
stale lint.log: 5 errors, 4 warnings, all in room/[roomId]/page.tsx.
- 142:7 `react-hooks/set-state-in-effect`: setError() called synchronously in
  the main useEffect body (secure-context check).
- 211:26 / 549:3 `react-hooks/immutability`: `createPeer` used inside the
  "user-connected" handler before its `function createPeer(...)` declaration
  further down the same component (hoisting means it works at runtime, but
  the new react-hooks lint rule flags the ordering because it can't verify the
  reference updates over time).
- 242:26 / 598:3: same pattern for `addPeer` used in the "offer" handler.
- 362:11 / 471:3: same pattern for `restartMedia` used in checkMediaHealth.
- 404:45 `@typescript-eslint/no-explicit-any`: `(window as any).webkitAudioContext`.
- Warnings: unused `socket` state var (107:10), missing `restartMedia` dep in
  a useEffect (392:6), two stale-ref-in-cleanup warnings (466:24, 467:25).
None of these match the parsing error recorded in the stale lint.log --
that file is unrelated to the current real lint state.
