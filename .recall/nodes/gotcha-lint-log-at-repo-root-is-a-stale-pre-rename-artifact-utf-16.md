---
id: gotcha-lint-log-at-repo-root-is-a-stale-pre-rename-artifact-utf-16
type: gotcha
scope: project
title: lint.log at repo root is a stale pre-rename artifact (UTF-16, old path E:\Trabajos\happyfox\meets\...) reporting a parse error at room page line 238 that does not reproduce in current code -- ignore/delete it
triggers: ["lint.log obsoleto","stale lint.log file","parsing error line 238 does not exist"]
anchors: [{"path":"lint.log"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
lint.log is UTF-16-encoded (visibly double-spaced when read as text) and its
one recorded error references the old repo path
`E:\Trabajos\happyfox\meets\src\app\room\[roomId]\page.tsx` (pre-rename to
E:\Trabajo\NestWorks\meets) with "238:2 error Parsing error: Declaration or
statement expected". Verified: the current room/[roomId]/page.tsx is 987 lines
and line 238 (`if (peersRef.current.some((p) => p.peerId === payload.from)) return;`
inside the offer handler) is syntactically fine -- `npm run lint` was not
re-run to confirm zero errors during this pass, but the specific recorded
error is stale and tied to an old file state. Treat this file as dead, not as
a live lint failure.
