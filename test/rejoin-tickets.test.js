/* eslint-disable */
// Run with `npm test` (node's built-in test runner).
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { createTicketStore, positiveMsFromEnv, DEFAULT_TTL_MS, DEFAULT_GRACE_MS } = require("../rejoin-tickets");

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe("rejoin tickets", () => {
  it("lets the participant back into the room the ticket was issued for", () => {
    const store = createTicketStore({ now: clock().now });
    const ticket = store.issue("room-1", "Ada", "sock-1");
    assert.deepEqual(store.resume(ticket, "room-1"), { userName: "Ada", socketId: "sock-1" });
  });

  it("rejects the same ticket for a different room", () => {
    const store = createTicketStore({ now: clock().now });
    const ticket = store.issue("room-1", "Ada", "sock-1");
    assert.equal(store.resume(ticket, "room-2"), null);
    // ...and does not burn it: the legitimate rejoin still works.
    assert.notEqual(store.resume(ticket, "room-1"), null);
  });

  it("rejects unknown, empty and non-string tickets", () => {
    const store = createTicketStore({ now: clock().now });
    store.issue("room-1", "Ada", "sock-1");
    for (const bad of ["nope", "", undefined, null, 42, {}]) {
      assert.equal(store.resume(bad, "room-1"), null);
    }
    assert.equal(store.resume("x", undefined), null);
  });

  it("expires after the ttl, well past the 1h access token", () => {
    const c = clock();
    const store = createTicketStore({ now: c.now, ttlMs: 8 * 3600_000 });
    const ticket = store.issue("room-1", "Ada", "sock-1");
    c.advance(3 * 3600_000);
    assert.notEqual(store.resume(ticket, "room-1"), null);
    c.advance(5 * 3600_000);
    assert.equal(store.resume(ticket, "room-1"), null);
    assert.equal(store.size(), 0);
  });

  it("keeps two participants apart", () => {
    const store = createTicketStore({ now: clock().now });
    const a = store.issue("room-1", "Ada", "sock-a");
    const b = store.issue("room-1", "Grace", "sock-b");
    assert.notEqual(a, b);
    assert.equal(store.resume(a, "room-1").userName, "Ada");
    assert.equal(store.resume(b, "room-1").userName, "Grace");
  });

  it("follows the socket that holds the ticket, and forgets a revoked ticket", () => {
    const store = createTicketStore({ now: clock().now });
    const ticket = store.issue("room-1", "Ada", "sock-1");
    store.bind(ticket, "sock-2");
    assert.equal(store.resume(ticket, "room-1").socketId, "sock-2");
    store.revoke(ticket);
    assert.equal(store.resume(ticket, "room-1"), null);
  });

  it("issues unguessable tickets", () => {
    const store = createTicketStore({ now: clock().now });
    const seen = new Set(Array.from({ length: 200 }, () => store.issue("r", "n", "s")));
    assert.equal(seen.size, 200);
    for (const t of seen) assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  });

  it("shortens a ticket to the grace window once its socket is gone, never past the absolute maximum", () => {
    const c = clock();
    const store = createTicketStore({ now: c.now, ttlMs: 8 * 3600_000, graceMs: 10 * 60_000 });
    const ticket = store.issue("room-1", "Ada", "sock-1");
    c.advance(60_000);
    store.release(ticket, "sock-1");
    assert.equal(store.resume(ticket, "room-1").socketId, null);
    c.advance(9 * 60_000);
    assert.notEqual(store.resume(ticket, "room-1"), null);
    c.advance(2 * 60_000);
    assert.equal(store.resume(ticket, "room-1"), null);

    // near the absolute maximum the grace cannot extend the life
    const late = store.issue("room-1", "Ada", "sock-2");
    c.advance(8 * 3600_000 - 60_000);
    store.release(late, "sock-2");
    c.advance(61_000);
    assert.equal(store.resume(late, "room-1"), null);
  });

  it("ignores a release from a socket that no longer holds the ticket, and a rebind restores the full life", () => {
    const c = clock();
    const store = createTicketStore({ now: c.now, ttlMs: 8 * 3600_000, graceMs: 60_000 });
    const ticket = store.issue("room-1", "Ada", "sock-1");
    store.bind(ticket, "sock-2");
    store.release(ticket, "sock-1"); // stale socket going away
    c.advance(2 * 60_000);
    assert.equal(store.resume(ticket, "room-1").socketId, "sock-2");
    store.release(ticket, "sock-2");
    store.bind(ticket, "sock-3");
    c.advance(5 * 3600_000);
    assert.notEqual(store.resume(ticket, "room-1"), null);
  });
});

describe("positiveMsFromEnv", () => {
  it("accepts only a finite number above zero", () => {
    assert.equal(positiveMsFromEnv("1500", 7), 1500);
    for (const bad of [undefined, "", "  ", "abc", "0", "-5", "Infinity", "NaN", "1e999"]) {
      assert.equal(positiveMsFromEnv(bad, 7), 7, String(bad));
    }
  });

  it("defaults are 3h absolute and 10 min grace", () => {
    assert.equal(DEFAULT_TTL_MS, 3 * 3600_000);
    assert.equal(DEFAULT_GRACE_MS, 10 * 60_000);
  });
});
