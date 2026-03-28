import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const forwardedArgs = process.argv.slice(2);
const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", "test", "--grep", "@smoke", ...forwardedArgs],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("[self-test] FAILED");
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (code === 0) {
    return;
  }

  process.exitCode = code ?? 1;

  if (signal) {
    console.error(`[self-test] interrupted by signal ${signal}`);
  }
});
