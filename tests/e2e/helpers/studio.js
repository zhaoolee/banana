import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "../fixtures/test.js";
import { TEST_IMAGE_BASE64 } from "./mockApi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROFESSIONAL_SCENE_FIXTURE_PATH = path.resolve(
  __dirname,
  "../../../scripts/self-test/fixtures/professional-scene.sample.json",
);

export async function gotoStudio(page, url = "/studio?pw=banana") {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "专业模式导出预览" })).toBeVisible();
}

export async function dispatchImagePaste(page, fileName) {
  await page.evaluate(
    ({ base64, name }) => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const file = new File([bytes], name, {
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
      name: fileName,
    },
  );
}

export async function seedLocalStorage(page, values) {
  await page.addInitScript((entries) => {
    Object.entries(entries).forEach(([key, value]) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    });
  }, values);
}
