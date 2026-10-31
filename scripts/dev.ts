/**
 * `pnpm dev`: the website and the job worker together, as in production, with each line marked [web] or
 * [worker]. Ctrl+C stops both; if one of them exits, the other is stopped too. Queue mode unless .env says
 * otherwise. `pnpm dev:web` starts the website alone (JOBS_MODE="inline" then, or nothing answers the queue).
 */
import { type ChildProcess, spawn } from "node:child_process";

const WINDOWS = process.platform === "win32";
const env = { ...process.env, JOBS_MODE: process.env.JOBS_MODE ?? "queue", FORCE_COLOR: "1" };

const processes: Array<{ name: string; child: ChildProcess }> = [
  { name: "web", args: ["exec", "next", "dev", "--turbopack"] },
  { name: "worker", args: ["exec", "tsx", "src/server/jobs/worker.ts"] },
].map(({ name, args }) => ({
  name,
  // Windows needs the shell to find pnpm.cmd, given one command line (the arguments are fixed here). Elsewhere
  // each child leads its own process group, so stopping it reaches everything it started.
  child: WINDOWS
    ? spawn(`pnpm ${args.join(" ")}`, { env, shell: true, stdio: ["inherit", "pipe", "pipe"] })
    : spawn("pnpm", args, { env, detached: true, stdio: ["inherit", "pipe", "pipe"] }),
}));

const running = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;

/** Stops a child and everything it started: killing only the shell would leave Next or the worker running. */
function stop(child: ChildProcess) {
  if (child.pid === undefined || !running(child)) return;
  if (WINDOWS) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(-child.pid, "SIGTERM");
}

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const { child } of processes) stop(child);
  // The worker finishes the jobs in hand first (up to 60 s); after that, leave anyway.
  setTimeout(() => process.exit(0), 65_000).unref();
}

for (const { name, child } of processes) {
  const label = `[${name}]`;
  for (const stream of [child.stdout, child.stderr]) {
    let partial = "";
    stream?.on("data", (bytes: Buffer) => {
      const lines = (partial + bytes.toString()).split("\n");
      partial = lines.pop() ?? "";
      // The worker labels its own lines already.
      for (const line of lines)
        process.stdout.write(line.startsWith(label) ? `${line}\n` : `${label.padEnd(9)}${line}\n`);
    });
  }
  child.on("exit", (code) => {
    console.warn(`${label.padEnd(9)}stopped (exit ${code ?? 0})`);
    stopAll();
    if (processes.every((entry) => !running(entry.child))) process.exit(code ?? 0);
  });
}

console.warn(`[dev]    website and worker, JOBS_MODE=${env.JOBS_MODE}`);
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
