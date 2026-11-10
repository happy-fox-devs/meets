---
id: pattern-webrtc-topology-is-full-mesh-every-participant-connects-to
type: pattern
scope: project
title: WebRTC topology is full-mesh (every participant connects to every other directly via simple-peer); MAX_ROOM_SIZE (default 8) caps membership because cost is O(n^2)
triggers: ["topologia full mesh","full mesh webrtc","limite de participantes en la sala","max room size"]
anchors: [{"path":"server.js","symbol":"MAX_ROOM_SIZE"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
No SFU/MCU -- each client runs createPeer (initiator) for every existing
participant and addPeer (non-initiator) for every incoming offer, so a room of
N people opens N*(N-1) simple-peer connections total. server.js reads
`MAX_ROOM_SIZE = parseInt(process.env.MAX_ROOM_SIZE || "8", 10)` and rejects
join-room with "This room is full" once `io.sockets.adapter.rooms.get(roomId)?.size`
reaches that cap. The inline comment explicitly ties the cap to full-mesh
O(n^2) cost.
