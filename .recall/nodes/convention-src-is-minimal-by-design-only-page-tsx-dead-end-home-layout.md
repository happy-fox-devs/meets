---
id: convention-src-is-minimal-by-design-only-page-tsx-dead-end-home-layout
type: convention
scope: project
title: src/ is minimal by design: only page.tsx (dead-end home), layout.tsx (untouched Next scaffold), and room/[roomId]/page.tsx (~987-line monolithic client component with all WebRTC/socket logic) -- no components/lib/hooks dirs exist
triggers: ["estructura de src en meets","meets src directory structure","no hay carpeta components"]
anchors: [{"path":"src/app"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
Full `src/` tree is: app/favicon.ico, app/globals.css, app/layout.tsx (still
has the default create-next-app metadata title "Create Next App" -- never
customized), app/page.tsx, app/room/[roomId]/page.tsx. There is no
src/components, src/lib, src/hooks, or any shared-utility directory --
everything (UI, Video subcomponent, peer creation, signaling handlers, chat,
speaking-activity detection, media health monitoring) lives inline in the one
~987-line room page. Don't go looking for a components folder here.
