import type { BrowserContext, Page } from "playwright";

import { loadSetupModule } from "./config.js";
import type { EvaluatedPageTarget, LoadedMotionConfig, SetupContext } from "./types.js";

function canUseUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function resolveCaptureUrl(config: LoadedMotionConfig): string {
  const setup = config.setup;

  if (!setup) {
    return config.url;
  }

  if (!canUseUrl(config.url)) {
    return config.url;
  }

  const resolved = new URL(config.url);

  if (setup.route) {
    if (canUseUrl(setup.route)) {
      return setup.route;
    }

    if (setup.route.startsWith("#")) {
      resolved.hash = setup.route;
    } else {
      const routed = new URL(setup.route, resolved);
      resolved.pathname = routed.pathname;
      resolved.search = routed.search;
      resolved.hash = routed.hash;
    }
  }

  for (const [key, rawValue] of Object.entries(setup.query)) {
    if (rawValue === undefined || rawValue === null) {
      resolved.searchParams.delete(key);
      continue;
    }

    resolved.searchParams.set(key, String(rawValue));
  }

  if (setup.hash) {
    resolved.hash = setup.hash.startsWith("#") ? setup.hash : `#${setup.hash}`;
  }

  return resolved.toString();
}

export async function applyContextSetup(
  config: LoadedMotionConfig,
  context: BrowserContext,
  targetUrl: string,
): Promise<void> {
  const setup = config.setup;

  if (!setup) {
    return;
  }

  if (setup.cookies.length > 0) {
    await context.addCookies(
      setup.cookies.map((cookie) => ({
        ...cookie,
        url: cookie.url ?? (cookie.domain ? undefined : targetUrl),
      })),
    );
  }

  if (
    Object.keys(setup.localStorage).length > 0 ||
    Object.keys(setup.sessionStorage).length > 0
  ) {
    const targetOrigin = canUseUrl(targetUrl) ? new URL(targetUrl).origin : undefined;

    await context.addInitScript(
      ({
        localStorageValues,
        sessionStorageValues,
        targetOriginValue,
      }: {
        localStorageValues: Record<string, string>;
        sessionStorageValues: Record<string, string>;
        targetOriginValue?: string;
      }) => {
        if (targetOriginValue && window.location.origin !== targetOriginValue) {
          return;
        }

        for (const [key, value] of Object.entries(localStorageValues)) {
          window.localStorage.setItem(key, value);
        }

        for (const [key, value] of Object.entries(sessionStorageValues)) {
          window.sessionStorage.setItem(key, value);
        }
      },
      {
        localStorageValues: setup.localStorage,
        sessionStorageValues: setup.sessionStorage,
        targetOriginValue: targetOrigin,
      },
    );
  }
}

export async function applyPageSetup(
  config: LoadedMotionConfig,
  context: BrowserContext,
  page: Page,
  target: EvaluatedPageTarget,
  sessionDir: string,
  targetUrl: string,
  options: {
    includeModule?: boolean;
  } = {},
): Promise<void> {
  const setup = config.setup;

  if (!setup) {
    return;
  }

  if (options.includeModule !== false && setup.modulePath) {
    const setupModule = await loadSetupModule(setup.modulePath);
    const setupContext: SetupContext = {
      config,
      context,
      page,
      sessionDir,
      target,
      url: targetUrl,
    };
    await setupModule.default(setupContext);
  }

  if (setup.waitFor?.selector) {
    await target.waitForSelector(setup.waitFor.selector, {
      timeout: setup.waitFor.timeoutMs,
    });
  }

  if (setup.waitFor?.text) {
    await target.waitForFunction(
      (text) => document.body?.innerText?.includes(text) ?? false,
      setup.waitFor.text,
      {
        timeout: setup.waitFor.timeoutMs,
      },
    );
  }
}

export async function applyPageEmulation(
  config: LoadedMotionConfig,
  page: Page,
): Promise<void> {
  if (config.setup?.colorScheme) {
    await page.emulateMedia({ colorScheme: config.setup.colorScheme });
  }
}
