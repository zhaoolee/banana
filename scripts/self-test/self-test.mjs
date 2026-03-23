import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const fixturePath = path.join(__dirname, "fixtures", "professional-scene.sample.json");
const SERVER_START_TIMEOUT_MS = 30_000;
const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yF9sAAAAASUVORK5CYII=";

function log(message) {
  console.log(`[self-test] ${message}`);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getMockModelsPayload() {
  return {
    models: [
      {
        id: "nano-banana-2",
        name: "Nano Banana 2",
        priceLabel: "1 credit",
        description: "Playwright mock model",
        supportedAspectRatios: ["1:1", "3:4", "4:5"],
        supportedImageSizes: ["1K", "2K"],
        supportsImageSizeParam: true,
      },
    ],
  };
}

function fulfillJson(route, data, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate a port for the preview server"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Command failed: ${command} ${args.join(" ")} (code: ${code ?? "null"}, signal: ${signal ?? "none"})`,
        ),
      );
    });
  });
}

function startAppServer(port) {
  let output = "";
  const child = spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const handleChunk = (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(`[app-server] ${text}`);
  };

  child.stdout.on("data", handleChunk);
  child.stderr.on("data", handleChunk);

  return {
    child,
    getOutput() {
      return output;
    },
  };
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  const startedAt = Date.now();

  while (child.exitCode === null && Date.now() - startedAt < 5_000) {
    await delay(100);
  }

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function waitForServer(url, child, getOutput) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`App server exited early.\n${getOutput()}`);
    }

    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Retry until timeout.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for app server at ${url}.\n${getOutput()}`);
}

async function installMockApi(page) {
  await page.route("**/api/access/session", async (route) => {
    await fulfillJson(route, {
      pw: {
        value: "banana",
        remainingCredits: 99,
      },
    });
  });

  await page.route("**/api/models", async (route) => {
    await fulfillJson(route, getMockModelsPayload());
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    await fulfillJson(
      route,
      {
        error: `Unexpected mocked API request: ${request.method()} ${pathname}`,
      },
      501,
    );
  });
}

async function withMockedPage(browser, baseURL, run) {
  const context = await browser.newContext({
    baseURL,
    acceptDownloads: true,
    viewport: {
      width: 1440,
      height: 1100,
    },
  });
  const page = await context.newPage();
  await installMockApi(page);

  try {
    await run(page);
  } finally {
    await context.close();
  }
}

async function runCase(name, fn) {
  const startedAt = Date.now();
  log(`CASE START ${name}`);
  await fn();
  log(`CASE PASS ${name} (${Date.now() - startedAt}ms)`);
}

async function dispatchImagePaste(page, name) {
  await page.evaluate(
    ({ base64, fileName }) => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const file = new File([bytes], fileName, {
        type: "image/png",
      });
      const clipboardData = new DataTransfer();
      clipboardData.items.add(file);

      const pasteEvent = new Event("paste", {
        bubbles: true,
        cancelable: true,
      });

      Object.defineProperty(pasteEvent, "clipboardData", {
        value: clipboardData,
      });

      window.dispatchEvent(pasteEvent);
    },
    {
      base64: TEST_IMAGE_BASE64,
      fileName: name,
    },
  );
}

async function runRootRedirectSmoke(browser, baseURL) {
  await runCase("root redirect to login", async () => {
    await withMockedPage(browser, baseURL, async (page) => {
      await page.goto("/", {
        waitUntil: "domcontentloaded",
      });
      await page.getByLabel("提取码").waitFor();
      await page.waitForFunction(() => window.location.pathname === "/login");
      assert.match(page.url(), /\/login$/);
    });
  });
}

async function runProfessionalSceneTransferSmoke(browser, baseURL) {
  await runCase("professional scene import and export", async () => {
    await withMockedPage(browser, baseURL, async (page) => {
      await page.goto("/login?e2e=1", {
        waitUntil: "domcontentloaded",
      });

      try {
        await page.getByRole("heading", { name: "专业模式导出预览" }).waitFor();
      } catch (error) {
        console.error(`[self-test] studio page url: ${page.url()}`);
        console.error(`[self-test] studio page body:\n${await page.locator("body").innerText()}`);
        throw error;
      }
      await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles(fixturePath);

      await page.waitForFunction(() => {
        const textarea = document.querySelector("#professionalGlobalPrompt");
        return textarea && textarea.value === "E2E 全局提示词";
      });

      assert.equal(await page.locator("#professionalGlobalPrompt").inputValue(), "E2E 全局提示词");
      assert.equal(await page.locator("#canvasSizeSelector").inputValue(), "custom-scene-e2e");
      await page.getByRole("button", { name: /表格样式设置/ }).click();
      assert.equal(await page.locator("#layoutRows").inputValue(), "2");
      assert.equal(await page.locator("#layoutColumns").inputValue(), "2");
      const storyboardCells = page.locator(".storyboard-cell");
      assert.equal(await storyboardCells.count(), 4);

      await page.locator('.storyboard-cell[aria-label^="第 1 格"]').click();
      await page.getByRole("dialog", { name: "第 1 格 输入面板" }).waitFor();
      assert.equal(await page.locator("#storyboardCellPrompt").inputValue(), "第一格提示词");
      assert.equal(await page.locator("#storyboardCellCaption").inputValue(), "第一格配文");
      await page.locator(".storyboard-editor-preview-button img").waitFor();
      await page.getByRole("button", { name: "关闭输入面板" }).click();

      await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
      await page.getByRole("dialog", { name: "第 2 格 输入面板" }).waitFor();
      await dispatchImagePaste(page, "clipboard-reference.png");
      await page.getByText("clipboard-reference.png").waitFor();
      await page.getByRole("button", { name: "关闭输入面板" }).click();

      await dispatchImagePaste(page, "clipboard-reference-closed.png");
      await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
      await page.getByRole("dialog", { name: "第 2 格 输入面板" }).waitFor();
      assert.equal(await page.getByText("clipboard-reference.png").count(), 1);
      assert.equal(await page.getByText("clipboard-reference-closed.png").count(), 0);
      await page.getByRole("button", { name: "关闭输入面板" }).click();

      await page.getByRole("button", { name: "清空第 2 格内容" }).click();
      await page.getByRole("dialog", { name: "确认清空第 2 格" }).waitFor();
      await page.getByRole("button", { name: "取消" }).click();
      await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
      await page.getByRole("dialog", { name: "第 2 格 输入面板" }).waitFor();
      assert.equal(await page.getByText("clipboard-reference.png").count(), 1);
      await page.getByRole("button", { name: "关闭输入面板" }).click();

      await page.getByRole("button", { name: "清空第 2 格内容" }).click();
      await page.getByRole("dialog", { name: "确认清空第 2 格" }).waitFor();
      await page.getByRole("button", { name: "确认清空" }).click();
      await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
      await page.getByRole("dialog", { name: "第 2 格 输入面板" }).waitFor();
      assert.equal(await page.locator("#storyboardCellPrompt").inputValue(), "");
      assert.equal(await page.locator("#storyboardCellCaption").inputValue(), "");
      assert.equal(await page.getByText("clipboard-reference.png").count(), 0);
      assert.equal(await page.getByRole("button", { name: "清空当前格子" }).isDisabled(), true);
      await page.getByRole("button", { name: "关闭输入面板" }).click();

      await page.locator('.storyboard-cell[aria-label^="第 3 格"]').click();
      await page.getByRole("dialog", { name: "第 3 格 输入面板" }).waitFor();
      await page.getByRole("tab", { name: "选择图片" }).click();
      await dispatchImagePaste(page, "clipboard-asset.png");
      await page.locator(".storyboard-editor-selected-asset-card").waitFor();
      assert.equal(await page.getByText("clipboard-asset.png").count(), 1);
      await page.locator(".storyboard-editor-preview-button img").waitFor();
      await page.getByRole("button", { name: "关闭输入面板" }).click();

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出" }).click();
      const download = await downloadPromise;
      const downloadFailure = await download.failure();

      assert.equal(downloadFailure, null);
      assert.match(download.suggestedFilename(), /professional-scene\.json$/);

      const downloadPath = await download.path();

      assert.ok(downloadPath, "Expected Playwright to persist the exported scene package");

      const exportedText = await readFile(downloadPath, "utf8");
      const exportedScene = JSON.parse(exportedText);

      assert.equal(exportedScene.kind, "banana.professional.scene");
      assert.equal(exportedScene.state.globalPrompt, "E2E 全局提示词");
      assert.equal(exportedScene.state.canvasSize, "custom-scene-e2e");
      assert.equal(exportedScene.state.layoutRows, 2);
      assert.equal(exportedScene.state.layoutColumns, 2);
      assert.equal(
        exportedScene.state.storyboardCells["storyboard-cell-1-1"].prompt,
        "第一格提示词",
      );
      assert.equal(
        exportedScene.state.storyboardCells["storyboard-cell-1-1"].caption,
        "第一格配文",
      );
      assert.equal(
        exportedScene.state.storyboardCells["storyboard-cell-1-2"].referenceImages.length,
        0,
      );
      assert.ok(
        exportedScene.state.storyboardCells["storyboard-cell-1-1"].record.imageBase64.length > 20,
      );
      assert.equal(exportedScene.state.referenceImages.length, 1);
    });
  });
}

async function main() {
  const downloadDir = await mkdtemp(path.join(os.tmpdir(), "banana-self-test-"));
  let appServer = null;
  let browser = null;

  try {
    log("Building production assets");
    await runCommand("npm", ["run", "build"]);

    const port = await findFreePort();
    const baseURL = `http://127.0.0.1:${port}`;

    log(`Starting app server on ${baseURL}`);
    appServer = startAppServer(port);
    await waitForServer(baseURL, appServer.child, appServer.getOutput);

    log("Launching Playwright Chromium");
    browser = await chromium.launch({
      headless: true,
      downloadsPath: downloadDir,
    });

    await runRootRedirectSmoke(browser, baseURL);
    await runProfessionalSceneTransferSmoke(browser, baseURL);

    log("All self-tests passed");
  } catch (error) {
    if (
      error instanceof Error &&
      /Executable doesn't exist|browserType\.launch/i.test(error.message)
    ) {
      console.error(
        "[self-test] Playwright Chromium is not installed. Run `npm run self-test:install` first.",
      );
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }

    if (appServer) {
      await stopProcess(appServer.child);
    }

    await rm(downloadDir, {
      recursive: true,
      force: true,
    });
  }
}

main().catch((error) => {
  console.error("[self-test] FAILED");
  console.error(error);
  process.exitCode = 1;
});
