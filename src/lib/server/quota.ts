import { Redis } from "@upstash/redis";

/**
 * Who may run the online read, and how often (build-journal, 22 Sep). The
 * offline read is never limited — only the one that costs money.
 *
 *   1. A ceiling for the whole app per day, in dollars.
 *   2. Reads per device per day, with the network address as a backstop.
 *   3. Invite links: a fixed number of reads over a fixed number of days.
 *
 * Stores counters only — never a brief or a project. Upstash Redis when it's
 * configured; in local development, memory. In production with no store, the
 * read refuses rather than running unmetered.
 */

const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);

export const LIMITS = {
  dailyBudgetUsd: num(process.env.READ_DAILY_BUDGET_USD, 2),
  perDevice: num(process.env.READ_PER_DEVICE_DAILY, 5),
  perAddress: num(process.env.READ_PER_ADDRESS_DAILY, 15),
  inviteReads: num(process.env.INVITE_READS, 25),
  inviteDays: num(process.env.INVITE_DAYS, 14),
};

/** Invite codes, from the INVITES env var: "acme,globex,initech". Case-insensitive. */
export function inviteCodes(): Set<string> {
  return new Set(
    (process.env.INVITES ?? "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
  );
}

export interface Store {
  get(key: string): Promise<number>;
  incr(key: string, by: number, ttlSeconds: number): Promise<number>;
  setIfAbsent(key: string, value: number, ttlSeconds: number): Promise<number>;
}

const DAY = 60 * 60 * 24;

function redisStore(): Store | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  return {
    get: async (key) => Number((await redis.get<number>(key)) ?? 0),
    incr: async (key, by, ttl) => {
      const value = await redis.incrbyfloat(key, by);
      await redis.expire(key, ttl);
      return Number(value);
    },
    setIfAbsent: async (key, value, ttl) => {
      await redis.set(key, value, { nx: true, ex: ttl });
      return Number((await redis.get<number>(key)) ?? value);
    },
  };
}

/** In-memory counters with expiry, like Redis — for development, and for tests with their own clock. */
export function memoryStoreFor(now: () => number = () => Date.now()): Store {
  const memory = new Map<string, { value: number; expires: number }>();
  const live = (key: string) => {
    const e = memory.get(key);
    if (e && e.expires <= now()) memory.delete(key);
    return memory.get(key);
  };
  return {
    get: async (key) => live(key)?.value ?? 0,
    incr: async (key, by, ttl) => {
      const value = (live(key)?.value ?? 0) + by;
      memory.set(key, { value, expires: now() + ttl * 1000 });
      return value;
    },
    setIfAbsent: async (key, value, ttl) => {
      if (!live(key)) memory.set(key, { value, expires: now() + ttl * 1000 });
      return live(key)!.value;
    },
  };
}

const memoryStore = memoryStoreFor();

export function store(): Store | null {
  const redis = redisStore();
  if (redis) return redis;
  // Unmetered reads in production would put the whole budget at risk.
  return process.env.VERCEL_ENV === "production" ? null : memoryStore;
}

/** UTC day, so every server agrees on when "today" ends. */
const today = () => new Date().toISOString().slice(0, 10);

export function hoursUntilReset(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 3_600_000));
}

export interface Who {
  device: string;
  address: string;
  invite?: string;
}

export type Decision = { ok: true; remaining: number; charge: () => Promise<void>; refund: () => Promise<void> } | { ok: false; message: string };

/**
 * Reserve one read before calling the model. The caller must `charge` the
 * actual cost after a success, or `refund` the reservation after a failure.
 */
/**
 * A running read holds a place for this long. A read is counted only when it
 * succeeds (Rina, 23 Sep): if the server is killed mid-read — a timeout, a
 * crash — nothing runs to hand the read back, so the hold simply expires.
 * Longer than the route's maxDuration (300s), so it can't lapse mid-read.
 */
export const HOLD_SECONDS = 6 * 60;

/** Hold one place against `limit`, counting reads done and reads running. */
async function hold(s: Store, usedKey: string, holdKey: string, limit: number): Promise<boolean> {
  const held = await s.incr(holdKey, 1, HOLD_SECONDS);
  if ((await s.get(usedKey)) + held > limit) {
    await release(s, holdKey);
    return false;
  }
  return true;
}

/** Let a hold go — never below zero, even if it already expired. */
async function release(s: Store, holdKey: string): Promise<void> {
  const v = await s.incr(holdKey, -1, HOLD_SECONDS);
  if (v < 0) await s.incr(holdKey, -v, HOLD_SECONDS);
}

export async function reserve(s: Store, who: Who, estimateUsd = 0.1): Promise<Decision> {
  const day = today();
  const spendKey = `spend:${day}`;
  const spent = await s.get(spendKey);
  if (spent + estimateUsd > LIMITS.dailyBudgetUsd) {
    return { ok: false, message: `Today's reads are used up across the app. They reset in about ${hoursUntilReset()} hours — you can still add shots by hand.` };
  }

  const invite = who.invite?.toLowerCase();
  if (invite && inviteCodes().has(invite)) {
    const ttl = LIMITS.inviteDays * DAY * 2;
    const first = await s.setIfAbsent(`invite:first:${invite}`, Date.now(), ttl);
    if (Date.now() - first > LIMITS.inviteDays * DAY * 1000) {
      return { ok: false, message: "This invite link has run its course. You can still add shots by hand." };
    }
    const usedKey = `invite:used:${invite}`;
    const holdKey = `hold:${usedKey}`;
    if (!(await hold(s, usedKey, holdKey, LIMITS.inviteReads))) {
      return { ok: false, message: "This invite link's reads are used up. You can still add shots by hand." };
    }
    return {
      ok: true,
      remaining: Math.max(0, LIMITS.inviteReads - (await s.get(usedKey)) - 1),
      charge: async () => {
        await s.incr(usedKey, 1, ttl);
        await release(s, holdKey);
      },
      refund: () => release(s, holdKey),
    };
  }

  const deviceKey = `device:${day}:${who.device}`;
  const addressKey = `address:${day}:${who.address}`;
  const deviceHold = `hold:${deviceKey}`;
  const addressHold = `hold:${addressKey}`;
  const full = { ok: false as const, message: `That's today's ${LIMITS.perDevice} reads on this phone. More in about ${hoursUntilReset()} hours — you can still add shots by hand.` };
  if (!(await hold(s, deviceKey, deviceHold, LIMITS.perDevice))) return full;
  if (!(await hold(s, addressKey, addressHold, LIMITS.perAddress))) {
    await release(s, deviceHold);
    return full;
  }
  const letGo = async () => {
    await release(s, deviceHold);
    await release(s, addressHold);
  };
  return {
    ok: true,
    remaining: Math.max(0, LIMITS.perDevice - (await s.get(deviceKey)) - 1),
    // Counted only now, once the read has come back.
    charge: async () => {
      await s.incr(deviceKey, 1, DAY);
      await s.incr(addressKey, 1, DAY);
      await letGo();
    },
    refund: letGo,
  };
}

/** Add what a read actually cost to today's total for the whole app. */
export async function recordSpend(s: Store, usd: number): Promise<void> {
  await s.incr(`spend:${today()}`, usd, DAY * 2);
}

/** Reads left today, for the brief screen — without reserving one. */
export async function remaining(s: Store, who: Who): Promise<number> {
  const invite = who.invite?.toLowerCase();
  if (invite && inviteCodes().has(invite)) return Math.max(0, LIMITS.inviteReads - (await s.get(`invite:used:${invite}`)));
  return Math.max(0, LIMITS.perDevice - (await s.get(`device:${today()}:${who.device}`)));
}
