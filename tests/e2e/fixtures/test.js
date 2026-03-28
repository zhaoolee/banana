import { expect, test as base } from "@playwright/test";

export const test = base.extend({
  captureClientErrors: [
    async ({ page }, use) => {
      const issues = [];

      page.on("pageerror", (error) => {
        issues.push(`pageerror: ${error.stack || error.message}`);
      });

      page.on("console", (message) => {
        if (message.type() === "error") {
          issues.push(`console: ${message.text()}`);
        }
      });

      await use();

      expect(
        issues,
        issues.length > 0 ? issues.join("\n\n") : "No client-side console or runtime errors",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
