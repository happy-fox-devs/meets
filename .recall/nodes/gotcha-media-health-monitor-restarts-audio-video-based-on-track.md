---
id: gotcha-media-health-monitor-restarts-audio-video-based-on-track
type: gotcha
scope: project
title: Media health monitor restarts audio/video based on track.readyState/track.muted only, deliberately NOT audio amplitude -- an earlier amplitude heuristic falsely broke quiet listeners' audio every ~10s
triggers: ["monitor de salud de audio","media health check false restart","audio restart every 10 seconds bug"]
anchors: [{"path":"src/app/room/[roomId]/page.tsx","symbol":"checkMediaHealth"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
The requestAnimationFrame-driven `checkMediaHealth` loop only calls
`restartMedia(type)` when `audioTrack.readyState==="ended"` or
`audioTrack.muted` (same for video) is true. The inline comment explains why:
a previous amplitude-based "10s of silence" heuristic treated a quiet-but-fine
participant as broken audio, stopped and re-acquired the live track, and
caused a real audible gap for every quiet listener, repeating roughly every
10 seconds. Don't reintroduce amplitude/volume-based health detection here.
