---
id: gotcha-next-config-ts-explicitly-sets-reactstrictmode-false-unlike
type: gotcha
scope: project
title: next.config.ts explicitly sets reactStrictMode: false, unlike the default create-next-app scaffold
triggers: ["reactStrictMode deshabilitado","strict mode disabled meets","why is strict mode off"]
anchors: [{"path":"next.config.ts"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
`next.config.ts` is a 3-line config whose only setting is
`reactStrictMode: false` (create-next-app's default scaffold normally leaves
this true or omits it). The room page's main useEffect does one-time
imperative setup (socket.io connection, getUserMedia, simple-peer creation)
that is not written to tolerate StrictMode's dev-mode double-invoke of
effects; this flag being off is load-bearing for that code as currently
written, not an oversight.
