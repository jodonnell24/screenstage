import { initProject } from "./init.js";
import { recordMotion } from "./record.js";
import { runMotion } from "./run.js";

function printHelp(): void {
  console.log(`motion-creator

Usage:
  motion-creator init [directory]
  motion-creator record <config-path>
  motion-creator run <config-path>

Commands:
  init   Run the guided config wizard or scaffold a starter project in non-interactive shells.
  record Capture a manual browser session and generate an editable demo file.
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
    console.log("Init complete.");
    return;
  }

  if (command === "run") {
    if (!value) {
      throw new Error("Usage: motion-creator run <config-path>");
    }

    await runMotion(value);
    return;
  }

  if (command === "record") {
    if (!value) {
      throw new Error("Usage: motion-creator record <config-path>");
    }

    await recordMotion(value);
    return;
  }

  throw new Error(`Unknown command '${command}'.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
