/* eslint-disable */
// Run with `npm test`. Real Socket.IO server + client sockets over websocket, with a mock Calendar backend: no Next, no real backend.
const assert = require("node:assert/strict");
const http = require("node:http");
const { describe, it, before, after } = require("node:test");
const { Server } = require("socket.io");
const { io: connectClient } = require("socket.io-client");
const { createTicketStore } = require("../rejoin-tickets");
const { attachSignaling } = require("../signaling");

const GRACE_MS = 700;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let backend; // mock Calendar service: only the bearer "good" is authorized (stands for a token still valid at the first join)
let backendCalls = 0;
let httpServer;
let ioServer;
let tickets;
let baseUrl;
const clients = [];

before(async () => {
  backend = http.createServer((req, res) => {
    backendCalls++;
    const slow = req.headers.authorization === "Bearer slow"; // authorized, but answers late (a leave-room can overtake it)
    const ok = slow || req.headers.authorization === "Bearer good";
    setTimeout(() => {
      res.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
      res.end(JSON.stringify(ok ? { authorized: true, userName: "Ada" } : { authorized: false, error: "expired" }));
    }, slow ? 300 : 0);
  });
  await new Promise((r) => backend.listen(0, "127.0.0.1", r));

  tickets = createTicketStore({ graceMs: GRACE_MS });
  httpServer = http.createServer();
  ioServer = new Server(httpServer);
  attachSignaling(ioServer, {
    calendarApiUrl: `http://127.0.0.1:${backend.address().port}`,
    maxRoomSize: 2,
    tickets,
  });
  await new Promise((r) => httpServer.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  for (const c of clients) c.close();
  await ioServer.close();
  backend.close();
  backend.closeAllConnections?.();
});

function connect() {
  return new Promise((resolve) => {
    const s = connectClient(baseUrl, { transports: ["websocket"], reconnection: false });
    clients.push(s);
    s.on("connect", () => resolve(s));
  });
}

/** Resolves with the event's args, or undefined after `ms` (so "nothing happened" is assertable). */
function once(s, ev, ms = 1500) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), ms);
    s.once(ev, (...args) => {
      clearTimeout(t);
      resolve(args);
    });
  });
}

/** Joins and resolves with the ticket the server handed back (undefined when the join was refused). */
async function join(s, room, token, ticket, userId = s.id) {
  const session = once(s, "room-session");
  s.emit("join-room", room, userId, token, ticket);
  return ((await session) ?? [])[0];
}

async function joinRefused(s, room, token, ticket) {
  const err = once(s, "error");
  const session = once(s, "room-session", 400);
  s.emit("join-room", room, s.id, token, ticket);
  const [message] = (await err) ?? [];
  return { message, session: await session };
}

describe("rejoin tickets through the socket server", () => {
  it("admits a first join with a valid token and hands out a ticket", async () => {
    const a = await connect();
    const ticket = await join(a, "r-first", "good");
    assert.equal(typeof ticket, "string");
    assert.ok(ticket.length >= 40);
  });

  it("lets a reconnect in with an EXPIRED token and a valid ticket, without asking the backend again", async () => {
    const a = await connect();
    const ticket = await join(a, "r-resume", "good");
    const callsBefore = backendCalls;
    a.close();
    const b = await connect();
    assert.equal(await join(b, "r-resume", "bad", ticket), ticket);
    assert.equal(backendCalls, callsBefore);

    // ...and the resumed socket really is in the room
    const c = await connect();
    await join(c, "r-resume", "good");
    const relayed = once(c, "peer-state-changed");
    b.emit("peer-state-changed", { muted: true, videoOff: false });
    assert.ok(await relayed);
  });

  it("falls back to the token when the ticket is for another room", async () => {
    const a = await connect();
    const ticket = await join(a, "r-other-A", "good");
    const b = await connect();
    const callsBefore = backendCalls;
    const ticketB = await join(b, "r-other-B", "good", ticket);
    assert.equal(backendCalls, callsBefore + 1, "the token was checked against the backend");
    assert.notEqual(ticketB, ticket, "the other room got its own ticket");

    const c = await connect();
    const refused = await joinRefused(c, "r-other-B", "bad", ticket);
    assert.match(refused.message, /Not authorized/);
    assert.equal(refused.session, undefined);
  });

  it("rejects an expired ticket with an expired token, and forged / missing credentials", async () => {
    const a = await connect();
    const ticket = await join(a, "r-expired", "good");
    a.close();
    await wait(GRACE_MS + 150);
    const b = await connect();
    assert.match((await joinRefused(b, "r-expired", "bad", ticket)).message, /Not authorized/);

    const c = await connect();
    assert.match((await joinRefused(c, "r-expired", "bad", "forged-ticket")).message, /Not authorized/);

    const d = await connect();
    const err = once(d, "error");
    d.emit("join-room", "r-expired", d.id);
    assert.match((await err)[0], /Invalid user details/);
  });

  it("drops the old socket when its ticket is resumed on a new one", async () => {
    const a = await connect();
    const ticket = await join(a, "r-old", "good");
    const dropped = new Promise((r) => a.once("disconnect", () => r(true)));
    const b = await connect();
    assert.equal(await join(b, "r-old", undefined, ticket), ticket);
    assert.equal(await Promise.race([dropped, wait(1500).then(() => false)]), true);
    // dropping the stale socket did not shorten the live one's ticket to the grace window
    await wait(GRACE_MS + 150);
    assert.notEqual(tickets.resume(ticket, "r-old"), null);
  });

  it("does not consume the ticket when the room is full", async () => {
    const a = await connect();
    const ticket = await join(a, "r-full", "good");
    a.close();
    const b = await connect();
    await join(b, "r-full", "good");
    const c = await connect();
    await join(c, "r-full", "good"); // room: b, c (cap is 2)

    const a2 = await connect();
    const refused = await joinRefused(a2, "r-full", "bad", ticket);
    assert.match(refused.message, /full/);
    assert.equal(refused.session, undefined);

    c.close();
    await wait(100);
    const a3 = await connect();
    assert.equal(await join(a3, "r-full", "bad", ticket), ticket, "the same ticket still works once there is room");
  });

  it("revokes the ticket on leave-room, so a rejoin with it fails", async () => {
    const a = await connect();
    const ticket = await join(a, "r-leave", "good");
    const peer = await connect();
    await join(peer, "r-leave", "good");
    const gone = once(peer, "user-disconnected");
    await new Promise((r) => a.emit("leave-room", r));
    assert.deepEqual(await gone, [a.id]);
    assert.equal(tickets.resume(ticket, "r-leave"), null);

    const b = await connect();
    assert.match((await joinRefused(b, "r-leave", "bad", ticket)).message, /Not authorized/);
  });

  it("does not admit or issue a ticket when leave-room arrives while the first join is still being authorized", async () => {
    const peer = await connect();
    await join(peer, "r-leave-early", "good");
    const a = await connect();
    const announced = once(peer, "user-connected", 800);
    const session = once(a, "room-session", 800);
    a.emit("join-room", "r-leave-early", a.id, "slow", undefined);
    await wait(50); // the backend is still thinking
    await new Promise((r) => a.emit("leave-room", r));
    assert.equal(await session, undefined, "no ticket is handed to a socket that already left");
    assert.equal(await announced, undefined, "nobody is told a participant connected");
    assert.equal(ioServer.sockets.adapter.rooms.get("r-leave-early")?.has(a.id) ?? false, false);

    // The socket is not poisoned: joining again afterwards works normally.
    assert.ok(await join(a, "r-leave-early", "good"));
  });

  it("keeps a ticket alive for the grace window after the socket drops, then lets it expire", async () => {
    const a = await connect();
    const ticket = await join(a, "r-grace", "good");
    a.close();
    await wait(80);
    const b = await connect();
    assert.equal(await join(b, "r-grace", "bad", ticket), ticket, "within the grace window");
    b.close();
    await wait(GRACE_MS + 150);
    const c = await connect();
    assert.match((await joinRefused(c, "r-grace", "bad", ticket)).message, /Not authorized/);
    assert.equal(tickets.resume(ticket, "r-grace"), null);
  });

  it("ignores a repeated join-room on the same socket: no new tickets, no second announcement", async () => {
    const watcher = await connect();
    await join(watcher, "r-repeat", "good");
    const a = await connect();
    const size = tickets.size();
    const announced = [];
    watcher.on("user-connected", (id) => announced.push(id));
    const first = await join(a, "r-repeat", "good");
    const again = once(a, "room-session", 400);
    a.emit("join-room", "r-repeat", a.id, "good");
    a.emit("join-room", "r-repeat", a.id, "good", first);
    assert.equal(await again, undefined);
    await wait(100);
    assert.equal(tickets.size(), size + 1);
    assert.deepEqual(announced, [a.id]);
  });

  it("ignores a join-room fired twice before the first is authorized", async () => {
    const a = await connect();
    const size = tickets.size();
    const sessions = [];
    a.on("room-session", (t) => sessions.push(t));
    a.emit("join-room", "r-race", a.id, "good");
    a.emit("join-room", "r-race", a.id, "good");
    await wait(400);
    assert.equal(sessions.length, 1);
    assert.equal(tickets.size(), size + 1);
  });

  it("uses the socket's own id as the identity, not the userId the client sends", async () => {
    const watcher = await connect();
    await join(watcher, "r-spoof", "good");
    const a = await connect();
    const ticket = await join(a, "r-spoof", "good");
    a.close();
    await wait(50);

    const b = await connect();
    const seen = once(watcher, "user-connected");
    assert.equal(await join(b, "r-spoof", "bad", ticket, "someone-elses-id"), ticket);
    assert.deepEqual((await seen).slice(0, 1), [b.id]);

    const stateSeen = once(watcher, "peer-state-changed");
    b.emit("peer-state-changed", { userId: "someone-elses-id", muted: true, videoOff: false });
    assert.equal((await stateSeen)[0].userId, b.id);
  });

  it("does not let a socket that never joined post into a room", async () => {
    const member = await connect();
    await join(member, "r-quiet", "good");
    const outsider = await connect();
    const leak = once(member, "receive-message", 500);
    outsider.emit("send-message", "r-quiet", "hi", "x");
    assert.equal(await leak, undefined);
  });
});
