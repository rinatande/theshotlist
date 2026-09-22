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

interface Store {
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

const memory = new Map<string, number>();
const memoryStore: Store = {
  get: async (key) => memory.get(key) ?? 0,
  incr: async (key, by) => {
    const value = (memory.get(key) ?? 0) + by;
    memory.set(key, value);
    return value;
  },
  setIfAbsent: async (key, value) => {
    if (!memory.has(key)) memory.set(key, value);
    return memory.get(key)!;
  },
};

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
export async function reserve(s: Store, who: Who, estimateUsd = 0.1): Promise<Decision> {
  const day = today();
  const spendKey = `spend:${day}`;
  const spent = await s.get(spendKey);
  if (spent + estimateUsd > LIMITS.dailyBudgetUsd) {
    return { ok: false, message: `Today's full reads are used up across the app. Matched on this phone instead — it resets in about ${hoursUntilReset()} hours.` };
  }

  const invite = who.invite?.toLowerCase();
  if (invite && inviteCodes().has(invite)) {
    const first = await s.setIfAbsent(`invite:first:${invite}`, Date.now(), LIMITS.inviteDays * DAY * 2);
    if (Date.now() - first > LIMITS.inviteDays * DAY * 1000) {
      return { ok: false, message: "This invite link has run its course. Matched on this phone instead." };
    }
    const usedKey = `invite:used:${invite}`;
    const used = await s.incr(usedKey, 1, LIMITS.inviteDays * DAY * 2);
    if (used > LIMITS.inviteReads) {
      await s.incr(usedKey, -1, LIMITS.inviteDays * DAY * 2);
      return { ok: false, message: "This invite link's full reads are used up. Matched on this phone instead." };
    }
    return {
      ok: true,
      remaining: LIMITS.inviteReads - used,
      charge: async () => {},
      refund: async () => void (await s.incr(usedKey, -1, LIMITS.inviteDays * DAY * 2)),
    };
  }

  const deviceKey = `device:${day}:${who.device}`;
  const addressKey = `address:${day}:${who.address}`;
  const [deviceUsed, addressUsed] = [await s.incr(deviceKey, 1, DAY), await s.incr(addressKey, 1, DAY)];
  const undo = async () => {
    await s.incr(deviceKey, -1, DAY);
    await s.incr(addressKey, -1, DAY);
  };
  if (deviceUsed > LIMITS.perDevice || addressUsed > LIMITS.perAddress) {
    await undo();
    return { ok: false, message: `That's today's ${LIMITS.perDevice} full reads on this phone. Matched on this phone instead — more in about ${hoursUntilReset()} hours.` };
  }
  return { ok: true, remaining: LIMITS.perDevice - deviceUsed, charge: async () => {}, refund: undo };
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
