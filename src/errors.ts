export const EXIT_CODES = {
  browserFailure: 4,
  captureFailure: 5,
  dependencyMissing: 7,
  invalidArguments: 2,
  renderFailure: 6,
  targetUnavailable: 3,
  unknown: 1,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export type ScreenstageErrorCode =
  | "BROWSER_FAILURE"
  | "CAPTURE_FAILURE"
  | "DEPENDENCY_MISSING"
  | "INVALID_ARGUMENTS"
  | "RENDER_FAILURE"
  | "TARGET_UNAVAILABLE";

const EXIT_CODE_BY_ERROR: Record<ScreenstageErrorCode, ExitCode> = {
  BROWSER_FAILURE: EXIT_CODES.browserFailure,
  CAPTURE_FAILURE: EXIT_CODES.captureFailure,
  DEPENDENCY_MISSING: EXIT_CODES.dependencyMissing,
  INVALID_ARGUMENTS: EXIT_CODES.invalidArguments,
  RENDER_FAILURE: EXIT_CODES.renderFailure,
  TARGET_UNAVAILABLE: EXIT_CODES.targetUnavailable,
};

export class ScreenstageError extends Error {
  readonly code: ScreenstageErrorCode;

  readonly exitCode: ExitCode;

  readonly details?: Record<string, unknown>;

  constructor(
    code: ScreenstageErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ScreenstageError";
    this.code = code;
    this.exitCode = EXIT_CODE_BY_ERROR[code];
    this.details = details;
  }
}

export function classifyCliError(error: unknown): {
  code?: ScreenstageErrorCode;
  details?: Record<string, unknown>;
  exitCode: ExitCode;
  message: string;
} {
  if (error instanceof ScreenstageError) {
    return {
      code: error.code,
      details: error.details,
      exitCode: error.exitCode,
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  if (
    message.startsWith("Usage:") ||
    message.startsWith("Unknown command") ||
    message.startsWith("Unsupported option") ||
    message.includes("Config module") ||
    message.includes("config")
  ) {
    return {
      code: "INVALID_ARGUMENTS",
      exitCode: EXIT_CODES.invalidArguments,
      message,
    };
  }

  if (
    message.includes("Timed out waiting for") ||
    message.includes("app was ready")
  ) {
    return {
      code: "TARGET_UNAVAILABLE",
      exitCode: EXIT_CODES.targetUnavailable,
      message,
    };
  }

  if (
    message.includes("ffmpeg") &&
    (message.includes("not found") || message.includes("PATH"))
  ) {
    return {
      code: "DEPENDENCY_MISSING",
      exitCode: EXIT_CODES.dependencyMissing,
      message,
    };
  }

  if (
    message.includes("Playwright did not produce a source video") ||
    message.includes("did not complete")
  ) {
    return {
      code: "CAPTURE_FAILURE",
      exitCode: EXIT_CODES.captureFailure,
      message,
    };
  }

  if (
    message.includes("browserType.launch") ||
    message.includes("Executable doesn't exist") ||
    message.includes("Failed to launch") ||
    message.includes("Target page, context or browser has been closed")
  ) {
    return {
      code: "BROWSER_FAILURE",
      exitCode: EXIT_CODES.browserFailure,
      message,
    };
  }

  if (message.includes("Command failed: ffmpeg")) {
    return {
      code: "RENDER_FAILURE",
      exitCode: EXIT_CODES.renderFailure,
      message,
    };
  }

  return {
    exitCode: EXIT_CODES.unknown,
    message,
  };
}
