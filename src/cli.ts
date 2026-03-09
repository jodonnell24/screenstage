import { initProject } from "./init.js";
import { classifyCliError, EXIT_CODES, ScreenstageError } from "./errors.js";
import { recordMotion } from "./record.js";
import { createHumanReporter, createJsonReporter } from "./reporter.js";
import { runMotion } from "./run.js";

function printHelp(): void {
  console.log(`screenstage

Usage:
  screenstage init [directory] [--yes]
  screenstage record <config-path> [--json] [--output-dir <path>] [--headless|--visible]
  screenstage run <config-path> [--json] [--output-dir <path>] [--headless|--visible]

Commands:
  init   Run the guided config wizard or scaffold a starter project in non-interactive shells.
  record Capture a manual browser session and generate an editable demo file.
  run    Record a demo session and generate an FFmpeg follow-cam render.

Options:
  --json                Emit newline-delimited JSON events for machine consumption.
  --output-dir <path>   Override the configured output directory for this command.
  --headless            Force headless browser mode for this command.
  --visible             Force visible browser mode for this command.
  --yes                 Skip prompts for init and scaffold non-interactively.
`);
}

type ParsedCliArgs = {
  command?: string;
  headless?: boolean;
  json: boolean;
  nonInteractive: boolean;
  outputDir?: string;
  value?: string;
};

function parseArgs(argv: string[]): ParsedCliArgs {
  const args = [...argv];
  const command = args.shift();
  let value: string | undefined;
  let outputDir: string | undefined;
  let json = false;
  let headless: boolean | undefined;
  let nonInteractive = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--yes" || arg === "--non-interactive") {
      nonInteractive = true;
      continue;
    }

    if (arg === "--headless") {
      headless = true;
      continue;
    }

    if (arg === "--visible") {
      headless = false;
      continue;
    }

    if (arg === "--output-dir") {
      const next = args[index + 1];

      if (!next || next.startsWith("-")) {
        throw new ScreenstageError(
          "INVALID_ARGUMENTS",
          "Usage: --output-dir <path>",
        );
      }

      outputDir = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new ScreenstageError(
        "INVALID_ARGUMENTS",
        `Unsupported option '${arg}'.`,
      );
    }

    if (!value) {
      value = arg;
      continue;
    }

    throw new ScreenstageError(
      "INVALID_ARGUMENTS",
      `Unexpected positional argument '${arg}'.`,
    );
  }

  return {
    command,
    headless,
    json,
    nonInteractive,
    outputDir,
    value,
  };
}

async function main(): Promise<void> {
  const parsedArgs = parseArgs(process.argv.slice(2));
  const reporter = parsedArgs.json ? createJsonReporter() : createHumanReporter();

  try {
    const { command, headless, json, nonInteractive, outputDir, value } = parsedArgs;

    if (!command || command === "--help" || command === "-h") {
      printHelp();
      return;
    }

    if (command === "init") {
      if (json || outputDir || headless !== undefined) {
        throw new ScreenstageError(
          "INVALID_ARGUMENTS",
          "`init` only supports [directory] and `--yes`.",
        );
      }

      await initProject(value, { nonInteractive });
      console.log("Init complete.");
      return;
    }

    if (command === "run") {
      if (!value) {
        throw new ScreenstageError(
          "INVALID_ARGUMENTS",
          "Usage: screenstage run <config-path> [--json]",
        );
      }

      await runMotion(value, {
        configOverrides: {
          headless,
          outputDir,
        },
        reporter,
      });
      return;
    }

    if (command === "record") {
      if (!value) {
        throw new ScreenstageError(
          "INVALID_ARGUMENTS",
          "Usage: screenstage record <config-path> [--json]",
        );
      }

      await recordMotion(value, {
        configOverrides: {
          headless,
          outputDir,
        },
        reporter,
      });
      return;
    }

    throw new ScreenstageError(
      "INVALID_ARGUMENTS",
      `Unknown command '${command}'.`,
    );
  } catch (error) {
    const failure = classifyCliError(error);

    if (
      parsedArgs.json &&
      (parsedArgs.command === "run" || parsedArgs.command === "record")
    ) {
      reporter.emit({
        code: failure.code,
        command: parsedArgs.command,
        details: failure.details,
        event: "command_failed",
        exitCode: failure.exitCode,
        message: failure.message,
      });
    } else {
      process.stderr.write(`${failure.message}\n`);
    }

    process.exitCode = failure.exitCode ?? EXIT_CODES.unknown;
  }
}

main();
