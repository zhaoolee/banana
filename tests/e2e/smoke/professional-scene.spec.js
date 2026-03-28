import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { expect, test } from "../fixtures/test.js";
import { installApiMocks, TEST_IMAGE_BASE64 } from "../helpers/mockApi.js";
import {
  PROFESSIONAL_SCENE_FIXTURE_PATH,
  dispatchImagePaste,
  gotoStudio,
} from "../helpers/studio.js";

test("professional scene import and export @smoke", async ({ page }) => {
  await installApiMocks(page);
  await gotoStudio(page);

  await page
    .locator('input[type="file"][accept="application/json,.json"]')
    .setInputFiles(PROFESSIONAL_SCENE_FIXTURE_PATH);

  await expect(page.locator("#professionalGlobalPrompt")).toHaveValue("E2E 全局提示词");
  await expect(page.locator("#canvasSizeSelector")).toHaveValue("custom-scene-e2e");

  await page.getByRole("button", { name: /表格样式设置/ }).click();
  await expect(page.locator("#layoutRows")).toHaveValue("2");
  await expect(page.locator("#layoutColumns")).toHaveValue("2");
  await expect(page.locator(".storyboard-cell")).toHaveCount(4);

  await page.locator('.storyboard-cell[aria-label^="第 1 格"]').click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toBeVisible();
  await expect(page.locator("#storyboardCellPrompt")).toHaveValue("第一格提示词");
  await expect(page.locator("#storyboardCellCaption")).toHaveValue("第一格配文");
  await expect(page.locator(".storyboard-editor-preview-button img")).toBeVisible();
  await page.getByRole("button", { name: "下一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 2 格 输入面板" })).toBeVisible();
  await expect(page.locator("#storyboardCellPrompt")).toHaveValue("");
  await page.locator("#storyboardCellPrompt").fill("第二格草稿提示词");
  await page.getByRole("button", { name: "上一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toBeVisible();
  await expect(page.locator("#storyboardCellPrompt")).toHaveValue("第一格提示词");
  await page.getByRole("button", { name: "下一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 2 格 输入面板" })).toBeVisible();
  await expect(page.locator("#storyboardCellPrompt")).toHaveValue("第二格草稿提示词");
  await page.getByRole("button", { name: "上一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toBeVisible();
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
  await expect(page.getByRole("dialog", { name: "第 2 格 输入面板" })).toBeVisible();
  await page
    .locator('.storyboard-reference-upload input[type="file"]')
    .setInputFiles({
      name: "storyboard-upload-reference.png",
      mimeType: "image/png",
      buffer: Buffer.from(TEST_IMAGE_BASE64, "base64"),
    });
  await expect(page.getByText("storyboard-upload-reference.png")).toBeVisible();
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
  await expect(page.getByRole("dialog", { name: "第 2 格 输入面板" })).toBeVisible();
  await expect(page.getByText("storyboard-upload-reference.png")).toHaveCount(1);
  await dispatchImagePaste(page, "clipboard-reference.png");
  await expect(page.getByText("clipboard-reference.png")).toBeVisible();
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await dispatchImagePaste(page, "clipboard-reference-closed.png");
  await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
  await expect(page.getByRole("dialog", { name: "第 2 格 输入面板" })).toBeVisible();
  await expect(page.getByText("clipboard-reference.png")).toHaveCount(1);
  await expect(page.getByText("clipboard-reference-closed.png")).toHaveCount(0);
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await page.getByRole("button", { name: "清空第 2 格内容" }).click();
  await expect(page.getByRole("dialog", { name: "确认清空第 2 格" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
  await expect(page.getByText("clipboard-reference.png")).toHaveCount(1);
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await page.getByRole("button", { name: "清空第 2 格内容" }).click();
  await page.getByRole("button", { name: "确认清空" }).click();
  await page.locator('.storyboard-cell[aria-label^="第 2 格"]').click();
  await expect(page.locator("#storyboardCellPrompt")).toHaveValue("");
  await expect(page.locator("#storyboardCellCaption")).toHaveValue("");
  await expect(page.getByText("clipboard-reference.png")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清空当前格子" })).toBeDisabled();
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await page.locator('.storyboard-cell[aria-label^="第 3 格"]').click();
  await expect(page.getByRole("dialog", { name: "第 3 格 输入面板" })).toBeVisible();
  await page.getByRole("tab", { name: "选择图片" }).click();
  await dispatchImagePaste(page, "clipboard-asset.png");
  await expect(page.locator(".storyboard-editor-selected-asset-card")).toBeVisible();
  await expect(page.getByText("clipboard-asset.png")).toHaveCount(1);
  await expect(page.locator(".storyboard-editor-preview-button img")).toBeVisible();
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await page.getByRole("button", { name: "导出场景" }).click();
  await expect(page.getByRole("dialog", { name: "导出 JSON 配置" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON" }).click();
  const download = await downloadPromise;

  await expect(download.failure()).resolves.toBeNull();
  await expect(download.suggestedFilename()).toMatch(/professional-scene\.json$/);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const exportedScene = JSON.parse(await readFile(downloadPath, "utf8"));

  expect(exportedScene.kind).toBe("banana.professional.scene");
  expect(exportedScene.state.globalPrompt).toBe("E2E 全局提示词");
  expect(exportedScene.state.canvasSize).toBe("custom-scene-e2e");
  expect(exportedScene.state.layoutRows).toBe(2);
  expect(exportedScene.state.layoutColumns).toBe(2);
  expect(exportedScene.state.storyboardCells["storyboard-cell-1-1"].prompt).toBe("第一格提示词");
  expect(exportedScene.state.storyboardCells["storyboard-cell-1-1"].caption).toBe("第一格配文");
  expect(exportedScene.state.storyboardCells["storyboard-cell-1-2"].referenceImages).toHaveLength(
    0,
  );
  expect(exportedScene.state.storyboardCells["storyboard-cell-1-1"].record.imageBase64.length).toBeGreaterThan(20);
  expect(exportedScene.state.referenceImages).toHaveLength(1);
});
