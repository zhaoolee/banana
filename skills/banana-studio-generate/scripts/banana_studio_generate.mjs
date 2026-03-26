#!/usr/bin/env node

import crypto from "node:crypto";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3001";
const DEFAULT_MODEL_ID = "nano-banana-2";
const DEFAULT_IMAGE_OPTIONS = {
  aspectRatio: "1:1",
  imageSize: "1K",
  layoutRows: 1,
  layoutColumns: 1,
};
const SUPPORTED_STORYBOARD_ASPECT_RATIOS = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
];
const SCRIPT_FILE_PATH = fileURLToPath(import.meta.url);
const SKILL_DIRECTORY = path.resolve(path.dirname(SCRIPT_FILE_PATH), "..");
const DEFAULT_ENV_FILE_PATH = path.join(SKILL_DIRECTORY, ".env");

dotenv.config({ path: DEFAULT_ENV_FILE_PATH });

function buildProfessionalSceneArchiveBaseName() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `banana-${datePart}-${timePart}-prompt-run`;
}

function sanitizeExportFileBaseName(value, fallbackValue = "banana-export") {
  const normalizedFallback =
    typeof fallbackValue === "string" && fallbackValue.trim()
      ? fallbackValue.trim()
      : "banana-export";
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  const withoutExtension = normalizedValue.replace(/\.(json|zip)$/i, "");
  const sanitizedValue = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/g, "")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  return sanitizedValue || normalizedFallback;
}

function buildPromptRunAssetPackageFileName(baseName = buildProfessionalSceneArchiveBaseName()) {
  return `${sanitizeExportFileBaseName(baseName, buildProfessionalSceneArchiveBaseName())}.zip`;
}

function buildZipCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let currentValue = index;

    for (let bit = 0; bit < 8; bit += 1) {
      currentValue =
        (currentValue & 1) === 1
          ? 0xedb88320 ^ (currentValue >>> 1)
          : currentValue >>> 1;
    }

    table[index] = currentValue >>> 0;
  }

  return table;
}

const ZIP_CRC32_TABLE = buildZipCrc32Table();

function computeZipCrc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = ZIP_CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZipBuffer(entries) {
  const encoder = new TextEncoder();
  const normalizedEntries = entries
    .map((entry) => {
      const normalizedPath = String(entry?.path || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/g, "")
        .replace(/\/+/g, "/");

      if (!normalizedPath) {
        return null;
      }

      const dataBytes =
        typeof entry?.data === "string"
          ? Buffer.from(encoder.encode(entry.data))
          : entry?.data instanceof Uint8Array || Buffer.isBuffer(entry?.data)
            ? Buffer.from(entry.data)
            : null;

      if (!dataBytes) {
        return null;
      }

      return {
        path: normalizedPath,
        pathBytes: Buffer.from(encoder.encode(normalizedPath)),
        dataBytes,
        modifiedAt: entry?.modifiedAt instanceof Date ? entry.modifiedAt : new Date(),
      };
    })
    .filter(Boolean);

  const chunks = [];
  const centralDirectoryEntries = [];
  let offset = 0;

  normalizedEntries.forEach((entry) => {
    const usesUtf8 = /[^\x00-\x7f]/.test(entry.path);
    const generalPurposeBitFlag = usesUtf8 ? 0x0800 : 0;
    const crc32 = computeZipCrc32(entry.dataBytes);
    const dosYear = Math.max(entry.modifiedAt.getFullYear(), 1980);
    const dosDate =
      ((dosYear - 1980) << 9) |
      ((entry.modifiedAt.getMonth() + 1) << 5) |
      entry.modifiedAt.getDate();
    const dosTime =
      (entry.modifiedAt.getHours() << 11) |
      (entry.modifiedAt.getMinutes() << 5) |
      Math.floor(entry.modifiedAt.getSeconds() / 2);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(generalPurposeBitFlag, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(entry.dataBytes.length, 18);
    localHeader.writeUInt32LE(entry.dataBytes.length, 22);
    localHeader.writeUInt16LE(entry.pathBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, entry.pathBytes, entry.dataBytes);
    centralDirectoryEntries.push({
      crc32,
      dataLength: entry.dataBytes.length,
      dosDate,
      dosTime,
      generalPurposeBitFlag,
      offset,
      pathBytes: entry.pathBytes,
    });
    offset += 30 + entry.pathBytes.length + entry.dataBytes.length;
  });

  const centralDirectoryOffset = offset;

  centralDirectoryEntries.forEach((entry) => {
    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(entry.generalPurposeBitFlag, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(entry.dosTime, 12);
    centralHeader.writeUInt16LE(entry.dosDate, 14);
    centralHeader.writeUInt32LE(entry.crc32, 16);
    centralHeader.writeUInt32LE(entry.dataLength, 20);
    centralHeader.writeUInt32LE(entry.dataLength, 24);
    centralHeader.writeUInt16LE(entry.pathBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(entry.offset, 42);

    chunks.push(centralHeader, entry.pathBytes);
    offset += 46 + entry.pathBytes.length;
  });

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(centralDirectoryEntries.length, 8);
  endOfCentralDirectory.writeUInt16LE(centralDirectoryEntries.length, 10);
  endOfCentralDirectory.writeUInt32LE(offset - centralDirectoryOffset, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  chunks.push(endOfCentralDirectory);

  return Buffer.concat(chunks);
}

function printUsage() {
  process.stdout.write(`Usage:
  node skills/banana-studio-generate/scripts/banana_studio_generate.mjs --prompt "..."
  node skills/banana-studio-generate/scripts/banana_studio_generate.mjs --storyboard-file ./storyboard.md

Options:
  --prompt <text>             Prompt text. Required unless provided by --payload-file.
  --storyboard-file <path>    Markdown or JSON storyboard spec with captions.
  --pw <value>                Override BANANA_STUDIO_PW.
  --api-base-url <url>        Backend base URL. Default: ${DEFAULT_API_BASE_URL}
  --payload-file <path>       Frontend-compatible JSON payload file.
  --model-id <id>             Banana Studio model id.
  --aspect-ratio <ratio>      Example: 1:1, 1:8, 16:9.
  --image-size <size>         1K, 2K, or 4K.
  --layout-rows <number>      Layout rows.
  --layout-columns <number>   Layout columns.
  --reference-image <value>   Repeatable local image path or image URL.
  --layout-guide <value>      Local image path or image URL for layoutGuideImage.
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
      case "--storyboard-file":
        options.storyboardFile = nextValue;
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

function normalizePositiveInteger(value, fallback, max = Number.POSITIVE_INFINITY) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, max);
}

function parseAspectRatioValue(value) {
  const match = String(value || "").trim().match(/^(\d+)\s*:\s*(\d+)$/);

  if (!match) {
    return null;
  }

  const width = Number.parseFloat(match[1]);
  const height = Number.parseFloat(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

function pickClosestAspectRatioValue(targetRatio, supportedValues = SUPPORTED_STORYBOARD_ASPECT_RATIOS) {
  if (!Number.isFinite(targetRatio) || targetRatio <= 0) {
    return DEFAULT_IMAGE_OPTIONS.aspectRatio;
  }

  let bestValue = supportedValues[0] || DEFAULT_IMAGE_OPTIONS.aspectRatio;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const value of supportedValues) {
    const ratio = parseAspectRatioValue(value);
    if (!ratio) {
      continue;
    }

    const distance = Math.abs(Math.log(targetRatio) - Math.log(ratio));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestValue = value;
    }
  }

  return bestValue;
}

function computeStoryboardCellTargetAspectRatio(canvasWidth, canvasHeight, rows, columns) {
  const safeRows = Math.max(rows, 1);
  const safeColumns = Math.max(columns, 1);
  const cellWidth = canvasWidth / safeColumns;
  const cellHeight = canvasHeight / safeRows;

  if (!Number.isFinite(cellWidth) || !Number.isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) {
    return 1;
  }

  return cellWidth / cellHeight;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function inferMimeTypeFromName(name) {
  const extension = path.extname(name).toLowerCase();
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
  throw new Error(`Unsupported image extension for ${name}`);
}

function inferMimeTypeFromContentType(contentType, fallbackName) {
  const normalizedContentType = String(contentType || "").split(";")[0].trim().toLowerCase();

  if (normalizedContentType.startsWith("image/")) {
    return normalizedContentType;
  }

  return inferMimeTypeFromName(fallbackName);
}

function buildRemoteImageName(url) {
  const parsed = new URL(url);
  const pathnameName = path.basename(parsed.pathname || "").trim();
  return pathnameName || "reference-image.png";
}

async function readLocalImageAsPayload(filePath) {
  const absolutePath = path.resolve(filePath);
  const fileBuffer = await fs.readFile(absolutePath);
  return {
    name: path.basename(absolutePath),
    mimeType: inferMimeTypeFromName(absolutePath),
    data: fileBuffer.toString("base64"),
  };
}

async function readRemoteImageAsPayload(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image URL: ${url} (${response.status})`);
  }

  const imageName = buildRemoteImageName(url);
  const mimeType = inferMimeTypeFromContentType(response.headers.get("content-type"), imageName);
  const fileBuffer = Buffer.from(await response.arrayBuffer());

  return {
    name: imageName,
    mimeType,
    data: fileBuffer.toString("base64"),
  };
}

async function readImageAsPayload(imageSource) {
  if (isHttpUrl(imageSource)) {
    return readRemoteImageAsPayload(imageSource);
  }

  return readLocalImageAsPayload(imageSource);
}

async function normalizeImageEntry(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    return readImageAsPayload(entry);
  }

  if (typeof entry === "object" && !Array.isArray(entry)) {
    if (entry.data && entry.mimeType) {
      return entry;
    }

    const source = entry.url || entry.path || entry.src || entry.href;
    if (source) {
      return readImageAsPayload(source);
    }
  }

  throw new Error("Image entries must be a local path, image URL, or an object with data/mimeType.");
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

function parseSimpleFrontmatter(raw) {
  const normalized = String(raw || "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return {
      attributes: {},
      body: normalized,
    };
  }

  const lines = normalized.split(/\r?\n/);
  const attributes = {};
  let index = 1;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "---") {
      return {
        attributes,
        body: lines.slice(index + 1).join("\n"),
      };
    }

    const match = line.match(/^([^:#]+):\s*(.+)$/);
    if (match) {
      attributes[match[1].trim()] = match[2].trim();
    }

    index += 1;
  }

  return {
    attributes,
    body: normalized,
  };
}

function splitMarkdownTableRow(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function mapStoryboardColumnKey(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "row" || normalized === "行") {
    return "row";
  }
  if (normalized === "column" || normalized === "col" || normalized === "列") {
    return "column";
  }
  if (normalized === "content" || normalized === "prompt" || normalized === "内容") {
    return "content";
  }
  if (normalized === "caption" || normalized === "配文") {
    return "caption";
  }

  return normalized;
}

function parseStoryboardMarkdownTable(body) {
  const lines = String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tableLines = lines.filter((line) => line.startsWith("|"));

  if (tableLines.length < 3) {
    throw new Error("Storyboard markdown must contain a table with row/column/content/caption.");
  }

  const header = splitMarkdownTableRow(tableLines[0]).map((cell) => mapStoryboardColumnKey(cell));
  const rows = [];

  for (const line of tableLines.slice(2)) {
    const values = splitMarkdownTableRow(line);
    const row = {};

    header.forEach((key, index) => {
      row[key] = values[index] || "";
    });

    rows.push(row);
  }

  return rows;
}

async function loadStoryboardFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("--storyboard-file JSON must contain an object");
    }
    return parsed;
  }

  const { attributes, body } = parseSimpleFrontmatter(raw);
  return {
    ...attributes,
    cells: parseStoryboardMarkdownTable(body),
  };
}

function buildSequentialStoryboardCoordinate(index, columns) {
  return {
    row: Math.floor(index / columns) + 1,
    column: (index % columns) + 1,
  };
}

function normalizeStoryboardTrackOverride(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseStoryboardTrackValue(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number.parseInt(String(value), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function validateStoryboardCoordinate(row, column, rows, columns, cellLabel) {
  if (row < 1 || row > rows || column < 1 || column > columns) {
    throw new Error(
      `${cellLabel} uses row ${row}, column ${column}, which is outside the configured ${rows}x${columns} layout.`,
    );
  }
}

function normalizeStoryboardSpec(input, options = {}) {
  const rawCells = Array.isArray(input?.cells) ? input.cells : [];

  if (rawCells.length === 0) {
    throw new Error("Storyboard spec must contain cells.");
  }

  const explicitRows = normalizeStoryboardTrackOverride(options.layoutRows);
  const explicitColumns = normalizeStoryboardTrackOverride(options.layoutColumns);
  const frontmatterRows = parseStoryboardTrackValue(input?.layoutRows);
  const frontmatterColumns = parseStoryboardTrackValue(input?.layoutColumns);
  const inferredRows = rawCells.reduce((currentMax, cell) => {
    const parsedRow = parseStoryboardTrackValue(cell?.row);
    return parsedRow ? Math.max(currentMax, parsedRow) : currentMax;
  }, 0);
  const inferredColumns = rawCells.reduce((currentMax, cell) => {
    const parsedColumn = parseStoryboardTrackValue(cell?.column);
    return parsedColumn ? Math.max(currentMax, parsedColumn) : currentMax;
  }, 0);
  const layoutRows = normalizePositiveInteger(
    explicitRows || frontmatterRows || inferredRows || rawCells.length,
    rawCells.length,
    8,
  );
  const layoutColumns = normalizePositiveInteger(
    explicitColumns || frontmatterColumns || inferredColumns || 1,
    1,
    8,
  );
  const canvasWidth = normalizePositiveInteger(input?.canvasWidth, 1080, 10000);
  const canvasHeight = normalizePositiveInteger(input?.canvasHeight, 1440, 10000);

  if (layoutRows * layoutColumns < rawCells.length) {
    throw new Error(
      `Storyboard layout ${layoutRows}x${layoutColumns} cannot fit ${rawCells.length} cells.`,
    );
  }

  const shouldReflowCoordinates = Boolean(explicitRows || explicitColumns);
  const occupiedCoordinates = new Set();
  const cells = rawCells.map((cell, index) => {
    const nextIndex = index + 1;
    const sequentialCoordinate = buildSequentialStoryboardCoordinate(index, layoutColumns);
    const parsedRow = parseStoryboardTrackValue(cell?.row);
    const parsedColumn = parseStoryboardTrackValue(cell?.column);
    const coordinate = shouldReflowCoordinates || !parsedRow || !parsedColumn
      ? sequentialCoordinate
      : {
          row: parsedRow,
          column: parsedColumn,
        };

    validateStoryboardCoordinate(
      coordinate.row,
      coordinate.column,
      layoutRows,
      layoutColumns,
      `Storyboard cell ${nextIndex}`,
    );

    const coordinateKey = `${coordinate.row}-${coordinate.column}`;
    if (occupiedCoordinates.has(coordinateKey)) {
      throw new Error(`Storyboard cell ${nextIndex} duplicates row ${coordinate.row}, column ${coordinate.column}.`);
    }
    occupiedCoordinates.add(coordinateKey);

    return {
      index: nextIndex,
      row: coordinate.row,
      column: coordinate.column,
      content: normalizePromptValue(cell?.content || cell?.prompt),
      caption: normalizePromptValue(cell?.caption),
    };
  });

  const targetCellAspectRatio = computeStoryboardCellTargetAspectRatio(
    canvasWidth,
    canvasHeight,
    layoutRows,
    layoutColumns,
  );
  const autoAspectRatio = pickClosestAspectRatioValue(targetCellAspectRatio);
  const explicitAspectRatio = normalizePromptValue(options.aspectRatio);

  return {
    title: normalizePromptValue(input?.title) || "Storyboard",
    globalStylePrompt: normalizePromptValue(input?.globalStylePrompt),
    canvas: {
      label: "custom",
      width: canvasWidth,
      height: canvasHeight,
      rows: layoutRows,
      columns: layoutColumns,
    },
    imageOptions: {
      aspectRatio: explicitAspectRatio || autoAspectRatio,
      imageSize: normalizePromptValue(input?.imageSize) || "1K",
    },
    targetCellAspectRatio,
    autoAspectRatio,
    cells,
  };
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
    ? await Promise.all(payloadFromFile.referenceImages.map((entry) => normalizeImageEntry(entry)))
    : [];
  const cliReferenceImages = await Promise.all(
    options.referenceImages.map((imagePath) => readImageAsPayload(imagePath)),
  );
  payload.referenceImages = [...payloadReferenceImages, ...cliReferenceImages];

  if (options.layoutGuide) {
    payload.layoutGuideImage = await readImageAsPayload(options.layoutGuide);
  } else if (payload.layoutGuideImage) {
    payload.layoutGuideImage = await normalizeImageEntry(payload.layoutGuideImage);
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

async function requestProfessionalExportPreview({ apiBaseUrl, pw, payload }) {
  const response = await fetch(`${apiBaseUrl}/api/export/professional-preview`, {
    method: "POST",
    headers: {
      ...buildPwHeaders(pw),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Professional export preview failed with HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
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

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getFileExtensionFromMimeType(mimeType) {
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
  if (mimeType === "image/bmp") {
    return "bmp";
  }
  return "bin";
}

function buildAssetFileName(name, mimeType, fallbackStem) {
  const rawName = typeof name === "string" ? name.trim() : "";
  const rawExtension = path.extname(rawName);
  const baseName = rawExtension ? rawName.slice(0, -rawExtension.length) : rawName;
  const safeBaseName = sanitizeExportFileBaseName(baseName, fallbackStem);
  return `${safeBaseName}.${getFileExtensionFromMimeType(mimeType)}`;
}

function extractInlineImageAsset(image, assetPath) {
  if (!image?.data || !image?.mimeType) {
    return {
      normalizedImage: image,
      assetEntry: null,
    };
  }

  const { data: _data, ...imageWithoutInlineData } = image;
  return {
    normalizedImage: {
      ...imageWithoutInlineData,
      assetPath,
    },
    assetEntry: {
      path: assetPath,
      data: Buffer.from(image.data, "base64"),
    },
  };
}

async function createAssetPackage({ runDirectory, payload, summary, savedImagePath }) {
  const safeBaseName = sanitizeExportFileBaseName(
    path.basename(runDirectory),
    buildProfessionalSceneArchiveBaseName(),
  );
  const normalizedPayload = cloneJsonValue(payload || {});
  const assetEntries = [];
  const extractedAt = new Date().toISOString();

  normalizedPayload.package = {
    format: "zip-with-assets",
    extractedAt,
    assetRoot: "images",
  };

  normalizedPayload.referenceImages = Array.isArray(normalizedPayload.referenceImages)
    ? normalizedPayload.referenceImages.map((image, index) => {
        const assetPath = `images/reference/${buildAssetFileName(image?.name, image?.mimeType, `reference-${index + 1}`)}`;
        const extracted = extractInlineImageAsset(image, assetPath);

        if (extracted.assetEntry) {
          assetEntries.push(extracted.assetEntry);
        }

        return extracted.normalizedImage;
      })
    : [];

  if (normalizedPayload.layoutGuideImage) {
    const assetPath = `images/layout-guide/${buildAssetFileName(
      normalizedPayload.layoutGuideImage?.name,
      normalizedPayload.layoutGuideImage?.mimeType,
      "layout-guide",
    )}`;
    const extracted = extractInlineImageAsset(normalizedPayload.layoutGuideImage, assetPath);

    if (extracted.assetEntry) {
      assetEntries.push(extracted.assetEntry);
    }

    normalizedPayload.layoutGuideImage = extracted.normalizedImage;
  }

  const zipEntries = [
    {
      path: `${safeBaseName}/result.json`,
      data: JSON.stringify(summary, null, 2),
    },
    {
      path: `${safeBaseName}/request.payload.json`,
      data: JSON.stringify(normalizedPayload, null, 2),
    },
    ...assetEntries.map((entry) => ({
      path: `${safeBaseName}/${entry.path}`,
      data: entry.data,
    })),
  ];

  if (savedImagePath) {
    zipEntries.push({
      path: `${safeBaseName}/${path.basename(savedImagePath)}`,
      data: await fs.readFile(savedImagePath),
    });
  }

  const assetPackagePath = path.join(
    runDirectory,
    buildPromptRunAssetPackageFileName(safeBaseName),
  );
  await fs.writeFile(assetPackagePath, createStoredZipBuffer(zipEntries));

  return assetPackagePath;
}

function buildStoryboardCellPrompt(storyboardSpec, cell) {
  const promptParts = [];

  if (storyboardSpec.globalStylePrompt) {
    promptParts.push(`整体风格：${storyboardSpec.globalStylePrompt}`);
  }

  promptParts.push(
    `构图要求：当前小格会按 ${storyboardSpec.imageOptions.aspectRatio} 比例生图，并放入 ${storyboardSpec.canvas.rows}x${storyboardSpec.canvas.columns} 分镜画板中。请让主体完整地位于画面中间偏上区域，四周预留 8% 到 12% 的安全边距，避免人物头部、手部、月亮、窗框、桌椅等关键元素贴边或被裁切。底部中央额外预留一条配文安全区，不要把重要内容压在最底部。`,
  );
  promptParts.push("画面中不要出现任何文字，配文由工具后期叠加。");
  promptParts.push(`当前分镜内容：${cell.content}`);

  return promptParts.join("\n\n");
}

function buildStoryboardCellPayload(storyboardSpec, cell, globalReferenceImages) {
  return {
    modelId: DEFAULT_MODEL_ID,
    prompt: buildStoryboardCellPrompt(storyboardSpec, cell),
    imageOptions: {
      aspectRatio: storyboardSpec.imageOptions.aspectRatio,
      imageSize: storyboardSpec.imageOptions.imageSize,
      layoutRows: 1,
      layoutColumns: 1,
      imageCount: 1,
    },
    referenceImages: globalReferenceImages,
  };
}

async function executeStoryboardRun({
  apiBaseUrl,
  pw,
  storyboardSpec,
  globalReferenceImages,
  outputDir,
  quiet,
}) {
  const runDirectory = buildRunDirectory(outputDir);
  const cellsDirectory = path.join(runDirectory, "cells");
  await fs.mkdir(cellsDirectory, { recursive: true });

  const generatedCells = [];

  for (const cell of storyboardSpec.cells) {
    const coordinateLabel = `r${cell.row}-c${cell.column}`;
    logStatus(`Generating storyboard cell ${coordinateLabel}`, quiet);

    const payload = buildStoryboardCellPayload(storyboardSpec, cell, globalReferenceImages);
    const result = await requestGenerateStream({
      apiBaseUrl,
      pw,
      payload,
      quiet,
    });
    const cellDirectory = path.join(cellsDirectory, `${String(cell.index).padStart(2, "0")}-r${cell.row}-c${cell.column}`);
    const persisted = await persistResult(result, cellDirectory, payload);

    generatedCells.push({
      ...cell,
      payload,
      result,
      savedImagePath: persisted.savedImagePath,
      summaryPath: persisted.summaryPath,
    });
  }

  const exportPayload = {
    title: storyboardSpec.title,
    canvas: storyboardSpec.canvas,
    dividerStyle: {
      widthPx: 2,
    },
    captionStyle: {
      fontSizePercent: 100,
      backgroundAlphaPercent: 90,
    },
    cells: generatedCells.map((cell) => ({
      row: cell.row,
      column: cell.column,
      prompt: cell.content,
      caption: cell.caption,
      image: {
        mimeType: cell.result.mimeType,
        data: cell.result.imageBase64,
      },
    })),
  };

  const storyboardBuffer = await requestProfessionalExportPreview({
    apiBaseUrl,
    pw,
    payload: exportPayload,
  });
  const savedImagePath = path.join(runDirectory, "result.png");
  await fs.writeFile(savedImagePath, storyboardBuffer);

  const summary = {
    ok: true,
    mode: "storyboard",
    title: storyboardSpec.title,
    canvas: storyboardSpec.canvas,
    imageOptions: storyboardSpec.imageOptions,
    cellCount: generatedCells.length,
    cells: generatedCells.map((cell) => ({
      index: cell.index,
      row: cell.row,
      column: cell.column,
      content: cell.content,
      caption: cell.caption,
      savedImagePath: cell.savedImagePath,
      summaryPath: cell.summaryPath,
    })),
    savedImagePath,
  };

  const storyboardInputPath = path.join(runDirectory, "storyboard.input.json");
  await fs.writeFile(storyboardInputPath, JSON.stringify(storyboardSpec, null, 2), "utf8");
  const summaryPath = path.join(runDirectory, "result.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  const assetEntries = [
    {
      path: "result.png",
      data: storyboardBuffer,
    },
    {
      path: "result.json",
      data: JSON.stringify(summary, null, 2),
    },
    {
      path: "storyboard.input.json",
      data: JSON.stringify(storyboardSpec, null, 2),
    },
    ...generatedCells.flatMap((cell) => {
      const entries = [];
      if (cell.savedImagePath) {
        entries.push({
          path: `cells/${path.basename(path.dirname(cell.savedImagePath))}/result.png`,
          data: fs.readFile(cell.savedImagePath),
        });
      }
      return entries;
    }),
  ];

  const resolvedAssetEntries = [];
  for (const entry of assetEntries) {
    resolvedAssetEntries.push({
      path: `${sanitizeExportFileBaseName(path.basename(runDirectory), "storyboard-run")}/${entry.path}`,
      data: await entry.data,
    });
  }

  const assetPackagePath = path.join(
    runDirectory,
    buildPromptRunAssetPackageFileName(path.basename(runDirectory)),
  );
  await fs.writeFile(assetPackagePath, createStoredZipBuffer(resolvedAssetEntries));

  summary.assetPackagePath = assetPackagePath;
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return {
    runDirectory,
    savedImagePath,
    summaryPath,
    assetPackagePath,
    summary,
  };
}

function buildRunDirectory(outputDir) {
  if (outputDir) {
    return path.resolve(outputDir);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "storage", "skill-runs", `${stamp}-${crypto.randomBytes(4).toString("hex")}`);
}

async function persistResult(result, outputDir, payload) {
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

  const assetPackagePath = await createAssetPackage({
    runDirectory,
    payload,
    summary,
    savedImagePath,
  });
  summary.assetPackagePath = assetPackagePath;

  const summaryPath = path.join(runDirectory, "result.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return {
    runDirectory,
    summaryPath,
    savedImagePath,
    assetPackagePath,
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
    throw new Error("Missing pw. Pass --pw, set BANANA_STUDIO_PW, or create .env in the skill directory.");
  }

  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl || process.env.BANANA_STUDIO_API_BASE_URL || DEFAULT_API_BASE_URL,
  );

  if (options.storyboardFile) {
    const storyboardInput = await loadStoryboardFile(options.storyboardFile);
    const storyboardSpec = normalizeStoryboardSpec(storyboardInput, options);
    const globalReferenceImages = await Promise.all(
      options.referenceImages.map((imagePath) => readImageAsPayload(imagePath)),
    );
    const persisted = await executeStoryboardRun({
      apiBaseUrl,
      pw,
      storyboardSpec,
      globalReferenceImages,
      outputDir: options.outputDir,
      quiet: options.quiet,
    });

    const printableResult = {
      ok: persisted.summary.ok,
      mode: persisted.summary.mode,
      title: persisted.summary.title,
      cellCount: persisted.summary.cellCount,
      savedImagePath: persisted.savedImagePath,
      assetPackagePath: persisted.assetPackagePath,
      summaryPath: persisted.summaryPath,
      runDirectory: persisted.runDirectory,
    };

    process.stdout.write(`${JSON.stringify(printableResult, null, 2)}\n`);
    return;
  }

  const payload = await buildPayload(options);
  const generateResult = await requestGenerateStream({
    apiBaseUrl,
    pw,
    payload,
    quiet: options.quiet,
  });
  const persisted = await persistResult(generateResult, options.outputDir, payload);

  const printableResult = options.printFullResult
    ? {
        ...generateResult,
        savedImagePath: persisted.savedImagePath,
        assetPackagePath: persisted.assetPackagePath,
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
        assetPackagePath: persisted.assetPackagePath,
        summaryPath: persisted.summaryPath,
        runDirectory: persisted.runDirectory,
      };

  process.stdout.write(`${JSON.stringify(printableResult, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
