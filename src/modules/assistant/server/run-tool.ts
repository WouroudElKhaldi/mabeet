import { ZodError } from "zod";
import { AppError } from "@/server/errors";
import { formatMoney } from "@/utils/format";
import type { AiTool } from "./tool";

export type ToolOutcome = { ok: true; result: unknown } | { ok: false; error: string };

/** Told about every finished tool call, for the audit log. Synchronous on purpose: it must not delay the answer. */
export type ToolCallListener = (tool: string, outcome: ToolOutcome, latencyMs: number) => void;

/** Runs a tool by name for one caller. */
export type ToolRunner = (name: string, rawInput: unknown) => Promise<ToolOutcome>;

const CENTS_KEY = /Cents$/;

/**
 * Money as the model must repeat it: every `somethingCents` number next to (or under) a `currency` becomes
 * `something: "$140"`, already formatted. The model copies amounts and never converts cents itself.
 */
function presentMoney(value: unknown, currency: string | null): unknown {
  if (Array.isArray(value)) return value.map((item) => presentMoney(item, currency));
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  const record = value as Record<string, unknown>;
  const own = typeof record.currency === "string" ? record.currency : currency;
  return Object.fromEntries(
    Object.entries(record).map(([key, field]) =>
      CENTS_KEY.test(key) && own && (typeof field === "number" || field === null)
        ? [key.replace(CENTS_KEY, ""), field === null ? null : formatMoney(field, own, "en")]
        : [key, presentMoney(field, own)],
    ),
  );
}

/** What the model is shown for an outcome: the result with money formatted, or only the safe error message. */
export const toolPayload = (outcome: ToolOutcome) =>
  outcome.ok ? presentMoney(outcome.result, null) : { error: outcome.error };

/** Checks the input, runs the tool, and turns a failure into a message that is safe to hand to a model. */
async function runTool(tool: AiTool, rawInput: unknown, context: unknown): Promise<ToolOutcome> {
  try {
    const input = tool.input.parse(rawInput ?? {});
    return { ok: true, result: await tool.run(input, context) };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: `Invalid arguments: ${error.issues.map((issue) => issue.message).join("; ")}`,
      };
    }
    console.error(error);
    return { ok: false, error: "The tool failed. Try again or ask the user." };
  }
}

/** Binds a list of tools to one caller's context. An unknown name is a tool error, never a crash. */
export function createToolRunner(
  tools: readonly AiTool[],
  context: unknown,
  onCall?: ToolCallListener,
): ToolRunner {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return async (name, rawInput) => {
    const tool = byName.get(name);
    const started = Date.now();
    const outcome: ToolOutcome = tool
      ? await runTool(tool, rawInput, context)
      : { ok: false, error: `Unknown tool ${name}` };
    onCall?.(name, outcome, Date.now() - started);
    return outcome;
  };
}
