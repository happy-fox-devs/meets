---
id: pattern-server-js-has-a-graceful-shutdown-handler-on-sigterm-sigint
type: pattern
scope: project
title: server.js has a graceful shutdown handler on SIGTERM/SIGINT that warns all connected sockets and force-exits after 10s if connections don't drain
triggers: ["apagado gradual del servidor","graceful shutdown SIGTERM","deploy breaks live calls"]
anchors: [{"path":"server.js","symbol":"shutdown"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
`shutdown(signal)` does `io.emit("error", "Server is restarting, please rejoin in a moment.")`,
then `io.close()` and `httpServer.close()`, with a `setTimeout(()=>process.exit(1), 10_000).unref()`
force-exit fallback if sockets don't drain in time. Comment states plainly:
without this every live call breaks abruptly on deploy instead of participants
getting any warning. Registered for both SIGTERM and SIGINT.
