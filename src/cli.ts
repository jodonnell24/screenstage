import { initProject } from "./init.js";
import { runMotion } from "./run.js";

function printHelp(): void {
  console.log(`motion-creator

Usage:
  motion-creator init [directory]
  motion-creator run <config-path>

Commands:
  init   Scaffold a starter config, demo script, and sample page.
  run    Record a demo session and generate an FFmpeg follow-cam render.
`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const value = process.argv[3];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "init") {
    await initProject(value);
    console.log("Starter files created.");
    return;
  }

  if (command === "run") {
    if (!value) {
      throw new Error("Usage: motion-creator run <config-path>");
    }

    await runMotion(value);
    return;
  }

  throw new Error(`Unknown command '${command}'.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
