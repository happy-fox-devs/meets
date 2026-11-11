/* eslint-disable */
// Rejoin tickets: lets a socket that was already authorized come back after a network blip without the access token that got it in.
//
// The NestWorks access token only lives 1h and the room page keeps the one from its URL, so a reconnect an hour into the call would
// replay an expired token and be thrown out of the room. Instead, the first join (which does validate the token against the
// backend) hands the browser an opaque random ticket. The browser keeps it in memory only and presents it on reconnect.
//
// A ticket is bound to ONE room and the participant name the backend resolved for it, expires on its own, and is held only in this
// process (rooms already live in this process's memory). It is never derived from anything the client chooses.
//
// It is a bearer credential, so its life is kept short where possible: it is revoked when the participant hangs up, and once the
// socket that holds it is gone it only survives a grace window (enough for a network blip), never the full absolute maximum.
const crypto = require("crypto");

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // absolute maximum life of a ticket
const DEFAULT_GRACE_MS = 10 * 60 * 1000; // life left once the socket holding it has gone

/** Reads a duration from an env value: it must be a finite number > 0, anything else (unset, "abc", 0, -5, Infinity) is the default. */
function positiveMsFromEnv(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createTicketStore({ ttlMs = DEFAULT_TTL_MS, graceMs = DEFAULT_GRACE_MS, now = Date.now, randomTicket } = {}) {
  // ticket -> { roomId, userName, expiresAt, maxExpiresAt, socketId }. socketId is null while no live socket holds the ticket.
  const tickets = new Map();
  const newTicket = randomTicket || (() => crypto.randomBytes(32).toString("base64url"));

  function sweep() {
    const t = now();
    for (const [ticket, entry] of tickets) {
      if (entry.expiresAt <= t) tickets.delete(ticket);
    }
  }

  return {
    /** Mints a ticket for a participant the backend just authorized for `roomId`. */
    issue(roomId, userName, socketId) {
      sweep();
      const ticket = newTicket();
      const maxExpiresAt = now() + ttlMs;
      tickets.set(ticket, { roomId, userName, expiresAt: maxExpiresAt, maxExpiresAt, socketId });
      return ticket;
    },

    /**
     * Returns `{ userName, socketId }` when `ticket` is live AND was issued for this very room, otherwise null. A ticket for another
     * room, an unknown one and an expired one are all the same answer: not authorized.
     */
    resume(ticket, roomId) {
      if (typeof ticket !== "string" || typeof roomId !== "string") return null;
      const entry = tickets.get(ticket);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        tickets.delete(ticket);
        return null;
      }
      if (entry.roomId !== roomId) return null;
      return { userName: entry.userName, socketId: entry.socketId };
    },

    /** Records which socket currently holds the ticket (so a stale one can be dropped when the participant comes back). */
    bind(ticket, socketId) {
      const entry = tickets.get(ticket);
      if (!entry) return;
      entry.socketId = socketId;
      entry.expiresAt = entry.maxExpiresAt;
    },

    /**
     * The socket holding the ticket is gone: nobody holds it now, so it only lives `graceMs` more (never past its absolute maximum).
     * A no-op when a newer socket already took the ticket over, so the dropped old socket cannot shorten the live one's life.
     */
    release(ticket, socketId) {
      const entry = tickets.get(ticket);
      if (!entry || entry.socketId !== socketId) return;
      entry.socketId = null;
      entry.expiresAt = Math.min(entry.maxExpiresAt, now() + graceMs);
    },

    revoke(ticket) {
      tickets.delete(ticket);
    },

    size() {
      sweep();
      return tickets.size;
    },
  };
}

module.exports = { createTicketStore, positiveMsFromEnv, DEFAULT_TTL_MS, DEFAULT_GRACE_MS };
