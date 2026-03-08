import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import type { CaptureRegion, LoadedMotionConfig, Size } from "./types.js";

type StudioSession = {
  captureRegion: CaptureRegion;
  viewport: Size;
  wrapperUrl: string;
  stop: () => Promise<void>;
};

type StudioLayout = {
  captureRegion: CaptureRegion;
  viewport: Size;
};

function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function buildStudioLayout(config: LoadedMotionConfig): StudioLayout {
  const padding = config.browser.studio.padding;
  const controlsWidth = config.browser.studio.controlsWidth;
  const stageLabelHeight = 34;
  const stageX = padding;
  const stageY = padding + stageLabelHeight;
  const viewport = {
    height: Math.max(stageY + config.viewport.height + padding, 780),
    width: stageX + config.viewport.width + padding + controlsWidth + padding,
  };

  return {
    captureRegion: {
      height: config.viewport.height,
      width: config.viewport.width,
      x: stageX,
      y: stageY,
    },
    viewport,
  };
}

function buildStudioWrapperHtml(
  config: LoadedMotionConfig,
  proxiedPath: string,
  layout: StudioLayout,
): string {
  const stageWidth = layout.captureRegion.width;
  const stageHeight = layout.captureRegion.height;
  const stageY = layout.captureRegion.y;
  const stageX = layout.captureRegion.x;
  const panelWidth = config.browser.studio.controlsWidth;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Motion Studio</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Instrument Sans", "Avenir Next", system-ui, sans-serif;
        color: #f4fbff;
        background:
          radial-gradient(circle at 14% 12%, rgba(122, 226, 186, 0.12), transparent 22%),
          radial-gradient(circle at 84% 16%, rgba(116, 167, 255, 0.12), transparent 18%),
          linear-gradient(160deg, #08111a 0%, #0f1b28 48%, #0b1420 100%);
      }

      * {
        box-sizing: border-box;
      }

      .studio {
        display: grid;
        grid-template-columns: ${stageWidth}px ${panelWidth}px;
        gap: 28px;
        padding: ${config.browser.studio.padding}px;
        align-items: start;
      }

      .stage-column {
        display: grid;
        gap: 12px;
      }

      .stage-label {
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .stage-shell {
        position: relative;
        width: ${stageWidth}px;
        height: ${stageHeight}px;
        border-radius: 24px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
      }

      .stage-shell iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: white;
      }

      .panel {
        display: grid;
        gap: 14px;
        padding: 18px;
        border-radius: 28px;
        background: rgba(10, 19, 31, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.24);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(122, 226, 186, 0.12);
        color: #7ae2ba;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .panel h1 {
        margin: 0;
        font-size: 28px;
        line-height: 0.94;
        letter-spacing: -0.06em;
      }

      .panel p {
        margin: 0;
        color: rgba(255, 255, 255, 0.72);
        line-height: 1.55;
      }

      .status {
        display: grid;
        gap: 4px;
        padding: 12px 14px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .status span {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
      }

      .status strong {
        font-size: 16px;
      }

      .button-grid {
        display: grid;
        gap: 10px;
      }

      button {
        border: 0;
        border-radius: 18px;
        padding: 13px 14px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease;
      }

      button:hover {
        transform: translateY(-1px);
      }

      button:active {
        transform: translateY(1px) scale(0.99);
      }

      button[data-marker] {
        display: grid;
        gap: 4px;
        text-align: left;
        color: white;
        background: rgba(255, 255, 255, 0.06);
      }

      button[data-marker] span {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.48);
      }

      button[data-marker="wide"] {
        background: linear-gradient(135deg, rgba(113, 182, 255, 0.18), rgba(74, 102, 185, 0.14));
      }

      button[data-marker="follow"] {
        background: linear-gradient(135deg, rgba(122, 226, 186, 0.24), rgba(54, 119, 99, 0.18));
      }

      button[data-marker="hold"] {
        background: linear-gradient(135deg, rgba(255, 214, 132, 0.16), rgba(186, 122, 68, 0.12));
      }

      .actions {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      button[data-action="focus-stage"] {
        background: rgba(255, 255, 255, 0.08);
        color: white;
      }

      button[data-action="cancel"] {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.8);
      }

      button[data-action="finish"] {
        background: linear-gradient(135deg, #7ae2ba, #4aa382);
        color: #082118;
      }

      .hint {
        font-size: 12px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.62);
      }

      .hint code {
        font-family: ui-monospace, "SFMono-Regular", monospace;
        color: #d7fff0;
      }
    </style>
  </head>
  <body>
    <main class="studio">
      <section class="stage-column">
        <div class="stage-label">
          <span>Live app stage</span>
          <span>${config.viewport.width}x${config.viewport.height}</span>
        </div>
        <div class="stage-shell">
          <iframe id="__motion_stage" name="motion-stage" src="${proxiedPath}" allow="clipboard-read; clipboard-write"></iframe>
        </div>
      </section>

      <aside class="panel">
        <div class="eyebrow">Studio Mode</div>
        <h1>Drive the local app without putting controls in the shot.</h1>
        <p>The iframe is the only captured region. These controls stay outside the exported video.</p>
        <div class="status">
          <span>Last cue</span>
          <strong id="__motion_last_cue">Wide</strong>
        </div>
        <div class="button-grid">
          <button type="button" data-marker="wide"><span>Alt+Shift+1</span><strong>Wide</strong></button>
          <button type="button" data-marker="follow"><span>Alt+Shift+2</span><strong>Punch In</strong></button>
          <button type="button" data-marker="hold"><span>Alt+Shift+3</span><strong>Hold</strong></button>
        </div>
        <div class="actions">
          <button type="button" data-action="focus-stage">Focus App</button>
          <button type="button" data-action="cancel">Cancel</button>
          <button type="button" data-action="finish">Finish</button>
        </div>
        <div class="hint"><code>Alt+Shift+0</code> focuses this control panel. <code>Alt+Shift+R</code> still finishes from inside the app.</div>
      </aside>
    </main>

    <script>
      const frame = document.getElementById("__motion_stage");
      const cue = document.getElementById("__motion_last_cue");
      const invoke = (action) => {
        const appWindow = frame.contentWindow;

        if (!appWindow) {
          return;
        }

        appWindow.postMessage(
          {
            type: "motion-recorder-command",
            action,
          },
          "*",
        );
      };

      window.__motionStudioSendCommand = invoke;

      window.__motionStudioFocusControls = () => {
        const target = document.querySelector('[data-marker="wide"]');

        if (target instanceof HTMLElement) {
          target.focus();
        }
      };

      window.__motionStudioSetLastCue = (label) => {
        cue.textContent = label;
      };

      window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "motion-recorder-status") {
          cue.textContent = event.data.label;
        }
      });

      document.querySelectorAll("[data-marker]").forEach((button) => {
        button.addEventListener("click", () => invoke(button.getAttribute("data-marker")));
      });

      document.querySelector('[data-action="cancel"]').addEventListener("click", () => invoke("cancel"));
      document.querySelector('[data-action="finish"]').addEventListener("click", () => invoke("finish"));
      document.querySelector('[data-action="focus-stage"]').addEventListener("click", () => frame.focus());
    </script>
  </body>
</html>`;
}

function getInitialProxyPath(targetUrl: URL): string {
  if (targetUrl.protocol === "file:") {
    return `/${path.basename(targetUrl.pathname)}`;
  }

  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function createFileResponder(targetUrl: URL) {
  const rootDir = path.dirname(decodeURIComponent(targetUrl.pathname));

  return async (requestPath: string): Promise<Response> => {
    const normalizedPath = path.normalize(
      path.join(rootDir, decodeURIComponent(requestPath.replace(/^\/+/, ""))),
    );

    if (!normalizedPath.startsWith(rootDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const content = await fs.readFile(normalizedPath);
      return new Response(content, {
        status: 200,
        headers: {
          "content-type": getContentType(normalizedPath),
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  };
}

function resolveProxiedPath(requestUrl: URL): string | undefined {
  if (requestUrl.pathname === "/__motion/studio") {
    return undefined;
  }

  if (requestUrl.pathname.startsWith("/__motion/proxy")) {
    return requestUrl.pathname.replace(/^\/__motion\/proxy/, "") || "/";
  }

  return `${requestUrl.pathname}${requestUrl.search}`;
}

function createProxyResponder(targetUrl: URL) {
  const targetOrigin = `${targetUrl.protocol}//${targetUrl.host}`;

  return async (requestPath: string, request: http.IncomingMessage): Promise<Response> => {
    const upstreamUrl = new URL(requestPath, targetOrigin);
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : Buffer.concat(await readRequestBody(request));
    const headers = new Headers();

    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      } else if (typeof value === "string") {
        headers.set(key, value);
      }
    }

    headers.set("host", targetUrl.host);

    return fetch(upstreamUrl, {
      body,
      headers,
      method: request.method,
      redirect: "manual",
      ...(body ? ({ duplex: "half" } as { duplex: "half" }) : {}),
    } as RequestInit);
  };
}

async function readRequestBody(
  request: http.IncomingMessage,
): Promise<Buffer[]> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks;
}

function copyResponseHeaders(response: Response, serverResponse: http.ServerResponse): void {
  response.headers.forEach((value, key) => {
    if (
      key === "content-length" ||
      key === "content-security-policy" ||
      key === "x-frame-options" ||
      key === "frame-options"
    ) {
      return;
    }

    serverResponse.setHeader(key, value);
  });
}

export async function startStudioSession(
  config: LoadedMotionConfig,
): Promise<StudioSession | undefined> {
  if (!config.browser.studio.enabled) {
    return undefined;
  }

  const targetUrl = new URL(config.url);
  const layout = buildStudioLayout(config);
  const initialProxyPath = getInitialProxyPath(targetUrl);
  const fileResponder =
    targetUrl.protocol === "file:" ? createFileResponder(targetUrl) : undefined;
  const proxyResponder =
    targetUrl.protocol === "file:" ? undefined : createProxyResponder(targetUrl);

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname === "/__motion/studio") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(buildStudioWrapperHtml(config, `/__motion/proxy${initialProxyPath}`, layout));
      return;
    }

    const proxiedPath = resolveProxiedPath(requestUrl);

    if (!proxiedPath) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    try {
      const proxiedResponse = fileResponder
        ? await fileResponder(proxiedPath)
        : await proxyResponder!(proxiedPath, request);
      response.statusCode = proxiedResponse.status;
      copyResponseHeaders(proxiedResponse, response);
      const body = Buffer.from(await proxiedResponse.arrayBuffer());
      response.end(body);
    } catch (error) {
      response.statusCode = 502;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end(
        error instanceof Error ? error.message : "Unable to load studio target.",
      );
    }
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Unable to determine studio server port."));
        return;
      }

      resolve(address.port);
    });
  });

  return {
    captureRegion: layout.captureRegion,
    viewport: layout.viewport,
    wrapperUrl: `http://127.0.0.1:${port}/__motion/studio`,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}
