type ReporterEventName =
  | "artifacts_written"
  | "browser_started"
  | "capture_completed"
  | "capture_started"
  | "command_completed"
  | "command_failed"
  | "command_started"
  | "render_completed"
  | "render_started"
  | "service_started";

export type ReporterEvent = {
  event: ReporterEventName;
  [key: string]: unknown;
};

export type Reporter = {
  emit: (event: ReporterEvent) => void;
  log: (message: string) => void;
};

export function createHumanReporter(): Reporter {
  return {
    emit: () => {},
    log: (message) => {
      console.log(message);
    },
  };
}

export function createJsonReporter(): Reporter {
  return {
    emit: (event) => {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    },
    log: () => {},
  };
}
