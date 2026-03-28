import { expect, test } from "../fixtures/test.js";
import { installApiMocks } from "../helpers/mockApi.js";
import { gotoStudio, seedLocalStorage } from "../helpers/studio.js";

test("request task cancel from storyboard and task manager @smoke", async ({ page }) => {
  let cancelRequestCount = 0;

  await seedLocalStorage(page, {
    "banana.requestTasks": [
      {
        requestId: "cancelstory01",
        type: "storyboard",
        mode: "professional",
        canRetry: true,
        promptSnapshot: "分镜取消测试",
        storyboardCellId: "storyboard-cell-1-1",
        storyboardCellLabel: "第 1 格",
        storyboardCellCoordinate: "行 1 / 列 1",
        createdAt: "2026-03-25T10:00:00.000Z",
        updatedAt: "2026-03-25T10:00:00.000Z",
        status: "accepted",
        stage: "accepted",
        message: "第 1 格 请求已提交，等待后端接收...",
      },
      {
        requestId: "canceltask02",
        type: "generation",
        mode: "professional",
        canRetry: true,
        promptSnapshot: "列表取消测试",
        createdAt: "2026-03-25T10:01:00.000Z",
        updatedAt: "2026-03-25T10:01:00.000Z",
        status: "processing",
        stage: "processing",
        message: "正在生成图片...",
      },
    ],
  });

  await installApiMocks(page, {
    customHandler: async ({ route, request, pathname, fulfillJson }) => {
      if (request.method() === "GET" && /\/api\/generations\/[^/]+$/.test(pathname)) {
        await fulfillJson(route, {
          requestId: pathname.split("/").pop(),
          status: "cancelled",
          stage: "cancelled",
          message: "任务已取消",
          updatedAt: "2026-03-27T00:20:00.000Z",
        });
        return true;
      }

      if (request.method() === "POST" && /\/api\/generations\/[^/]+\/cancel$/.test(pathname)) {
        cancelRequestCount += 1;
        await fulfillJson(route, {
          ok: true,
          requestId: "mock-cancelled",
          status: "cancelled",
          stage: "cancelled",
          message: "任务已取消",
        });
        return true;
      }

      if (request.method() === "POST" && pathname === "/api/tasks/watch/stream") {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: 'event: status\ndata: {"requestId":"cancelstory01","stage":"heartbeat"}\n\n',
        });
        return true;
      }

      return false;
    },
  });

  await gotoStudio(page);

  await page.locator('.storyboard-cell[aria-label^="第 1 格"]').click();
  await expect(page.getByRole("dialog", { name: "第 1 格 输入面板" })).toBeVisible();
  await page.getByRole("button", { name: "取消当前任务" }).click();
  await expect(page.getByRole("button", { name: "确认取消任务" })).toBeVisible();
  await page.getByRole("button", { name: "放弃取消任务" }).click();
  await expect(page.getByRole("button", { name: "取消当前任务" })).toHaveCount(1);

  await page.getByRole("button", { name: "取消当前任务" }).click();
  await page.getByRole("button", { name: "确认取消任务" }).click();
  await expect(page.locator(".storyboard-editor-status").getByText("任务已取消")).toBeVisible();
  await expect(page.getByRole("button", { name: "取消当前任务" })).toHaveCount(0);
  await page.getByRole("button", { name: "关闭输入面板" }).click();

  await page.getByRole("button", { name: /打开任务列表/ }).click();
  await expect(page.getByRole("dialog", { name: "任务列表" })).toBeVisible();
  const activeTaskCard = page.locator(".task-manager-item").filter({
    hasText: "ID cancelta",
  });
  await activeTaskCard.getByRole("button", { name: "取消任务" }).click();
  await activeTaskCard.getByRole("button", { name: "确认取消任务" }).click();
  await expect(activeTaskCard.locator(".task-manager-status-badge.is-cancelled")).toBeVisible();

  expect(cancelRequestCount).toBe(2);
});
