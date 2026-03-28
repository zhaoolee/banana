import { expect, test } from "../fixtures/test.js";
import { installApiMocks, TEST_IMAGE_BASE64 } from "../helpers/mockApi.js";
import { PROFESSIONAL_SCENE_FIXTURE_PATH, gotoStudio } from "../helpers/studio.js";

const CUT_SHORTCUT = process.platform === "darwin" ? "Meta+X" : "Control+X";

test("storyboard editor stays editable and navigable during generation @smoke", async ({
  page,
}) => {
  await page.setViewportSize({
    width: 820,
    height: 900,
  });

  await installApiMocks(page, {
    customHandler: async ({ route, request, pathname }) => {
      if (request.method() === "POST" && pathname === "/api/generate/professional/stream") {
        await new Promise((resolve) => {
          setTimeout(resolve, 2500);
        });
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: [
            'event: status\ndata: {"message":"banana 正在生图..."}\n',
            `event: result\ndata: ${JSON.stringify({
              imageBase64: TEST_IMAGE_BASE64,
              mimeType: "image/png",
            })}\n`,
            "",
          ].join("\n"),
        });
        return true;
      }

      return false;
    },
  });

  await gotoStudio(page);
  await page
    .locator('input[type="file"][accept="application/json,.json"]')
    .setInputFiles(PROFESSIONAL_SCENE_FIXTURE_PATH);

  await page.locator('.storyboard-cell[aria-label^="第 1 格"]').click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toBeVisible();

  const promptTextarea = page.locator("#storyboardCellPrompt");
  await expect(promptTextarea).toHaveValue("第一格提示词");

  await page.getByRole("button", { name: "重新生成图片" }).click();
  await expect(page.getByRole("button", { name: "取消当前任务" })).toBeVisible();

  await promptTextarea.selectText();
  await page.keyboard.press(CUT_SHORTCUT);
  await expect(promptTextarea).toHaveValue("");
  await promptTextarea.fill("生成中仍可编辑");

  await page.getByRole("button", { name: "下一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 2 格 输入面板" })).toBeVisible();
  await page.getByRole("button", { name: "上一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toBeVisible();
  await expect(promptTextarea).toHaveValue("生成中仍可编辑");

  await expect(page.locator(".storyboard-editor-status")).toContainText("生成完成");
  await page.getByRole("button", { name: "下一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 2 格 输入面板" })).toBeVisible();
  await page.getByRole("button", { name: "上一格" }).click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toBeVisible();
  await page.getByRole("button", { name: "关闭输入面板" }).click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toHaveCount(0);
});
