import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import type { ChildProcess } from "node:child_process";

import type { LoadedMotionConfig } from "./types.js";

const execFileAsync = promisify(execFile);

type ManagedService = {
  stop: () => Promise<void>;
};

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function collectLogs(buffer: string[], chunk: Buffer | string): void {
  buffer.push(chunk.toString());

  if (buffer.length > 50) {
    buffer.shift();
  }
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
      });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Ignore transient startup failures while the local app is still booting.
    }

    await delay(400);
  }

  throw new Error(`Timed out waiting for ${url} to respond.`);
}

async function listChildPids(parentPid: number): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync("ps", [
      "-o",
      "pid=",
      "--ppid",
      String(parentPid),
    ]);

    return stdout
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

async function listDescendantPids(rootPid: number): Promise<number[]> {
  const descendants: number[] = [];
  const queue = [rootPid];

  while (queue.length > 0) {
    const currentPid = queue.shift()!;
    const children = await listChildPids(currentPid);

    for (const childPid of children) {
      descendants.push(childPid);
      queue.push(childPid);
    }
  }

  return descendants;
}

function pidExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sendSignal(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch {
    // Ignore races where the process exits between discovery and signal delivery.
  }
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  const rootPid = child.pid;
  const descendants = await listDescendantPids(rootPid);

  for (const pid of [...descendants].reverse()) {
    sendSignal(pid, "SIGTERM");
  }
  sendSignal(rootPid, "SIGTERM");

  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const aliveDescendants = descendants.filter(pidExists);
    const rootAlive = pidExists(rootPid);

    if (!rootAlive && aliveDescendants.length === 0) {
      return;
    }

    await delay(120);
  }

  for (const pid of [...descendants].reverse()) {
    if (pidExists(pid)) {
      sendSignal(pid, "SIGKILL");
    }
  }
  if (pidExists(rootPid)) {
    sendSignal(rootPid, "SIGKILL");
  }
}

export async function startManagedService(
  config: LoadedMotionConfig,
): Promise<ManagedService | undefined> {
  if (!config.serve) {
    return undefined;
  }

  const logs: string[] = [];
  const child = spawn(config.serve.command, {
    cwd: config.serve.cwd,
    env: {
      ...process.env,
      ...config.serve.env,
    },
    shell: config.serve.shell ?? true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stopped = false;

  child.stdout?.on("data", (chunk) => collectLogs(logs, chunk));
  child.stderr?.on("data", (chunk) => collectLogs(logs, chunk));

  const readyByText =
    typeof config.serve.readyText === "string" && config.serve.readyText.length > 0
      ? new Promise<void>((resolve) => {
          const readyText = config.serve!.readyText!;
          const onChunk = (chunk: Buffer | string) => {
            const text = chunk.toString();
            if (text.includes(readyText)) {
              resolve();
            }
          };

          child.stdout?.on("data", onChunk);
          child.stderr?.on("data", onChunk);
        })
      : null;

  const readinessPromise = readyByText
    ? Promise.race([waitForUrl(config.url, config.serve.timeoutMs), readyByText])
    : waitForUrl(config.url, config.serve.timeoutMs);

  const exitPromise = new Promise<never>((_, reject) => {
    child.once("exit", (code) => {
      reject(
        new Error(
          `Serve command exited before the app was ready (code ${code ?? "unknown"}).\n${logs.join("")}`,
        ),
      );
    });
    child.once("error", (error) => {
      reject(error);
    });
  });

  try {
    await Promise.race([exitPromise, readinessPromise]);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  return {
    stop: async () => {
      if (stopped) {
        return;
      }

      stopped = true;
      await stopChild(child);
    },
  };
}
