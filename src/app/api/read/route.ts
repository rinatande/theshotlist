import Anthropic from "@anthropic-ai/sdk";
import { MAX_BRIEF, mergeTopUp, progressOf, READ_EFFORT, READ_MODEL, READ_SCHEMA, READ_SYSTEM, readPrompt, shotTarget, topUpPrompt, type ReadEvent, type ReadFailure, type ReadRequest, type ReadResult } from "@/lib/read";
import { recordSpend, reserve, store } from "@/lib/server/quota";

/**
 * The online read (design.md §5.6, M6): the one piece of server code.
 * Fired once per GENERATE; the phone caches the result against a hash of the
 * brief. The answer streams, so the phone can show real progress while it waits. The API key lives in the environment and never reaches the client.
 * Nothing sent here is stored — only the counters in quota.ts.
 */

// A long cut's read can take well over a minute; 120s timed out on Rina's 5–10 minute brief (23 Sep).
export const maxDuration = 300;

/** Only ask for a top-up if there's time left for it inside maxDuration. */
const TOP_UP_BEFORE_MS = 150_000;

/** Sonnet 5 list prices, $ per million tokens — to keep the day's total honest. */
const PRICE = { input: 2, output: 10 };

const DEVICE = /^[0-9a-f-]{36}$/i;

function fail(status: number, reason: string, message: string) {
  return Response.json({ reason, message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "unconfigured", "The full read isn't set up on this server yet.");
  const s = store();
  if (!s) return fail(503, "unconfigured", "The full read isn't set up on this server yet.");

  let body: ReadRequest & { device?: string; invite?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, "error", "That request didn't make sense.");
  }
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) return fail(400, "error", "There's no brief to read.");
  if (brief.length > MAX_BRIEF) return fail(413, "error", `That brief is too long to read — keep it under ${MAX_BRIEF.toLocaleString()} characters.`);
  if (!body.context || !Array.isArray(body.context.onList)) return fail(400, "error", "That request didn't make sense.");
  if (!body.device || !DEVICE.test(body.device)) return fail(400, "error", "That request didn't make sense.");
  // The context goes into the prompt as sent, so bound it: every read costs real money.
  const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, n).map((x) => x.slice(0, len)) : []);
  const fr = body.context.frameRate;
  body.context = {
    ...body.context,
    onList: list(body.context.onList, 80, 200),
    gear: list(body.context.gear, 40, 160),
    frameRate: fr === "mixed" || [24, 25, 30, 50, 60, 120].includes(fr as number) ? fr : undefined,
  };

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const decision = await reserve(s, { device: body.device, address, invite: body.invite });
  if (!decision.ok) return fail(429, "limit", decision.message);

  const started = Date.now();
  // One attempt with room to finish, rather than two that each run out of time.
  const client = new Anthropic({ timeout: 280_000, maxRetries: 0 });
  const context = body.context;
  const encoder = new TextEncoder();
  // If the phone leaves mid-read, stop the model too: no one is waiting for it, and it costs.
  let current: ReturnType<typeof client.messages.stream> | undefined;
  let closed = false;

  /**
   * One streamed request. Progress goes to the phone as it happens (Rina,
   * 23 Sep): a stage when the read starts thinking or writing, and each shot
   * the moment its subject is complete. Returns the finished result.
   */
  const readOnce = async (messages: Anthropic.MessageParam[], send: (e: ReadEvent) => void, before: number): Promise<{ result?: ReadResult; stop: string | null }> => {
    const stream = (current = client.messages.stream({
      model: READ_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // The instructions never change between reads, so they're cached.
      system: [{ type: "text", text: READ_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { effort: READ_EFFORT, format: { type: "json_schema", schema: READ_SCHEMA as unknown as Record<string, unknown> } },
    }));
    let text = "";
    let count = 0;
    let writing = false;
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "thinking") send({ type: "stage", stage: "thinking" });
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        if (!writing) {
          writing = true;
          send({ type: "stage", stage: "writing" });
        }
        text += event.delta.text;
        const p = progressOf(text);
        if (p.count !== count && p.subject) {
          count = p.count;
          send({ type: "shot", count: before + count, subject: p.subject });
        }
      }
    }
    const message = await stream.finalMessage();
    const u = message.usage;
    const inputTokens = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
    await recordSpend(s, (inputTokens * PRICE.input + u.output_tokens * PRICE.output) / 1e6);
    if (message.stop_reason !== "end_turn") return { stop: message.stop_reason };
    const block = message.content.find((b) => b.type === "text");
    try {
      return { result: JSON.parse(block && block.type === "text" ? block.text : "") as ReadResult, stop: message.stop_reason };
    } catch {
      return { stop: "unparsed" };
    }
  };

  const events = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ReadEvent) => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      };
      const failed = async (failure: ReadFailure) => {
        await decision.refund();
        send({ type: "error", failure });
      };
      try {
        const prompt = readPrompt({ brief, context });
        const first = await readOnce([{ role: "user", content: prompt }], send, 0);
        if (first.stop === "refusal") return await failed({ reason: "declined", message: "It couldn't read this brief. Nothing was taken from today's reads." });
        if (!first.result) return await failed({ reason: "error", message: "The read came back incomplete. Nothing was taken from today's reads — try again." });
        let result = first.result;

        // Backstop (Rina, 23 Sep): with no library to fill from, a read that comes back
        // under the budget's minimum is asked once more for what's missing. It's still
        // one read against the limit; only the cost is higher.
        const { floor, room } = shotTarget(context);
        const count = result.shots.length + result.deliverables.reduce((n, d) => n + d.shots.length, 0);
        if (count < floor && Date.now() - started < TOP_UP_BEFORE_MS) {
          send({ type: "stage", stage: "topup" });
          try {
            const more = await readOnce(
              [
                { role: "user", content: prompt },
                { role: "assistant", content: JSON.stringify(result) },
                { role: "user", content: topUpPrompt(count, floor, room) },
              ],
              send,
              count,
            );
            if (more.result) result = mergeTopUp(result, more.result);
          } catch (error) {
            // The first read stands on its own; a failed top-up just leaves it short.
            console.error("read top-up failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
          }
        }

        await decision.charge();
        send({ type: "done", response: { result, model: READ_MODEL, remaining: decision.remaining } });
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
          await failed({ reason: "busy", message: "The reader is busy right now. Try again in a minute — nothing was taken from today's reads." });
        } else if (error instanceof Anthropic.APIConnectionError) {
          await failed({ reason: "busy", message: "Couldn't reach the reader. Try again with signal — nothing was taken from today's reads." });
        } else {
          console.error("read failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
          await failed({ reason: "error", message: "The read didn't work this time. Nothing was taken from today's reads — try again." });
        }
      } finally {
        if (!closed) controller.close();
      }
    },
    cancel() {
      closed = true;
      current?.abort();
    },
  });

  // Newline-delimited JSON: one event per line, unbuffered, never cached.
  return new Response(events, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
  });
}
