import { spawn } from "node:child_process";

import type { ChildProcess } from "node:child_process";

import type { LoadedMotionConfig } from "./types.js";

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

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null) {
      resolve();
      return;
    }

    const finalize = () => resolve();
    child.once("exit", finalize);

    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }

    setTimeout(() => {
      if (child.exitCode !== null) {
        return;
      }

      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, 2_000);
  });
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
    detached: true,
    env: {
      ...process.env,
      ...config.serve.env,
    },
    shell: config.serve.shell ?? true,
    stdio: ["ignore", "pipe", "pipe"],
  });

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

  const readyByUrl = waitForUrl(config.url, config.serve.timeoutMs);
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
    await Promise.race([
      exitPromise,
      readyByUrl,
      ...(readyByText ? [readyByText] : []),
    ]);
  } catch (error) {
    await stopChild(child);
    throw error;
  }

  return {
    stop: async () => {
      await stopChild(child);
    },
  };
}
