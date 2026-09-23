import { describe, expect, it } from "vitest";
import { HOLD_SECONDS, LIMITS, memoryStoreFor, remaining, reserve } from "./quota";

// A read only counts once it has come back (Rina, 23 Sep): "does a failed read
// still take up 1 of the 5 reads for the day? it shouldn't".
describe("what counts as one of today's reads", () => {
  const setup = () => {
    let t = Date.now();
    const s = memoryStoreFor(() => t);
    const who = { device: "11111111-1111-4111-8111-111111111111", address: "203.0.113.7" };
    return { s, who, later: (seconds: number) => (t += seconds * 1000) };
  };

  it("counts a read that succeeds", async () => {
    const { s, who } = setup();
    const d = await reserve(s, who);
    if (!d.ok) throw new Error("refused");
    expect(d.remaining).toBe(LIMITS.perDevice - 1);
    await d.charge();
    expect(await remaining(s, who)).toBe(LIMITS.perDevice - 1);
  });

  it("doesn't count a read that fails", async () => {
    const { s, who } = setup();
    const d = await reserve(s, who);
    if (!d.ok) throw new Error("refused");
    await d.refund();
    expect(await remaining(s, who)).toBe(LIMITS.perDevice);
  });

  it("doesn't count a read whose server was killed mid-read — its hold just expires", async () => {
    const { s, who, later } = setup();
    // Five reads start and the server dies on all of them: no charge, no refund.
    for (let i = 0; i < LIMITS.perDevice; i++) expect((await reserve(s, who)).ok).toBe(true);
    expect(await remaining(s, who)).toBe(LIMITS.perDevice);
    // While they're held, a sixth can't start — the limit can't be dodged by firing at once.
    expect((await reserve(s, who)).ok).toBe(false);
    later(HOLD_SECONDS + 1);
    const d = await reserve(s, who);
    expect(d.ok).toBe(true);
  });

  it("stops at the day's limit, counting only reads that came back", async () => {
    const { s, who } = setup();
    for (let i = 0; i < LIMITS.perDevice; i++) {
      const d = await reserve(s, who);
      if (!d.ok) throw new Error("refused early");
      await d.charge();
    }
    const over = await reserve(s, who);
    expect(over.ok).toBe(false);
    expect(await remaining(s, who)).toBe(0);
  });
});
