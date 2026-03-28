import { expect, test } from "../fixtures/test.js";
import { buildMockPasswordRecord, installApiMocks } from "../helpers/mockApi.js";

test("admin login, create pw and add credits @smoke", async ({ page }) => {
  await installApiMocks(page, {
    passwords: [
      buildMockPasswordRecord("banana", {
        remainingCredits: 88,
        totalCredits: 100,
        usedCredits: 12,
      }),
    ],
  });

  await page.goto("/admin", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "管理员面板" })).toBeVisible();
  await page.locator("#admin-username").fill("banana-admin");
  await page.locator("#admin-password").fill("secret");
  await page.getByRole("button", { name: "登录管理员面板" }).click();

  await expect(page.getByRole("heading", { name: "PW 管理面板" })).toBeVisible();
  await expect(page.getByText("总额度", { exact: true })).toBeVisible();
  await expect(page.getByText("剩余额度", { exact: true })).toBeVisible();
  await expect(page.locator(".admin-password-card")).toHaveCount(1);

  await page.getByPlaceholder("例如 banana、banana_vip").fill("banana_vip");
  await page.getByRole("button", { name: "创建 pw" }).click();
  await expect(page.getByText("已创建 pw banana_vip，默认额度 100")).toBeVisible();
  await expect(page.locator(".admin-password-card")).toHaveCount(2);

  const vipCard = page.locator(".admin-password-card").filter({
    hasText: "banana_vip",
  });
  await vipCard.getByPlaceholder("增加额度").fill("20");
  await vipCard.getByRole("button", { name: "追加额度" }).click();

  await expect(page.getByText("已为 banana_vip 增加 20 张额度")).toBeVisible();
  await expect(vipCard.getByText("剩余")).toBeVisible();
  await expect(vipCard.locator(".admin-password-badge strong")).toHaveText("120");
  await expect(vipCard.getByText("总额度 120")).toBeVisible();
});
