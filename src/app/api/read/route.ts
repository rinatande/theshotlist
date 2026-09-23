import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { MAX_BRIEF, READ_MODEL, READ_SCHEMA, READ_SYSTEM, readPrompt, type ReadRequest, type ReadResponse, type ReadResult } from "@/lib/read";
import { recordSpend, reserve, store } from "@/lib/server/quota";

/**
 * The online read (design.md §5.6, M6): the one piece of server code.
 * Fired once per GENERATE; the phone caches the result against a hash of the
 * brief. The API key lives in the environment and never reaches the client.
 * Nothing sent here is stored — only the counters in quota.ts.
 */

// A careful read takes 20–60 seconds.
export const maxDuration = 120;

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

  const client = new Anthropic({ timeout: 100_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: READ_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // The instructions never change between reads, so they're cached.
      system: [{ type: "text", text: READ_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: readPrompt({ brief, context: body.context }) }],
      output_config: { format: jsonSchemaOutputFormat(READ_SCHEMA) },
    });

    const u = response.usage;
    const inputTokens = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
    await recordSpend(s, (inputTokens * PRICE.input + u.output_tokens * PRICE.output) / 1e6);

    if (response.stop_reason === "refusal") {
      await decision.refund();
      return fail(422, "declined", "It couldn't read this brief. Matched on this phone instead.");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      await decision.refund();
      return fail(502, "error", "The read came back incomplete. Matched on this phone instead.");
    }

    await decision.charge();
    const payload: ReadResponse = { result: response.parsed_output as ReadResult, model: READ_MODEL, remaining: decision.remaining };
    return Response.json(payload);
  } catch (error) {
    await decision.refund();
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return fail(503, "busy", "The reader is busy right now. Matched on this phone instead — try again in a minute.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return fail(504, "busy", "Couldn't reach the reader. Matched on this phone instead.");
    }
    console.error("read failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return fail(502, "error", "The read didn't work this time. Matched on this phone instead.");
  }
}
