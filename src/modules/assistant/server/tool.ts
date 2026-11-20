import type { z } from "zod";
import type { Permission } from "@/config/permissions";

/**
 * Asks the person behind the AI app a yes-or-no question in the app's own pop-up, which the model cannot answer.
 * "no-popup" when the app cannot show one.
 */
export type AskPerson = (question: string) => Promise<"yes" | "no" | "no-popup">;

/**
 * One thing an AI may do, shared by the MCP servers (and later our own assistant). A tool never takes a `businessId`:
 * the business always comes from the caller's key or session, so the AI has exactly the rights of the person behind
 * it.
 */
export interface AiTool<Input extends z.ZodObject = z.ZodObject, Context = unknown> {
  name: string;
  description: string;
  input: Input;
  /** A member without this permission is not even offered the tool. */
  requires?: Permission;
  /** Changes data: AI apps are told so, and a read-only key never sees it. */
  mutates: boolean;
  // Method syntax on purpose: tools with narrower inputs or contexts can live in one list.
  run(input: z.infer<Input>, context: Context, ask?: AskPerson): Promise<unknown>;
}

export function defineTool<Input extends z.ZodObject, Context>(tool: AiTool<Input, Context>) {
  return tool;
}
