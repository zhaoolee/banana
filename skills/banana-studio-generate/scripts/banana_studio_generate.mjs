#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:23001";
const DEFAULT_MODEL_ID = "nano-banana-2";
const DEFAULT_IMAGE_OPTIONS = {
  aspectRatio: "1:1",
  imageSize: "1K",
  layoutRows: 1,
  layoutColumns: 1,
};

function printUsage() {
  process.stdout.write(`Usage:
  node skills/banana-studio-generate/scripts/banana_studio_generate.mjs --prompt "..."

Options:
  --prompt <text>             Prompt text. Required unless provided by --payload-file.
  --pw <value>                Override BANANA_STUDIO_PW.
  --api-base-url <url>        Backend base URL. Default: ${DEFAULT_API_BASE_URL}
  --payload-file <path>       Frontend-compatible JSON payload file.
  --model-id <id>             Banana Studio model id.
  --aspect-ratio <ratio>      Example: 1:1, 1:8, 16:9.
  --image-size <size>         1K, 2K, or 4K.
  --layout-rows <number>      Layout rows.
  --layout-columns <number>   Layout columns.
  --reference-image <path>    Repeatable local image file path.
  --layout-guide <path>       Local image file path for layoutGuideImage.
  --output-dir <path>         Directory for local output files.
  --print-full-result         Print the full backend result JSON, including imageBase64.
  --quiet                     Suppress streamed status output.
  --help                      Show this message.
`);
}

function parseArgs(argv) {
  const options = {
    referenceImages: [],
    quiet: false,
    printFullResult: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help") {
      options.help = true;
      continue;
    }

    if (argument === "--quiet") {
      options.quiet = true;
      continue;
    }

    if (argument === "--print-full-result") {
      options.printFullResult = true;
      continue;
    }

    const nextValue = argv[index + 1];

    if (!argument.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${argument}`);
    }

    if (nextValue === undefined) {
      throw new Error(`Missing value for ${argument}`);
    }

    switch (argument) {
      case "--prompt":
        options.prompt = nextValue;
        break;
      case "--pw":
        options.pw = nextValue;
        break;
      case "--api-base-url":
        options.apiBaseUrl = nextValue;
        break;
      case "--payload-file":
        options.payloadFile = nextValue;
        break;
      case "--model-id":
        options.modelId = nextValue;
        break;
      case "--aspect-ratio":
        options.aspectRatio = nextValue;
        break;
      case "--image-size":
        options.imageSize = nextValue;
        break;
      case "--layout-rows":
        options.layoutRows = Number.parseInt(nextValue, 10);
        break;
      case "--layout-columns":
        options.layoutColumns = Number.parseInt(nextValue, 10);
        break;
      case "--reference-image":
        options.referenceImages.push(nextValue);
        break;
      case "--layout-guide":
        options.layoutGuide = nextValue;
        break;
      case "--output-dir":
        options.outputDir = nextValue;
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }

    index += 1;
  }

  return options;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function readPwOption(options) {
  return String(
    options.pw ||
      process.env.BANANA_STUDIO_PW ||
      "",
  ).trim();
}

function normalizePromptValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".bmp") {
    return "image/bmp";
  }
  throw new Error(`Unsupported image extension for ${filePath}`);
}

async function readImageAsPayload(filePath) {
  const absolutePath = path.resolve(filePath);
  const fileBuffer = await fs.readFile(absolutePath);
  return {
    name: path.basename(absolutePath),
    mimeType: inferMimeType(absolutePath),
    data: fileBuffer.toString("base64"),
  };
}

async function loadPayloadFile(filePath) {
  if (!filePath) {
    return {};
  }

  const absolutePath = path.resolve(filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--payload-file must contain a JSON object");
  }

  return parsed;
}

async function buildPayload(options) {
  const payloadFromFile = await loadPayloadFile(options.payloadFile);
  const prompt = normalizePromptValue(options.prompt || payloadFromFile.prompt);

  if (!prompt) {
    throw new Error("A prompt is required. Pass --prompt or include prompt in --payload-file.");
  }

  const payload = {
    ...payloadFromFile,
    prompt,
    modelId: options.modelId || payloadFromFile.modelId || DEFAULT_MODEL_ID,
    imageOptions: {
      ...DEFAULT_IMAGE_OPTIONS,
      ...(payloadFromFile.imageOptions || {}),
    },
  };

  if (options.aspectRatio) {
    payload.imageOptions.aspectRatio = options.aspectRatio;
  }
  if (options.imageSize) {
    payload.imageOptions.imageSize = options.imageSize;
  }
  if (Number.isInteger(options.layoutRows)) {
    payload.imageOptions.layoutRows = options.layoutRows;
  }
  if (Number.isInteger(options.layoutColumns)) {
    payload.imageOptions.layoutColumns = options.layoutColumns;
  }

  const payloadReferenceImages = Array.isArray(payloadFromFile.referenceImages)
    ? [...payloadFromFile.referenceImages]
    : [];
  const cliReferenceImages = await Promise.all(
    options.referenceImages.map((imagePath) => readImageAsPayload(imagePath)),
  );
  payload.referenceImages = [...payloadReferenceImages, ...cliReferenceImages];

  if (options.layoutGuide) {
    payload.layoutGuideImage = await readImageAsPayload(options.layoutGuide);
  } else if (!payload.layoutGuideImage) {
    delete payload.layoutGuideImage;
  }

  return payload;
}

function buildPwHeaders(pw) {
  return {
    "x-banana-pw": pw,
  };
}

function logStatus(message, quiet) {
  if (!quiet && message) {
    process.stderr.write(`${message}\n`);
  }
}

function consumeSseBlocks(buffer, flush = false) {
  const events = [];
  let nextBuffer = buffer;
  const delimiter = /\r?\n\r?\n/;

  while (true) {
    const match = delimiter.exec(nextBuffer);
    if (!match) {
      break;
    }

    const block = nextBuffer.slice(0, match.index);
    nextBuffer = nextBuffer.slice(match.index + match[0].length);
    if (block.trim()) {
      events.push(block);
    }
  }

  if (flush && nextBuffer.trim()) {
    events.push(nextBuffer);
    nextBuffer = "";
  }

  return { events, buffer: nextBuffer };
}

function parseSseBlock(block) {
  let eventName = "message";
  const dataLines = [];
  const lines = block.split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim() || eventName;
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join("\n");
  return {
    eventName,
    data: JSON.parse(rawData),
  };
}

async function requestGenerateStream({ apiBaseUrl, pw, payload, quiet }) {
  const response = await fetch(`${apiBaseUrl}/api/generate/stream`, {
    method: "POST",
    headers: {
      ...buildPwHeaders(pw),
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Generate stream failed with HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = null;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        const drained = consumeSseBlocks(buffer, true);
        buffer = drained.buffer;
        for (const block of drained.events) {
          const event = parseSseBlock(block);
          if (!event) {
            continue;
          }
          if (event.eventName === "status") {
            logStatus(event.data?.message, quiet);
          } else if (event.eventName === "error") {
            throw new Error(event.data?.error || "Generate stream failed");
          } else if (event.eventName === "result") {
            finalResult = event.data;
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const drained = consumeSseBlocks(buffer, false);
      buffer = drained.buffer;

      for (const block of drained.events) {
        const event = parseSseBlock(block);
        if (!event) {
          continue;
        }
        if (event.eventName === "status") {
          logStatus(event.data?.message, quiet);
        } else if (event.eventName === "error") {
          throw new Error(event.data?.error || "Generate stream failed");
        } else if (event.eventName === "result") {
          finalResult = event.data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResult) {
    throw new Error("Generate stream completed without a final result event");
  }

  return finalResult;
}

function inferExtensionFromMimeType(mimeType) {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  if (mimeType === "image/gif") {
    return "gif";
  }
  return "bin";
}

function buildRunDirectory(outputDir) {
  if (outputDir) {
    return path.resolve(outputDir);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "storage", "skill-runs", `${stamp}-${crypto.randomBytes(4).toString("hex")}`);
}

async function persistResult(result, outputDir) {
  const runDirectory = buildRunDirectory(outputDir);
  await fs.mkdir(runDirectory, { recursive: true });

  let savedImagePath = null;

  if (result?.imageBase64 && result?.mimeType) {
    const extension = inferExtensionFromMimeType(result.mimeType);
    savedImagePath = path.join(runDirectory, `result.${extension}`);
    await fs.writeFile(savedImagePath, Buffer.from(result.imageBase64, "base64"));
  }

  const summary = {
    ...result,
    imageBase64: undefined,
    savedImagePath,
  };

  const summaryPath = path.join(runDirectory, "result.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return {
    runDirectory,
    summaryPath,
    savedImagePath,
    summary,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const pw = readPwOption(options);
  if (!pw) {
    throw new Error("Missing pw. Pass --pw or set BANANA_STUDIO_PW.");
  }

  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl || process.env.BANANA_STUDIO_API_BASE_URL || DEFAULT_API_BASE_URL,
  );
  const payload = await buildPayload(options);
  const generateResult = await requestGenerateStream({
    apiBaseUrl,
    pw,
    payload,
    quiet: options.quiet,
  });
  const persisted = await persistResult(generateResult, options.outputDir);

  const printableResult = options.printFullResult
    ? {
        ...generateResult,
        savedImagePath: persisted.savedImagePath,
        summaryPath: persisted.summaryPath,
        runDirectory: persisted.runDirectory,
      }
    : {
        ok: generateResult.ok,
        bananaModelId: generateResult.bananaModelId,
        bananaModelName: generateResult.bananaModelName,
        providerModel: generateResult.providerModel,
        aspectRatio: generateResult.aspectRatio,
        imageSize: generateResult.imageSize,
        layoutRows: generateResult.layoutRows,
        layoutColumns: generateResult.layoutColumns,
        quota: generateResult.quota || null,
        savedRecord: generateResult.savedRecord || null,
        savedImagePath: persisted.savedImagePath,
        summaryPath: persisted.summaryPath,
        runDirectory: persisted.runDirectory,
      };

  process.stdout.write(`${JSON.stringify(printableResult, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
