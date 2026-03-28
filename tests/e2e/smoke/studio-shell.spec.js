import { expect, test } from "../fixtures/test.js";
import { installApiMocks } from "../helpers/mockApi.js";
import { gotoStudio } from "../helpers/studio.js";

test("root redirects to login @smoke", async ({ page }) => {
  await installApiMocks(page);

  await page.goto("/", {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("提取码")).toBeVisible();
});

test("studio shell renders with mocked session @smoke", async ({ page }) => {
  await installApiMocks(page, {
    studioSession: {
      pw: {
        value: "banana",
        remainingCredits: 12,
      },
    },
  });

  await gotoStudio(page);

  await expect(page.getByRole("button", { name: /打开任务列表/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /打开设置/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: "专业模式" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("剩余12张额度")).toBeVisible();
});
