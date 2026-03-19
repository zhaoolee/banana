import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import localforage from "localforage";
import AdminApp from "./AdminApp.jsx";

const LOGIN_PATH = "/login";
const STUDIO_PATH = "/studio";
const SELECTED_MODEL_STORAGE_KEY = "banana.selectedModelId";
const SELECTED_ASPECT_RATIO_STORAGE_KEY = "banana.selectedAspectRatio";
const SELECTED_LAYOUT_ROWS_STORAGE_KEY = "banana.selectedLayoutRows";
const SELECTED_LAYOUT_COLUMNS_STORAGE_KEY = "banana.selectedLayoutColumns";
const SELECTED_IMAGE_SIZE_STORAGE_KEY = "banana.selectedImageSize";
const SELECTED_IMAGE_COUNT_STORAGE_KEY = "banana.selectedImageCount";
const PROMPT_STORAGE_KEY = "banana.prompt";
const LAST_GENERATION_DB_NAME = "banana.studio";
const LAST_GENERATION_STORE_NAME = "app";
const LAST_GENERATION_RECORD_KEY = "lastGenerationResult";
const GENERATION_LIBRARY_RECORDS_KEY = "generationLibraryRecords";
const LAST_GENERATION_RECORD_ID_KEY = "lastGenerationRecordId";
const MAX_REFERENCE_IMAGES = 12;
const MAX_LAYOUT_TRACKS = 8;
const PROMPT_TEXTAREA_MIN_ROWS = 2;
const PROMPT_TEXTAREA_MAX_ROWS = 5;
const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "方图 1:1" },
  { value: "1:4", label: "超长竖 1:4" },
  { value: "1:8", label: "极长竖 1:8" },
  { value: "2:3", label: "竖版 2:3" },
  { value: "3:2", label: "横版 3:2" },
  { value: "4:3", label: "横版 4:3" },
  { value: "3:4", label: "竖版 3:4" },
  { value: "4:1", label: "超宽 4:1" },
  { value: "4:5", label: "竖版 4:5" },
  { value: "5:4", label: "横版 5:4" },
  { value: "8:1", label: "极宽 8:1" },
  { value: "16:9", label: "横版 16:9" },
  { value: "9:16", label: "竖版 9:16" },
  { value: "21:9", label: "超宽 21:9" },
];
const SUPPORTED_ASPECT_RATIO_VALUES = new Set(ASPECT_RATIO_OPTIONS.map((option) => option.value));
const IMAGE_SIZE_OPTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];
const IMAGE_COUNT_OPTIONS = [
  { value: 1, label: "1 张" },
  { value: 2, label: "2 张" },
  { value: 3, label: "3 张" },
  { value: 4, label: "4 张" },
];
const LAYOUT_TRACK_OPTIONS = Array.from({ length: MAX_LAYOUT_TRACKS }, (_value, index) => ({
  value: index + 1,
  label: String(index + 1),
}));
const SUPPORTED_IMAGE_SIZE_VALUES = new Set(IMAGE_SIZE_OPTIONS.map((option) => option.value));
const SUPPORTED_IMAGE_COUNT_VALUES = new Set(IMAGE_COUNT_OPTIONS.map((option) => option.value));
const MIN_PREVIEW_SCALE = 1;
const MAX_PREVIEW_SCALE = 6;
const SSE_CONNECT_TIMEOUT_MS = 20 * 1000;
const SSE_INACTIVITY_TIMEOUT_MS = 90 * 1000;
const generationResultStorage = localforage.createInstance({
  name: LAST_GENERATION_DB_NAME,
  storeName: LAST_GENERATION_STORE_NAME,
});

function createPersistedRecordId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAspectRatioValue(value) {
  return SUPPORTED_ASPECT_RATIO_VALUES.has(value) ? value : "1:1";
}

function normalizeImageSizeValue(value) {
  return SUPPORTED_IMAGE_SIZE_VALUES.has(value) ? value : "1K";
}

function normalizeImageCountValue(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return SUPPORTED_IMAGE_COUNT_VALUES.has(parsedValue) ? parsedValue : 1;
}

function getAspectRatioOrientation(value) {
  const { width, height } = parseAspectRatio(value);

  if (width === height) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

function getLayoutOrientation(rows, columns) {
  if (rows === columns) {
    return "square";
  }

  return columns > rows ? "landscape" : "portrait";
}

function getRecommendedAspectRatiosForLayout(rows, columns) {
  const layoutOrientation = getLayoutOrientation(rows, columns);

  if (layoutOrientation === "landscape") {
    return ["4:1", "16:9", "21:9", "4:3"];
  }

  if (layoutOrientation === "portrait") {
    return ["1:4", "9:16", "3:4", "4:5"];
  }

  return ["1:1", "4:5", "5:4"];
}

function clampPreviewScale(value) {
  return Math.min(Math.max(value, MIN_PREVIEW_SCALE), MAX_PREVIEW_SCALE);
}

function getPointerDistance(firstPointer, secondPointer) {
  return Math.hypot(
    secondPointer.x - firstPointer.x,
    secondPointer.y - firstPointer.y,
  );
}

function getModelAspectRatioOptions(model) {
  const allowedValues = new Set(
    Array.isArray(model?.supportedAspectRatios) && model.supportedAspectRatios.length > 0
      ? model.supportedAspectRatios
      : ASPECT_RATIO_OPTIONS.map((option) => option.value),
  );

  return ASPECT_RATIO_OPTIONS.filter((option) => allowedValues.has(option.value));
}

function getModelImageSizeOptions(model) {
  const allowedValues = new Set(
    Array.isArray(model?.supportedImageSizes) && model.supportedImageSizes.length > 0
      ? model.supportedImageSizes
      : ["1K"],
  );

  return IMAGE_SIZE_OPTIONS.filter((option) => allowedValues.has(option.value));
}

function clampLayoutTrack(value) {
  const parsedValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return 1;
  }

  return Math.min(Math.max(parsedValue, 1), MAX_LAYOUT_TRACKS);
}

function normalizeTextValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRemainingCredits(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function buildLayoutCells(rows, columns) {
  return Array.from({ length: rows * columns }, (_value, index) => index + 1);
}

function parseAspectRatio(value) {
  if (typeof value !== "string" || !value.includes(":")) {
    return { width: 1, height: 1 };
  }

  const [width = "1", height = "1"] = value.split(":", 2);
  const parsedWidth = Number.parseFloat(width.trim());
  const parsedHeight = Number.parseFloat(height.trim());

  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight) || parsedWidth <= 0 || parsedHeight <= 0) {
    return { width: 1, height: 1 };
  }

  return {
    width: parsedWidth,
    height: parsedHeight,
  };
}

function resizePromptTextarea(textarea) {
  if (!textarea || typeof window === "undefined") {
    return;
  }

  const styles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;
  const frameHeight = paddingTop + paddingBottom + borderTop + borderBottom;
  const minHeight = lineHeight * PROMPT_TEXTAREA_MIN_ROWS + frameHeight;
  const maxHeight = lineHeight * PROMPT_TEXTAREA_MAX_ROWS + frameHeight;

  textarea.style.height = "auto";

  const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

function roundRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawLayoutGuide(canvas, { aspectRatio, rows, columns }) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const size = 1200;
  const outerPadding = 56;
  const framePadding = 18;
  const { width: ratioWidth, height: ratioHeight } = parseAspectRatio(aspectRatio);
  const maxFrameSize = size - outerPadding * 2;
  const ratio = ratioWidth / ratioHeight;
  let frameWidth = maxFrameSize;
  let frameHeight = maxFrameSize;

  if (ratio >= 1) {
    frameHeight = maxFrameSize / ratio;
  } else {
    frameWidth = maxFrameSize * ratio;
  }

  const frameX = (size - frameWidth) / 2;
  const frameY = (size - frameHeight) / 2;
  const gridX = frameX + framePadding;
  const gridY = frameY + framePadding;
  const gridWidth = frameWidth - framePadding * 2;
  const gridHeight = frameHeight - framePadding * 2;
  const cellGap = Math.max(
    6,
    Math.min(
      20,
      Math.floor(Math.min(gridWidth / Math.max(columns, 1), gridHeight / Math.max(rows, 1)) * 0.08),
    ),
  );
  const cellWidth = (gridWidth - cellGap * (columns - 1)) / columns;
  const cellHeight = (gridHeight - cellGap * (rows - 1)) / rows;
  const cellRadius = Math.max(8, Math.min(20, Math.min(cellWidth, cellHeight) * 0.16));

  canvas.width = size;
  canvas.height = size;

  context.clearRect(0, 0, size, size);

  context.fillStyle = "rgba(255, 253, 246, 0.72)";
  roundRectPath(context, 8, 8, size - 16, size - 16, 30);
  context.fill();
  context.strokeStyle = "rgba(79, 54, 7, 0.12)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "rgba(255, 252, 243, 0.9)";
  roundRectPath(context, frameX, frameY, frameWidth, frameHeight, 24);
  context.fill();
  context.strokeStyle = "rgba(79, 54, 7, 0.06)";
  context.lineWidth = 2;
  context.stroke();

  context.font = "700 14px sans-serif";
  context.fillStyle = "rgba(121, 99, 66, 0.9)";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(`${rows} x ${columns} · ${aspectRatio}`, 28, 28);

  if (columns > 1) {
    context.font = "600 16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(121, 99, 66, 0.88)";

    for (let column = 0; column < columns; column += 1) {
      const x = gridX + column * (cellWidth + cellGap) + cellWidth / 2;
      context.fillText(`列${column + 1}`, x, Math.max(16, gridY - 18));
    }
  }

  if (rows > 1) {
    context.font = "600 16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(121, 99, 66, 0.88)";

    for (let row = 0; row < rows; row += 1) {
      const y = gridY + row * (cellHeight + cellGap) + cellHeight / 2;
      context.fillText(`行${row + 1}`, Math.max(18, gridX - 24), y);
    }
  }

  let cellIndex = 1;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = gridX + column * (cellWidth + cellGap);
      const y = gridY + row * (cellHeight + cellGap);

      context.fillStyle = "rgba(255, 244, 204, 0.9)";
      roundRectPath(context, x, y, cellWidth, cellHeight, cellRadius);
      context.fill();
      context.strokeStyle = "rgba(246, 189, 84, 0.55)";
      context.lineWidth = 2;
      context.setLineDash([8, 6]);
      context.stroke();
      context.setLineDash([]);

      const fontSize = Math.max(18, Math.min(42, Math.min(cellWidth, cellHeight) * 0.32));
      context.font = `700 ${fontSize}px sans-serif`;
      context.fillStyle = "#d48300";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(cellIndex), x + cellWidth / 2, y + cellHeight / 2);

      cellIndex += 1;
    }
  }
}

function buildCanvasReferenceImage(canvas) {
  if (!canvas) {
    return null;
  }

  const dataUrl = canvas.toDataURL("image/png");
  const [, data = ""] = dataUrl.split(",", 2);

  if (!data) {
    return null;
  }

  return {
    name: "layout-guide.png",
    mimeType: "image/png",
    data,
  };
}
function readSearchParam(key) {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(key) || "";
}

function reorderReferenceImages(items, startIndex, endIndex) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(startIndex, 1);
  nextItems.splice(endIndex, 0, movedItem);
  return nextItems;
}

function readLocalValue(key) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) || "";
}

function writeLocalValue(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
}

function buildDownloadName() {
  return buildDownloadNameWithOptions();
}

function getFileExtensionFromMimeType(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}

function buildDownloadNameWithOptions({ mimeType = "image/png", suffix = "" } = {}) {
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

  const safeSuffix = suffix ? `-${String(suffix).replace(/^-+/, "")}` : "";
  return `banana-${datePart}-${timePart}${safeSuffix}.${getFileExtensionFromMimeType(mimeType)}`;
}

function formatPersistedAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚保存";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildGalleryDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(firstValue, secondValue) {
  return buildGalleryDateKey(firstValue) === buildGalleryDateKey(secondValue);
}

function isWithinRecentDays(value, days) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return date >= start;
}

function isCurrentMonth(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function getFinderFilterDefinitions(records) {
  return [
    {
      id: "all",
      label: "全部图片",
      count: records.length,
      predicate: () => true,
    },
    {
      id: "today",
      label: "今天",
      count: records.filter((record) => isSameLocalDay(record.persistedAt, new Date())).length,
      predicate: (record) => isSameLocalDay(record.persistedAt, new Date()),
    },
    {
      id: "recent",
      label: "最近 7 天",
      count: records.filter((record) => isWithinRecentDays(record.persistedAt, 7)).length,
      predicate: (record) => isWithinRecentDays(record.persistedAt, 7),
    },
    {
      id: "month",
      label: "本月",
      count: records.filter((record) => isCurrentMonth(record.persistedAt)).length,
      predicate: (record) => isCurrentMonth(record.persistedAt),
    },
  ];
}

function estimateBase64Size(base64 = "") {
  if (!base64) {
    return 0;
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    const value = bytes / 1024;
    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} KB`;
  }

  const value = bytes / (1024 * 1024);
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} MB`;
}

function secondsToEstimateMs(seconds) {
  return Math.max(1000, Math.round(seconds * 1000));
}

function formatStreamPreviewText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "";
  }

  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || "请求失败，请稍后再试");
  }

  return data;
}

async function readFileAsReferenceImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsDataURL(file);
  });

  const [, base64 = ""] = dataUrl.split(",", 2);

  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
      .toString(36)
      .slice(2)}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || "image/png",
    previewUrl: dataUrl,
    data: base64,
  };
}

function buildPwHeaders(password) {
  const normalizedPassword = normalizeTextValue(password);

  if (!normalizedPassword) {
    return {};
  }

  return {
    "X-Banana-Pw": normalizedPassword,
  };
}

async function fetchBananaModels(password) {
  const response = await fetch("/api/models", {
    headers: buildPwHeaders(password),
  });

  return parseJsonResponse(response);
}

async function verifyPassword(password) {
  const response = await fetch("/api/access/session", {
    headers: buildPwHeaders(password),
  });

  return parseJsonResponse(response);
}

async function requestSseJsonStream(password, endpoint, payload, handlers = {}) {
  const abortController = new AbortController();
  let timeoutId = 0;
  let hasReceivedEvent = false;

  function clearStreamTimeout() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = 0;
    }
  }

  function armStreamTimeout() {
    clearStreamTimeout();
    timeoutId = window.setTimeout(() => {
      abortController.abort(
        hasReceivedEvent
          ? new Error("后端长时间没有继续返回状态，已停止等待。请重试，并查看后端日志。")
          : new Error("连接后端超时，请确认当前前后端服务仍在运行。"),
      );
    }, hasReceivedEvent ? SSE_INACTIVITY_TIMEOUT_MS : SSE_CONNECT_TIMEOUT_MS);
  }

  function handleSseEvent(eventName, data) {
    hasReceivedEvent = true;
    armStreamTimeout();

    if (eventName === "status") {
      handlers.onStatus?.(data);
      return null;
    }

    if (eventName === "text") {
      handlers.onText?.(data);
      return null;
    }

    if (eventName === "error") {
      throw new Error(data?.error || "请求失败，请稍后再试");
    }

    if (eventName === "result") {
      return data;
    }

    return null;
  }

  function drainSseBuffer(currentBuffer, flush = false) {
    let nextBuffer = currentBuffer;
    let nextFinalResult = null;

    while (nextBuffer.includes("\n\n")) {
      const boundaryIndex = nextBuffer.indexOf("\n\n");
      const rawEvent = nextBuffer.slice(0, boundaryIndex);
      nextBuffer = nextBuffer.slice(boundaryIndex + 2);

      const eventMatch = rawEvent.match(/^event:\s*(.+)$/m);
      const eventName = eventMatch?.[1]?.trim() || "message";
      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) {
        continue;
      }

      const eventResult = handleSseEvent(eventName, JSON.parse(dataLines.join("\n")));

      if (eventResult) {
        nextFinalResult = eventResult;
      }
    }

    if (flush && nextBuffer.trim()) {
      const eventMatch = nextBuffer.match(/^event:\s*(.+)$/m);
      const eventName = eventMatch?.[1]?.trim() || "message";
      const dataLines = nextBuffer
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length > 0) {
        const eventResult = handleSseEvent(eventName, JSON.parse(dataLines.join("\n")));

        if (eventResult) {
          nextFinalResult = eventResult;
        }
      }

      nextBuffer = "";
    }

    return {
      buffer: nextBuffer,
      finalResult: nextFinalResult,
    };
  }

  armStreamTimeout();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildPwHeaders(password),
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      clearStreamTimeout();
      return parseJsonResponse(response);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    let finalResult = null;

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          const drained = drainSseBuffer(buffer, true);
          buffer = drained.buffer;
          finalResult = drained.finalResult || finalResult;
          break;
        }

        armStreamTimeout();
        buffer += decoder.decode(value, { stream: true });

        const drained = drainSseBuffer(buffer);
        buffer = drained.buffer;
        finalResult = drained.finalResult || finalResult;
      }
    } finally {
      clearStreamTimeout();
      reader.releaseLock();
    }

    if (!finalResult) {
      throw new Error("流式请求已结束，但没有返回最终结果");
    }

    return finalResult;
  } catch (error) {
    clearStreamTimeout();

    if (abortController.signal.aborted) {
      throw abortController.signal.reason instanceof Error
        ? abortController.signal.reason
        : new Error("流式请求已中断");
    }

    throw error;
  }
}

async function requestGeneration(password, payload, handlers) {
  return requestSseJsonStream(password, "/api/generate/stream", payload, handlers);
}

async function requestEnhancement(password, payload, handlers) {
  return requestSseJsonStream(password, "/api/enhance/stream", payload, handlers);
}

function ReferenceCard({ image, index, onRemove, isDragging = false }) {
  return (
    <article className={`reference-card${isDragging ? " is-dragging" : ""}`}>
      <div className="reference-badge">{index + 1}</div>
      <button
        type="button"
        className="reference-close-button"
        aria-label={`移除参考图 ${index + 1}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(image.id);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        ×
      </button>
      <div className="reference-image-frame">
        <img src={image.previewUrl} alt={image.name} draggable="false" />
      </div>
      <button
        type="button"
        className="reference-remove-fallback"
        onClick={() => onRemove(image.id)}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        移除
      </button>
    </article>
  );
}

function getNextImageSize(currentSize, supportedSizes) {
  const availableSizes = IMAGE_SIZE_OPTIONS
    .map((option) => option.value)
    .filter((value) => supportedSizes.includes(value));
  const currentIndex = availableSizes.indexOf(currentSize);

  if (currentIndex === -1) {
    return availableSizes[0] || "";
  }

  return availableSizes[currentIndex + 1] || "";
}

function buildPersistedGenerationResultRecord(generationResult) {
  if (!generationResult?.imageBase64 || !generationResult?.mimeType) {
    return null;
  }

  const {
    previewUrl: _previewUrl,
    ...persistedRecord
  } = generationResult;

  return {
    ...persistedRecord,
    id: persistedRecord.id || createPersistedRecordId(),
    persistedAt: persistedRecord.persistedAt || new Date().toISOString(),
    downloadName:
      persistedRecord.downloadName ||
      buildDownloadNameWithOptions({
        mimeType: persistedRecord.mimeType,
        suffix: persistedRecord.batchSize > 1 ? persistedRecord.batchIndex + 1 : "",
      }),
  };
}

function restorePersistedGenerationResultRecord(record) {
  if (!record?.imageBase64 || !record?.mimeType) {
    return null;
  }

  return {
    ...record,
    id: record.id || createPersistedRecordId(),
    persistedAt: record.persistedAt || new Date().toISOString(),
    previewUrl: `data:${record.mimeType};base64,${record.imageBase64}`,
    downloadName:
      record.downloadName ||
      buildDownloadNameWithOptions({
        mimeType: record.mimeType,
        suffix: record.batchSize > 1 ? record.batchIndex + 1 : "",
      }),
  };
}

function getGeneratedResponseImages(data) {
  if (Array.isArray(data?.images) && data.images.length > 0) {
    return data.images
      .filter((image) => image?.imageBase64 && image?.mimeType)
      .map((image) => ({
        imageBase64: image.imageBase64,
        mimeType: image.mimeType,
      }));
  }

  if (data?.imageBase64 && data?.mimeType) {
    return [
      {
        imageBase64: data.imageBase64,
        mimeType: data.mimeType,
      },
    ];
  }

  return [];
}

function buildGeneratedImageRecords(data, extraFields = {}) {
  const responseImages = getGeneratedResponseImages(data);
  const savedRecords = Array.isArray(data?.savedRecords)
    ? data.savedRecords
    : data?.savedRecord
      ? [data.savedRecord]
      : [];
  const {
    images: _images,
    savedRecords: _savedRecords,
    imageBase64: _legacyImageBase64,
    mimeType: _legacyMimeType,
    savedRecord: _legacySavedRecord,
    ...sharedFields
  } = data || {};

  return responseImages
    .map((image, index) =>
      restorePersistedGenerationResultRecord({
        ...sharedFields,
        ...extraFields,
        ...image,
        id: createPersistedRecordId(),
        persistedAt: new Date().toISOString(),
        batchIndex: index,
        batchSize: responseImages.length,
        savedRecord: savedRecords[index] || null,
        downloadName: buildDownloadNameWithOptions({
          mimeType: image.mimeType,
          suffix: responseImages.length > 1 ? index + 1 : "",
        }),
      }),
    )
    .filter(Boolean);
}

function buildGeneratedImageRecord(data, extraFields = {}) {
  return buildGeneratedImageRecords(data, extraFields)[0] || null;
}

async function readPersistedGenerationLibrary() {
  const persistedRecords = await generationResultStorage.getItem(GENERATION_LIBRARY_RECORDS_KEY);

  if (!Array.isArray(persistedRecords)) {
    return [];
  }

  return persistedRecords
    .map(restorePersistedGenerationResultRecord)
    .filter(Boolean);
}

async function writePersistedGenerationLibrary(records) {
  const persistedRecords = records
    .map(buildPersistedGenerationResultRecord)
    .filter(Boolean);

  if (persistedRecords.length > 0) {
    await generationResultStorage.setItem(GENERATION_LIBRARY_RECORDS_KEY, persistedRecords);
    return;
  }

  await generationResultStorage.removeItem(GENERATION_LIBRARY_RECORDS_KEY);
}

async function writeLastGenerationRecordId(recordId) {
  if (recordId) {
    await generationResultStorage.setItem(LAST_GENERATION_RECORD_ID_KEY, recordId);
    return;
  }

  await generationResultStorage.removeItem(LAST_GENERATION_RECORD_ID_KEY);
}

async function readPersistedGenerationArtifacts() {
  let libraryRecords = await readPersistedGenerationLibrary();
  let lastRecordId = await generationResultStorage.getItem(LAST_GENERATION_RECORD_ID_KEY);

  if (!libraryRecords.length) {
    const legacyRecord = await generationResultStorage.getItem(LAST_GENERATION_RECORD_KEY);
    const restoredLegacyRecord = restorePersistedGenerationResultRecord(legacyRecord);

    if (restoredLegacyRecord) {
      libraryRecords = [restoredLegacyRecord];
      lastRecordId = restoredLegacyRecord.id;
      await Promise.all([
        writePersistedGenerationLibrary(libraryRecords),
        writeLastGenerationRecordId(restoredLegacyRecord.id),
        generationResultStorage.removeItem(LAST_GENERATION_RECORD_KEY),
      ]);
    }
  } else if (await generationResultStorage.getItem(LAST_GENERATION_RECORD_KEY)) {
    await generationResultStorage.removeItem(LAST_GENERATION_RECORD_KEY);
  }

  const currentRecord =
    libraryRecords.find((record) => record.id === lastRecordId) || libraryRecords[0] || null;

  if (currentRecord && currentRecord.id !== lastRecordId) {
    await writeLastGenerationRecordId(currentRecord.id);
  }

  return {
    libraryRecords,
    currentRecord,
  };
}

function ResourceCard({ record, onPreview, onDelete }) {
  const promptSummary = record.promptSnapshot?.trim() || "这张图没有记录 prompt。";
  const fileTitle = record.downloadName || `banana-${record.id}.png`;

  return (
    <article className="finder-item">
      <button
        type="button"
        className="finder-item-preview"
        onClick={() => onPreview(record)}
        aria-label="查看本地图片"
      >
        <img src={record.previewUrl} alt="本地保存的 banana 图片" draggable="false" />
      </button>
      <div className="finder-item-toolbar">
        <button type="button" className="finder-item-action" onClick={() => onPreview(record)}>
          预览
        </button>
        <a className="finder-item-action" href={record.previewUrl} download={record.downloadName}>
          下载
        </a>
        <button
          type="button"
          className="finder-item-action finder-item-action-danger"
          onClick={() => onDelete(record.id)}
        >
          删除
        </button>
      </div>
      <div className="finder-item-copy">
        <strong title={fileTitle}>{fileTitle}</strong>
        <span title={promptSummary}>
          {record.imageSize || "已保存"}
          {record.aspectRatio ? ` · ${record.aspectRatio}` : ""}
          {" · "}
          {formatBytes(estimateBase64Size(record.imageBase64))}
        </span>
        <small>{formatPersistedAt(record.persistedAt)}</small>
      </div>
    </article>
  );
}

function FinderSidebarItem({ item, isActive, onSelect }) {
  return (
    <button
      type="button"
      className={`finder-sidebar-item${isActive ? " is-active" : ""}`}
      onClick={() => onSelect(item.id)}
    >
      <span>{item.label}</span>
      <strong>{item.count}</strong>
    </button>
  );
}

function BananaStudioApp({ routeMode = "login" }) {
  const urlPassword = normalizeTextValue(readSearchParam("pw"));
  const shouldAutoVerifyStudioPassword = routeMode === "studio" && Boolean(urlPassword);
  const [password, setPassword] = useState(() => urlPassword);
  const [activePw, setActivePw] = useState("");
  const [sessionState, setSessionState] = useState(() =>
    shouldAutoVerifyStudioPassword ? "checking" : "locked",
  );
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(() =>
    readLocalValue(SELECTED_MODEL_STORAGE_KEY),
  );
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(() =>
    normalizeAspectRatioValue(readLocalValue(SELECTED_ASPECT_RATIO_STORAGE_KEY) || "1:1"),
  );
  const [layoutRows, setLayoutRows] = useState(() =>
    clampLayoutTrack(readLocalValue(SELECTED_LAYOUT_ROWS_STORAGE_KEY) || 1),
  );
  const [layoutColumns, setLayoutColumns] = useState(() =>
    clampLayoutTrack(readLocalValue(SELECTED_LAYOUT_COLUMNS_STORAGE_KEY) || 1),
  );
  const [selectedImageSize, setSelectedImageSize] = useState(() =>
    normalizeImageSizeValue(readLocalValue(SELECTED_IMAGE_SIZE_STORAGE_KEY) || "1K"),
  );
  const [selectedImageCount, setSelectedImageCount] = useState(() =>
    normalizeImageCountValue(readLocalValue(SELECTED_IMAGE_COUNT_STORAGE_KEY) || 1),
  );
  const [prompt, setPrompt] = useState(() => readLocalValue(PROMPT_STORAGE_KEY));
  const [referenceImages, setReferenceImages] = useState([]);
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState(null);
  const [studioError, setStudioError] = useState("");
  const [studioPending, setStudioPending] = useState(false);
  const [enhancePending, setEnhancePending] = useState(false);
  const [backendRequestCount, setBackendRequestCount] = useState(0);
  const [backendBusyLabel, setBackendBusyLabel] = useState("");
  const [backendBusyEstimateMs, setBackendBusyEstimateMs] = useState(secondsToEstimateMs(18));
  const [backendBusyStartedAt, setBackendBusyStartedAt] = useState(0);
  const [backendBusyTickAt, setBackendBusyTickAt] = useState(0);
  const [backendBusyStreamText, setBackendBusyStreamText] = useState("");
  const [generationResult, setGenerationResult] = useState(null);
  const [generationResults, setGenerationResults] = useState([]);
  const [generationLibrary, setGenerationLibrary] = useState([]);
  const [resourceManagerOpen, setResourceManagerOpen] = useState(false);
  const [resourceManagerFilter, setResourceManagerFilter] = useState("all");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewRecord, setImagePreviewRecord] = useState(null);
  const [imagePreviewDragging, setImagePreviewDragging] = useState(false);
  const [imagePreviewViewportSize, setImagePreviewViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const [imagePreviewNaturalSize, setImagePreviewNaturalSize] = useState({
    width: 0,
    height: 0,
  });
  const [imagePreviewTransform, setImagePreviewTransform] = useState({
    scale: MIN_PREVIEW_SCALE,
    x: 0,
    y: 0,
  });
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [referenceDragActive, setReferenceDragActive] = useState(false);
  const [promptMode, setPromptMode] = useState("simple");
  const layoutCanvasRef = useRef(null);
  const promptTextareaRef = useRef(null);
  const referenceGridRef = useRef(null);
  const imagePreviewViewportRef = useRef(null);
  const imagePreviewPointersRef = useRef(new Map());
  const imagePreviewPanRef = useRef(null);
  const imagePreviewPinchRef = useRef(null);
  const hasLayoutValues = Boolean(selectedAspectRatio && layoutRows > 0 && layoutColumns > 0);
  const previewRecord = imagePreviewRecord || generationResult;
  const isBackendBusy = backendRequestCount > 0;
  const backendBusyElapsedMs =
    isBackendBusy && backendBusyStartedAt
      ? Math.max(0, backendBusyTickAt - backendBusyStartedAt)
      : 0;
  const backendBusyRemainingMs = Math.max(0, backendBusyEstimateMs - backendBusyElapsedMs);
  const backendBusyRemainingSeconds = Math.ceil(backendBusyRemainingMs / 1000);
  const backendBusyProgressValue =
    backendBusyEstimateMs > 0
      ? Math.min(backendBusyElapsedMs / backendBusyEstimateMs, 1)
      : 0;
  const finderFilters = useMemo(() => {
    return getFinderFilterDefinitions(generationLibrary);
  }, [generationLibrary]);
  const activeFinderFilter = useMemo(() => {
    return finderFilters.find((item) => item.id === resourceManagerFilter) || finderFilters[0] || null;
  }, [finderFilters, resourceManagerFilter]);
  const filteredGenerationLibrary = useMemo(() => {
    if (!activeFinderFilter) {
      return generationLibrary;
    }

    return generationLibrary.filter(activeFinderFilter.predicate);
  }, [activeFinderFilter, generationLibrary]);
  const backendBusyOverlay = isBackendBusy ? (
    <div
      className="request-busy-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="request-busy-halo" aria-hidden="true" />
      <div className="request-busy-center">
        <div className="request-busy-chip">
          <div className="request-busy-row">
            <div className="request-busy-copy">
              <div className="request-busy-title">
                <span className="request-busy-orb" aria-hidden="true" />
                <strong>{backendBusyLabel || "banana 正在请求后端..."}</strong>
              </div>
              <span className="request-busy-meta">
                {backendBusyRemainingSeconds > 0
                  ? `预计还需 ${backendBusyRemainingSeconds} 秒`
                  : "预计即将完成"}
              </span>
            </div>
            <span className="request-busy-countdown">
              {backendBusyRemainingSeconds > 0 ? `${backendBusyRemainingSeconds}s` : "0s"}
            </span>
          </div>
          {backendBusyStreamText ? (
            <p className="request-busy-streamtext">{backendBusyStreamText}</p>
          ) : null}
          <div
            className={`request-busy-progress${backendBusyProgressValue >= 1 ? " is-complete" : ""}`}
            aria-hidden="true"
          >
            <span
              style={{
                transform: `scaleX(${Math.max(backendBusyProgressValue, 0.04)})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  ) : null;

  function beginBackendRequest(label, estimateMs = secondsToEstimateMs(18)) {
    const startedAt = Date.now();
    setBackendBusyLabel(label || "banana 正在请求后端...");
    setBackendBusyEstimateMs(estimateMs);
    setBackendBusyStartedAt(startedAt);
    setBackendBusyTickAt(startedAt);
    setBackendBusyStreamText("");
    setBackendRequestCount((currentValue) => currentValue + 1);

    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      setBackendRequestCount((currentValue) => Math.max(0, currentValue - 1));
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function restorePersistedImages() {
      try {
        const persistedArtifacts = await readPersistedGenerationArtifacts();

        if (cancelled) {
          return;
        }

        setGenerationLibrary(persistedArtifacts.libraryRecords);
        setGenerationResult(persistedArtifacts.currentRecord);
        setGenerationResults(persistedArtifacts.currentRecord ? [persistedArtifacts.currentRecord] : []);
      } catch (error) {
        console.warn("Restore persisted generation result failed:", error);
      }
    }

    void restorePersistedImages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (backendRequestCount !== 0 || !backendBusyLabel) {
      return;
    }

    setBackendBusyLabel("");
    setBackendBusyStartedAt(0);
    setBackendBusyTickAt(0);
    setBackendBusyStreamText("");
  }, [backendBusyLabel, backendRequestCount]);

  useEffect(() => {
    if (!isBackendBusy) {
      return;
    }

    setBackendBusyTickAt(Date.now());

    const intervalId = window.setInterval(() => {
      setBackendBusyTickAt(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isBackendBusy]);

  useEffect(() => {
    if (routeMode === "studio") {
      if (!urlPassword) {
        setActivePw("");
        setRemainingQuota(null);
        setSessionState("locked");
      }

      return;
    }

    setActivePw("");
    setRemainingQuota(null);
    setSessionState("locked");
  }, [routeMode, urlPassword]);

  useEffect(() => {
    if (!shouldAutoVerifyStudioPassword) {
      return;
    }

    let cancelled = false;
    setSessionState("checking");
    setAuthPending(true);
    setAuthError("");

    const releaseBackendRequest = beginBackendRequest(
      "正在校验提取码...",
      secondsToEstimateMs(3),
    );

    async function verifyStudioPassword() {
      try {
        const data = await verifyPassword(urlPassword);

        if (cancelled) {
          return;
        }

        setActivePw(urlPassword);
        setRemainingQuota(normalizeRemainingCredits(data?.pw?.remainingCredits));
        setSessionState("ready");
        setAuthError("");
      } catch {
        if (cancelled) {
          return;
        }

        setActivePw("");
        setRemainingQuota(null);
        setSessionState("locked");

        if (typeof window !== "undefined") {
          window.location.replace(LOGIN_PATH);
        }
      } finally {
        if (!cancelled) {
          releaseBackendRequest();
          setAuthPending(false);
        }
      }
    }

    void verifyStudioPassword();

    return () => {
      cancelled = true;
      releaseBackendRequest();
    };
  }, [shouldAutoVerifyStudioPassword, urlPassword]);

  useEffect(() => {
    if (sessionState !== "ready" || !activePw) {
      return;
    }

    let cancelled = false;

    async function loadModels() {
      const releaseBackendRequest = beginBackendRequest(
        "正在加载 banana 模型...",
        secondsToEstimateMs(4),
      );

      try {
        const data = await fetchBananaModels(activePw);

        if (cancelled) {
          return;
        }

        setModels(data.models || []);
        setSelectedModelId((currentValue) => {
          if (currentValue && data.models?.some((item) => item.id === currentValue)) {
            return currentValue;
          }

          const storedModelId = readLocalValue(SELECTED_MODEL_STORAGE_KEY);

          if (storedModelId && data.models?.some((item) => item.id === storedModelId)) {
            return storedModelId;
          }

          return data.models?.[0]?.id || "";
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStudioError(error instanceof Error ? error.message : "无法加载 banana 模型");
      } finally {
        releaseBackendRequest();
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [activePw, sessionState]);

  const selectedModel = useMemo(() => {
    return models.find((item) => item.id === selectedModelId) || null;
  }, [models, selectedModelId]);

  const availableAspectRatioOptions = useMemo(() => {
    return getModelAspectRatioOptions(selectedModel);
  }, [selectedModel]);

  const availableImageSizeOptions = useMemo(() => {
    return getModelImageSizeOptions(selectedModel);
  }, [selectedModel]);
  const layoutOrientation = useMemo(() => {
    return getLayoutOrientation(layoutRows, layoutColumns);
  }, [layoutColumns, layoutRows]);
  const aspectRatioOrientation = useMemo(() => {
    return getAspectRatioOrientation(selectedAspectRatio);
  }, [selectedAspectRatio]);
  const recommendedAspectRatios = useMemo(() => {
    return getRecommendedAspectRatiosForLayout(layoutRows, layoutColumns).filter((value) =>
      availableAspectRatioOptions.some((option) => option.value === value),
    );
  }, [availableAspectRatioOptions, layoutColumns, layoutRows]);
  const hasAspectRatioLayoutConflict = useMemo(() => {
    return (
      layoutRows * layoutColumns > 1 &&
      layoutOrientation !== "square" &&
      aspectRatioOrientation !== "square" &&
      layoutOrientation !== aspectRatioOrientation
    );
  }, [aspectRatioOrientation, layoutColumns, layoutOrientation, layoutRows]);

  const generationResultModel = useMemo(() => {
    if (!generationResult?.bananaModelId) {
      return null;
    }

    return models.find((item) => item.id === generationResult.bananaModelId) || null;
  }, [generationResult?.bananaModelId, models]);

  const enhancementTargetImageSize = useMemo(() => {
    if (!generationResult) {
      return "";
    }

    const supportedSizes = generationResultModel?.supportedImageSizes || ["1K"];
    return getNextImageSize(
      normalizeImageSizeValue(generationResult.imageSize || "1K"),
      supportedSizes,
    );
  }, [generationResult, generationResultModel]);

  const canEnhanceGeneration = Boolean(
    generationResult &&
      generationResultModel?.supportsImageSizeParam &&
      enhancementTargetImageSize,
  );

  const imagePreviewBaseStyle = useMemo(() => {
    const { width: naturalWidth, height: naturalHeight } = imagePreviewNaturalSize;
    const { width: viewportWidth, height: viewportHeight } = imagePreviewViewportSize;

    if (!naturalWidth || !naturalHeight || !viewportWidth || !viewportHeight) {
      return null;
    }

    const devicePixelRatio =
      typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
        ? window.devicePixelRatio
        : 1;
    const stageWidth = Math.max(viewportWidth - 48, 0);
    const stageHeight = Math.max(viewportHeight - 176, 0);
    const containScale = Math.min(
      stageWidth / naturalWidth,
      stageHeight / naturalHeight,
      1 / Math.max(devicePixelRatio, 1),
    );
    const safeScale = Number.isFinite(containScale) && containScale > 0 ? containScale : 1;

    return {
      width: `${naturalWidth * safeScale}px`,
      height: `${naturalHeight * safeScale}px`,
    };
  }, [imagePreviewNaturalSize, imagePreviewViewportSize]);

  useEffect(() => {
    writeLocalValue(SELECTED_MODEL_STORAGE_KEY, selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    if (!SUPPORTED_ASPECT_RATIO_VALUES.has(selectedAspectRatio)) {
      setSelectedAspectRatio("1:1");
      return;
    }

    writeLocalValue(SELECTED_ASPECT_RATIO_STORAGE_KEY, selectedAspectRatio);
  }, [selectedAspectRatio]);

  useEffect(() => {
    if (availableAspectRatioOptions.some((option) => option.value === selectedAspectRatio)) {
      return;
    }

    setSelectedAspectRatio(availableAspectRatioOptions[0]?.value || "1:1");
  }, [availableAspectRatioOptions, selectedAspectRatio]);

  useEffect(() => {
    writeLocalValue(SELECTED_LAYOUT_ROWS_STORAGE_KEY, String(layoutRows));
  }, [layoutRows]);

  useEffect(() => {
    writeLocalValue(SELECTED_LAYOUT_COLUMNS_STORAGE_KEY, String(layoutColumns));
  }, [layoutColumns]);

  useEffect(() => {
    if (!SUPPORTED_IMAGE_SIZE_VALUES.has(selectedImageSize)) {
      setSelectedImageSize("1K");
      return;
    }

    writeLocalValue(SELECTED_IMAGE_SIZE_STORAGE_KEY, selectedImageSize);
  }, [selectedImageSize]);

  useEffect(() => {
    if (availableImageSizeOptions.some((option) => option.value === selectedImageSize)) {
      return;
    }

    setSelectedImageSize(availableImageSizeOptions[0]?.value || "1K");
  }, [availableImageSizeOptions, selectedImageSize]);

  useEffect(() => {
    if (!SUPPORTED_IMAGE_COUNT_VALUES.has(selectedImageCount)) {
      setSelectedImageCount(1);
      return;
    }

    writeLocalValue(SELECTED_IMAGE_COUNT_STORAGE_KEY, String(selectedImageCount));
  }, [selectedImageCount]);

  useEffect(() => {
    writeLocalValue(PROMPT_STORAGE_KEY, prompt);
  }, [prompt]);

  useEffect(() => {
    if (!hasLayoutValues) {
      return;
    }

    drawLayoutGuide(layoutCanvasRef.current, {
      aspectRatio: selectedAspectRatio,
      rows: layoutRows,
      columns: layoutColumns,
    });
  }, [hasLayoutValues, layoutColumns, layoutRows, selectedAspectRatio]);

  useEffect(() => {
    const textarea = promptTextareaRef.current;

    if (!textarea) {
      return;
    }

    if (promptMode === "focus") {
      textarea.style.height = "100%";
      textarea.style.overflowY = "auto";
      return;
    }

    resizePromptTextarea(textarea);
  }, [prompt, promptMode]);

  useEffect(() => {
    if (promptMode !== "focus") {
      return;
    }

    const textarea = promptTextareaRef.current;

    if (!textarea) {
      return;
    }

    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, [promptMode]);

  useEffect(() => {
    if ((!imagePreviewOpen && !resourceManagerOpen) || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (imagePreviewOpen) {
      setImagePreviewViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (imagePreviewOpen) {
          closeImagePreview();
          return;
        }

        setResourceManagerOpen(false);
        return;
      }

      if (!imagePreviewOpen) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setImagePreviewTransform((currentValue) => ({
          ...currentValue,
          scale: clampPreviewScale(currentValue.scale + 0.4),
        }));
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        setImagePreviewTransform((currentValue) => {
          const nextScale = clampPreviewScale(currentValue.scale - 0.4);
          return {
            scale: nextScale,
            x: nextScale === MIN_PREVIEW_SCALE ? 0 : currentValue.x,
            y: nextScale === MIN_PREVIEW_SCALE ? 0 : currentValue.y,
          };
        });
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setImagePreviewTransform({
          scale: MIN_PREVIEW_SCALE,
          x: 0,
          y: 0,
        });
      }
    }

    function handleResize() {
      setImagePreviewViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [imagePreviewOpen, resourceManagerOpen]);

  useEffect(() => {
    if (!imagePreviewOpen) {
      return;
    }

    setImagePreviewTransform({
      scale: MIN_PREVIEW_SCALE,
      x: 0,
      y: 0,
    });
    setImagePreviewNaturalSize({
      width: 0,
      height: 0,
    });
    setImagePreviewDragging(false);
    imagePreviewPointersRef.current.clear();
    imagePreviewPanRef.current = null;
    imagePreviewPinchRef.current = null;
  }, [imagePreviewOpen, previewRecord?.previewUrl]);

  async function handleVerifySubmit(event) {
    event.preventDefault();
    setAuthPending(true);
    setAuthError("");
    const releaseBackendRequest = beginBackendRequest(
      "正在校验提取码...",
      secondsToEstimateMs(4),
    );

    try {
      const normalizedPassword = normalizeTextValue(password);
      const data = await verifyPassword(normalizedPassword);
      setActivePw(normalizedPassword);
      setRemainingQuota(normalizeRemainingCredits(data?.pw?.remainingCredits));
      setSessionState("ready");

      if (routeMode === "login" && typeof window !== "undefined") {
        const nextSearch = normalizedPassword
          ? `?pw=${encodeURIComponent(normalizedPassword)}`
          : "";
        window.location.replace(`${STUDIO_PATH}${nextSearch}`);
        return;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "提取码校验失败");
      setRemainingQuota(null);
      setSessionState("locked");
    } finally {
      releaseBackendRequest();
      setAuthPending(false);
    }
  }

  function handleLayoutCanvasMount(node) {
    layoutCanvasRef.current = node;

    if (!node || !hasLayoutValues) {
      return;
    }

    drawLayoutGuide(node, {
      aspectRatio: selectedAspectRatio,
      rows: layoutRows,
      columns: layoutColumns,
    });
  }

  function triggerRecordDownload(record) {
    if (!record?.previewUrl || typeof document === "undefined") {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = record.previewUrl;
    anchor.download = record.downloadName || buildDownloadNameWithOptions({
      mimeType: record.mimeType,
    });
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function appendReferenceFiles(files) {
    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const remainingSlots = MAX_REFERENCE_IMAGES - referenceImages.length;
      const nextFiles = imageFiles.slice(0, Math.max(remainingSlots, 0));

      if (nextFiles.length === 0) {
        setStudioError(`最多上传 ${MAX_REFERENCE_IMAGES} 张参考图`);
        return;
      }

      const parsedImages = await Promise.all(nextFiles.map(readFileAsReferenceImage));
      setReferenceImages((currentValue) => [...currentValue, ...parsedImages]);
      setStudioError("");
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "图片读取失败");
    }
  }

  async function handleFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    try {
      await appendReferenceFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  function handleUploadDragOver(event) {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }

    setUploadDragActive(true);
  }

  function handleUploadDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setUploadDragActive(false);
  }

  async function handleUploadDrop(event) {
    event.preventDefault();
    setUploadDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);

    if (files.length === 0) {
      return;
    }

    await appendReferenceFiles(files);
  }

  function handleRemoveReferenceImage(imageId) {
    setReferenceImages((currentValue) =>
      currentValue.filter((image) => image.id !== imageId),
    );
  }

  function scrollReferenceItemIntoView(index) {
    const container = referenceGridRef.current;

    if (!container || index < 0) {
      return;
    }

    const referenceItems = container.querySelectorAll("[data-reference-id]");
    const targetItem = referenceItems[index];

    if (!(targetItem instanceof HTMLElement)) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetItem.getBoundingClientRect();
    const edgePadding = 28;

    if (targetRect.right > containerRect.right - edgePadding) {
      container.scrollBy({
        left: targetRect.right - containerRect.right + edgePadding,
        behavior: "auto",
      });
      return;
    }

    if (targetRect.left < containerRect.left + edgePadding) {
      container.scrollBy({
        left: targetRect.left - containerRect.left - edgePadding,
        behavior: "auto",
      });
    }
  }

  function handleReferenceDragStart() {
    setReferenceDragActive(true);
  }

  function handleReferenceDragUpdate(update) {
    const { destination, source } = update;

    if (!destination) {
      return;
    }

    const targetIndex =
      destination.index > source.index
        ? Math.min(destination.index + 1, referenceImages.length - 1)
        : Math.max(destination.index - 1, 0);

    scrollReferenceItemIntoView(targetIndex);
  }

  function handleReferenceDragEnd(result) {
    setReferenceDragActive(false);
    const { destination, source } = result;

    if (!destination || destination.index === source.index) {
      return;
    }

    setReferenceImages((currentValue) =>
      reorderReferenceImages(currentValue, source.index, destination.index),
    );

    requestAnimationFrame(() => {
      scrollReferenceItemIntoView(destination.index);
    });
  }

  function setCurrentGenerationSelection(records, nextCurrentRecord = records[0] || null) {
    setGenerationResults(records);
    setGenerationResult(nextCurrentRecord);
  }

  async function persistGeneratedRecords(records, currentRecordId = records[0]?.id || "") {
    const nextLibraryRecords = [...records, ...generationLibrary];

    await Promise.all([
      writePersistedGenerationLibrary(nextLibraryRecords),
      writeLastGenerationRecordId(currentRecordId),
    ]);

    setGenerationLibrary(nextLibraryRecords);
  }

  async function persistGeneratedRecord(record) {
    if (!record) {
      return;
    }

    await persistGeneratedRecords([record], record.id);
  }

  function handleSelectGenerationResult(record) {
    if (!record?.id) {
      return;
    }

    setGenerationResult(record);
    void writeLastGenerationRecordId(record.id);
  }

  async function handleDeleteStoredRecord(recordId) {
    const nextLibraryRecords = generationLibrary.filter((record) => record.id !== recordId);
    const nextBatchResults = generationResults.some((record) => record.id === recordId)
      ? generationResults.filter((record) => record.id !== recordId)
      : generationResults;
    const nextStoredCurrentRecord =
      nextLibraryRecords.find((record) => record.id === generationResult?.id) ||
      nextLibraryRecords[0] ||
      null;
    const nextCurrentRecord =
      generationResult?.id === recordId
        ? nextBatchResults[0] || nextStoredCurrentRecord || null
        : generationResult || nextBatchResults[0] || nextStoredCurrentRecord;
    const normalizedNextBatchResults =
      nextBatchResults.length > 0
        ? nextBatchResults
        : nextCurrentRecord
          ? [nextCurrentRecord]
          : [];

    try {
      await Promise.all([
        writePersistedGenerationLibrary(nextLibraryRecords),
        writeLastGenerationRecordId(nextStoredCurrentRecord?.id || ""),
      ]);

      setGenerationLibrary(nextLibraryRecords);
      setCurrentGenerationSelection(normalizedNextBatchResults, nextCurrentRecord);

      if (
        imagePreviewOpen &&
        previewRecord?.id === recordId
      ) {
        closeImagePreview();
      }
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "本地资源删除失败");
    }
  }

  function togglePromptMode() {
    setPromptMode((currentValue) =>
      currentValue === "focus" ? "simple" : "focus",
    );
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (!prompt.trim()) {
      setStudioError("请输入你希望 banana 生成的画面要求");
      return;
    }

    if (!selectedModelId) {
      setStudioError("请先选择一个 banana 模型");
      return;
    }

    setStudioPending(true);
    setStudioError("");
    const releaseBackendRequest = beginBackendRequest(
      "banana 正在生图...",
      secondsToEstimateMs(60),
    );

    try {
      const payload = {
        modelId: selectedModelId,
        prompt,
        imageOptions: {
          aspectRatio: selectedAspectRatio,
          imageSize: selectedImageSize,
          imageCount: selectedImageCount,
          layoutRows,
          layoutColumns,
        },
        layoutGuideImage: hasLayoutValues ? buildCanvasReferenceImage(layoutCanvasRef.current) : null,
        referenceImages: referenceImages.map((image) => ({
          name: image.name,
          mimeType: image.mimeType,
          data: image.data,
        })),
      };

      const data = await requestGeneration(activePw, payload, {
        onStatus: (eventPayload) => {
          if (eventPayload?.message) {
            setBackendBusyLabel(eventPayload.message);
          }
        },
        onText: (eventPayload) => {
          const previewText = formatStreamPreviewText(
            eventPayload?.aggregatedText || eventPayload?.text,
          );

          if (previewText) {
            setBackendBusyStreamText(previewText);
          }
        },
      });
      const nextResults = buildGeneratedImageRecords(data, {
        promptSnapshot: prompt,
      });

      if (nextResults.length === 0) {
        throw new Error("banana 没有返回可用图片");
      }

      setCurrentGenerationSelection(nextResults, nextResults[0]);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));

      try {
        await persistGeneratedRecords(nextResults, nextResults[0].id);
      } catch (error) {
        console.warn("Persist generated result failed:", error);
        setStudioError("图片已生成，但写入本地资源管理器失败");
      }
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "banana 生图失败");
    } finally {
      releaseBackendRequest();
      setStudioPending(false);
    }
  }

  async function handleEnhanceGeneration() {
    if (!generationResult || !canEnhanceGeneration || !activePw) {
      return;
    }

    setEnhancePending(true);
    setStudioError("");
    const releaseBackendRequest = beginBackendRequest(
      enhancementTargetImageSize
        ? `正在提升到 ${enhancementTargetImageSize}...`
        : "正在提升清晰度...",
      secondsToEstimateMs(60),
    );

    try {
      const payload = {
        modelId: generationResult.bananaModelId,
        prompt: generationResult.promptSnapshot || prompt,
        sourceImage: {
          name: `enhance-source-${generationResult.savedRecord?.id || "current"}.png`,
          mimeType: generationResult.mimeType,
          data: generationResult.imageBase64,
        },
        imageOptions: {
          aspectRatio: generationResult.aspectRatio || selectedAspectRatio,
          imageSize: enhancementTargetImageSize,
          layoutRows: generationResult.layoutRows || layoutRows,
          layoutColumns: generationResult.layoutColumns || layoutColumns,
        },
      };
      const data = await requestEnhancement(activePw, payload, {
        onStatus: (eventPayload) => {
          if (eventPayload?.message) {
            setBackendBusyLabel(eventPayload.message);
          }
        },
        onText: (eventPayload) => {
          const previewText = formatStreamPreviewText(
            eventPayload?.aggregatedText || eventPayload?.text,
          );

          if (previewText) {
            setBackendBusyStreamText(previewText);
          }
        },
      });
      const nextResults = buildGeneratedImageRecords(
        {
          ...(generationResult || {}),
          ...data,
        },
        {
          promptSnapshot: generationResult?.promptSnapshot || prompt,
        },
      );

      const nextResult = nextResults[0];

      if (!nextResult) {
        throw new Error("banana 没有返回可用图片");
      }

      setCurrentGenerationSelection([nextResult], nextResult);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));

      try {
        await persistGeneratedRecord(nextResult);
      } catch (error) {
        console.warn("Persist enhanced result failed:", error);
        setStudioError("图片已生成，但写入本地资源管理器失败");
      }
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "提升清晰度失败");
    } finally {
      releaseBackendRequest();
      setEnhancePending(false);
    }
  }

  function openImagePreview(record = generationResult) {
    if (!record?.previewUrl) {
      return;
    }

    setImagePreviewRecord(record);
    setImagePreviewTransform({
      scale: MIN_PREVIEW_SCALE,
      x: 0,
      y: 0,
    });
    setImagePreviewDragging(false);
    imagePreviewPointersRef.current.clear();
    imagePreviewPanRef.current = null;
    imagePreviewPinchRef.current = null;
    setImagePreviewViewportSize({
      width: typeof window !== "undefined" ? window.innerWidth : 0,
      height: typeof window !== "undefined" ? window.innerHeight : 0,
    });
    setImagePreviewOpen(true);
  }

  function closeImagePreview() {
    setImagePreviewOpen(false);
    setImagePreviewRecord(null);
    setImagePreviewDragging(false);
    imagePreviewPointersRef.current.clear();
    imagePreviewPanRef.current = null;
    imagePreviewPinchRef.current = null;
  }

  function openResourceManager() {
    setResourceManagerOpen(true);
  }

  function handlePreviewStoredRecord(record) {
    setCurrentGenerationSelection([record], record);
    void writeLastGenerationRecordId(record.id);
    openImagePreview(record);
  }

  function getPreviewRelativePoint(clientPoint) {
    const viewport = imagePreviewViewportRef.current;

    if (!viewport) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();

    return {
      x: clientPoint.x - rect.left - rect.width / 2,
      y: clientPoint.y - rect.top - rect.height / 2,
    };
  }

  function getPreviewImagePoint(clientPoint, transform = imagePreviewTransform) {
    const relativePoint = getPreviewRelativePoint(clientPoint);

    if (!relativePoint) {
      return null;
    }

    return {
      x: (relativePoint.x - transform.x) / transform.scale,
      y: (relativePoint.y - transform.y) / transform.scale,
    };
  }

  function applyPreviewScale(nextScaleInput, anchorClientPoint = null) {
    setImagePreviewTransform((currentValue) => {
      const nextScale = clampPreviewScale(nextScaleInput);

      if (nextScale === currentValue.scale) {
        return currentValue;
      }

      if (!anchorClientPoint) {
        return {
          scale: nextScale,
          x: nextScale === MIN_PREVIEW_SCALE ? 0 : currentValue.x,
          y: nextScale === MIN_PREVIEW_SCALE ? 0 : currentValue.y,
        };
      }

      const anchorPoint = getPreviewRelativePoint(anchorClientPoint);

      if (!anchorPoint) {
        return {
          scale: nextScale,
          x: nextScale === MIN_PREVIEW_SCALE ? 0 : currentValue.x,
          y: nextScale === MIN_PREVIEW_SCALE ? 0 : currentValue.y,
        };
      }

      const scaleRatio = nextScale / currentValue.scale;
      const nextX = anchorPoint.x - (anchorPoint.x - currentValue.x) * scaleRatio;
      const nextY = anchorPoint.y - (anchorPoint.y - currentValue.y) * scaleRatio;

      return {
        scale: nextScale,
        x: nextScale === MIN_PREVIEW_SCALE ? 0 : nextX,
        y: nextScale === MIN_PREVIEW_SCALE ? 0 : nextY,
      };
    });
  }

  function handleImagePreviewWheel(event) {
    const delta = event.deltaY < 0 ? 0.24 : -0.24;
    applyPreviewScale(imagePreviewTransform.scale + delta, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleImagePreviewPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    imagePreviewPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (imagePreviewPointersRef.current.size === 1) {
      imagePreviewPanRef.current = {
        startPointer: { x: event.clientX, y: event.clientY },
        origin: {
          x: imagePreviewTransform.x,
          y: imagePreviewTransform.y,
        },
      };
      return;
    }

    if (imagePreviewPointersRef.current.size === 2) {
      const [firstPointer, secondPointer] = Array.from(
        imagePreviewPointersRef.current.values(),
      );
      const midpoint = {
        x: (firstPointer.x + secondPointer.x) / 2,
        y: (firstPointer.y + secondPointer.y) / 2,
      };
      const anchorImagePoint = getPreviewImagePoint(midpoint);

      if (!anchorImagePoint) {
        return;
      }

      imagePreviewPinchRef.current = {
        startDistance: Math.max(getPointerDistance(firstPointer, secondPointer), 1),
        startScale: imagePreviewTransform.scale,
        anchorImagePoint,
      };
      imagePreviewPanRef.current = null;
    }
  }

  function handleImagePreviewPointerMove(event) {
    if (!imagePreviewPointersRef.current.has(event.pointerId)) {
      return;
    }

    imagePreviewPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (imagePreviewPointersRef.current.size >= 2 && imagePreviewPinchRef.current) {
      const [firstPointer, secondPointer] = Array.from(
        imagePreviewPointersRef.current.values(),
      );
      const midpoint = {
        x: (firstPointer.x + secondPointer.x) / 2,
        y: (firstPointer.y + secondPointer.y) / 2,
      };
      const midpointRelativePoint = getPreviewRelativePoint(midpoint);

      if (!midpointRelativePoint) {
        return;
      }

      const nextScale = clampPreviewScale(
        imagePreviewPinchRef.current.startScale *
          (getPointerDistance(firstPointer, secondPointer) /
            imagePreviewPinchRef.current.startDistance),
      );

      setImagePreviewTransform({
        scale: nextScale,
        x:
          nextScale === MIN_PREVIEW_SCALE
            ? 0
            : midpointRelativePoint.x -
              imagePreviewPinchRef.current.anchorImagePoint.x * nextScale,
        y:
          nextScale === MIN_PREVIEW_SCALE
            ? 0
            : midpointRelativePoint.y -
              imagePreviewPinchRef.current.anchorImagePoint.y * nextScale,
      });
      setImagePreviewDragging(true);
      return;
    }

    if (!imagePreviewPanRef.current || imagePreviewTransform.scale <= MIN_PREVIEW_SCALE) {
      return;
    }

    const currentPan = imagePreviewPanRef.current;

    if (!currentPan) {
      return;
    }

    setImagePreviewTransform((currentValue) => ({
      ...currentValue,
      x:
        currentPan.origin.x +
        (event.clientX - currentPan.startPointer.x),
      y:
        currentPan.origin.y +
        (event.clientY - currentPan.startPointer.y),
    }));
    setImagePreviewDragging(true);
  }

  function handleImagePreviewPointerEnd(event) {
    imagePreviewPointersRef.current.delete(event.pointerId);

    if (imagePreviewPointersRef.current.size < 2) {
      imagePreviewPinchRef.current = null;
    }

    if (imagePreviewPointersRef.current.size === 1) {
      const [remainingPointer] = Array.from(imagePreviewPointersRef.current.values());
      imagePreviewPanRef.current = {
        startPointer: remainingPointer,
        origin: {
          x: imagePreviewTransform.x,
          y: imagePreviewTransform.y,
        },
      };
    } else {
      imagePreviewPanRef.current = null;
    }

    if (imagePreviewPointersRef.current.size === 0) {
      setImagePreviewDragging(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <div className="page-shell">
        <main className="status-card">
          <p className="eyebrow">BANANA ACCESS</p>
          <h1>正在校验提取码</h1>
          <p>如果当前 pw 仍有效，会自动进入 banana 工作台。</p>
          {generationResult ? (
            <div className="restored-result-card">
              <div className="restored-result-copy">
                <strong>已恢复上次结果</strong>
                <span>
                  {generationResult.imageSize || "已保存"} · {generationResult.aspectRatio || "原图"}
                </span>
              </div>
              <img
                className="restored-result-image"
                src={generationResult.previewUrl}
                alt="Restored Banana result"
              />
            </div>
          ) : null}
        </main>
        {backendBusyOverlay}
      </div>
    );
  }

  if (routeMode === "studio" && sessionState !== "ready" && !shouldAutoVerifyStudioPassword) {
    return <RouteRedirect to={LOGIN_PATH} />;
  }

  if (sessionState !== "ready") {
    return (
      <div className="page-shell">
        <main className="gate-layout">
          <section className="gate-hero">
            <p className="eyebrow">BANANA SHARE</p>
            <h1>输入提取码，进入香蕉生图空间</h1>
            <p className="hero-copy">
              支持从链接里的 <code>pw</code> 参数自动带入提取码。
              校验通过后，前端会进入 banana Studio，后端再代理 Gemini 生图能力。
            </p>
            <div className="hero-tags">
              <span>提取码验证</span>
              <span>多图参考</span>
              <span>Gemini 生图</span>
            </div>
          </section>

          <section className="gate-panel">
            <form className="gate-form" onSubmit={handleVerifySubmit}>
              <label htmlFor="password">提取码</label>
              <input
                id="password"
                name="password"
                type="text"
                autoComplete="one-time-code"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入提取码"
              />
              <button type="submit" disabled={authPending || !password.trim()}>
                {authPending ? "校验中..." : "进入"}
              </button>
              {authError ? <p className="error-text">{authError}</p> : null}
            </form>
            <p className="panel-note">
              当前链接参数自动填入值：
              <strong>{readSearchParam("pw") || "未提供"}</strong>
            </p>
          </section>
        </main>
        {backendBusyOverlay}
      </div>
    );
  }

  return (
    <div className="page-shell studio-shell">
      <header className="studio-topbar">
        <div>
          <h1>BANANA STUDIO</h1>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="resource-manager-trigger"
            onClick={openResourceManager}
            aria-label="打开资源管理器"
            title="资源管理器"
          >
            <span className="sr-only">资源管理器</span>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="8" height="18" x="3" y="3" rx="1" />
              <path d="M7 3v18" />
              <path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" />
            </svg>
            <span className="resource-manager-trigger-label" aria-hidden="true">
              库
            </span>
          </button>
        </div>
      </header>

      <main className="studio-layout">
        <section className="studio-panel result-panel">
          <div className="section-title">
            <h2>生成结果</h2>
            <p>完成后可以直接预览和下载。</p>
          </div>

          {generationResult ? (
            <div className="result-card">
              <div className="result-toolbar">
                {generationResult.imageSize ? (
                  <span className="result-chip">
                    {generationResults.length > 1 ? `已生成 ${generationResults.length} 张独立图片 · ` : ""}
                    {generationResult.imageSize} · {generationResult.aspectRatio}
                  </span>
                ) : null}
                <div className="result-toolbar-actions">
                  {canEnhanceGeneration ? (
                    <button
                      type="button"
                      className="enhance-button"
                      onClick={handleEnhanceGeneration}
                      disabled={enhancePending || studioPending}
                    >
                      {enhancePending
                        ? `提升到 ${enhancementTargetImageSize} 中...`
                        : `提升清晰度 · 目标 ${enhancementTargetImageSize}`}
                    </button>
                  ) : null}
                </div>
              </div>
              {generationResults.length > 1 ? (
                <div className="result-variant-grid">
                  {generationResults.map((record, index) => {
                    const isActive = record.id === generationResult.id;

                    return (
                      <button
                        key={record.id}
                        type="button"
                        className={`result-variant-button${isActive ? " is-active" : ""}`}
                        onClick={() => handleSelectGenerationResult(record)}
                        aria-pressed={isActive}
                      >
                        <span className="result-variant-media">
                          <img
                            className="result-variant-image"
                            src={record.previewUrl}
                            alt={`Banana generated variant ${index + 1}`}
                            draggable="false"
                          />
                          <span className="result-variant-label">{index + 1}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <button
                type="button"
                className="result-image-button"
                onClick={() => openImagePreview(generationResult)}
                aria-label="打开图片预览"
              >
                <img
                  className="result-image"
                  src={generationResult.previewUrl}
                  alt="Banana generated result"
                  draggable="false"
                />
              </button>
              <a
                className="download-link"
                href={generationResult.previewUrl}
                download={generationResult.downloadName}
              >
                下载图片
              </a>
            </div>
          ) : (
            <div className="empty-state">
              <p>结果区还没有图片。</p>
              <small>选好 banana 模型，上传参考图，写下要求后生成。</small>
            </div>
          )}
        </section>

        <section
          className={`studio-panel prompt-panel${promptMode === "focus" ? " is-focus-mode" : ""}`}
        >
          <form
            className={`prompt-form${promptMode === "focus" ? " is-focus-mode" : ""}`}
            onSubmit={handleGenerate}
          >
            <div className="prompt-field-header">
              <label className="field-label" htmlFor="prompt">
                文本要求
              </label>
              <button
                type="button"
                className={`prompt-mode-button${promptMode === "focus" ? " is-active" : ""}`}
                onClick={togglePromptMode}
                aria-label={promptMode === "focus" ? "退出专注输入模式" : "进入专注输入模式"}
                title={promptMode === "focus" ? "退出专注输入" : "进入专注输入"}
              >
                <span className="sr-only">
                  {promptMode === "focus" ? "退出专注输入模式" : "进入专注输入模式"}
                </span>
                {promptMode === "focus" ? (
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M7 3H3v4" />
                    <path d="M13 3h4v4" />
                    <path d="M17 13v4h-4" />
                    <path d="M3 13v4h4" />
                    <path d="M3 7l5-4" />
                    <path d="M17 7l-5-4" />
                    <path d="M17 13l-5 4" />
                    <path d="M3 13l5 4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M7 3H3v4" />
                    <path d="M13 3h4v4" />
                    <path d="M17 13v4h-4" />
                    <path d="M3 13v4h4" />
                    <path d="M3 7l5 5" />
                    <path d="M17 7l-5 5" />
                    <path d="M17 13l-5-5" />
                    <path d="M3 13l5-5" />
                  </svg>
                )}
              </button>
            </div>
            <textarea
              ref={promptTextareaRef}
              id="prompt"
              name="prompt"
              rows={PROMPT_TEXTAREA_MIN_ROWS}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (promptMode === "focus" && event.key === "Escape") {
                  event.preventDefault();
                  setPromptMode("simple");
                }
              }}
              placeholder="描述你想要的 banana 画面、风格、镜头、材质、色调和构图"
            />

            {promptMode === "focus" ? (
              <div className="focus-mode-note">按 `Esc` 也可以退出专注输入。</div>
            ) : null}

            {promptMode !== "focus" ? (
              <>
                <label
                  className={`upload-box${uploadDragActive ? " is-drag-active" : ""}`}
                  htmlFor="referenceImages"
                  onDragOver={handleUploadDragOver}
                  onDragLeave={handleUploadDragLeave}
                  onDrop={handleUploadDrop}
                >
                  <input
                    id="referenceImages"
                    name="referenceImages"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />
                  <span>上传参考图片（支持多图）</span>
                </label>

                {referenceImages.length > 0 ? (
                  <>
                    <DragDropContext
                      onDragStart={handleReferenceDragStart}
                      onDragUpdate={handleReferenceDragUpdate}
                      onDragEnd={handleReferenceDragEnd}
                    >
                      <Droppable
                        droppableId="reference-images"
                        direction="horizontal"
                        ignoreContainerClipping
                        renderClone={(provided, snapshot, rubric) => {
                          const cloneImage = referenceImages[rubric.source.index];

                          if (!cloneImage) {
                            return null;
                          }

                          return (
                            <div
                              ref={provided.innerRef}
                              className="reference-item reference-item-clone"
                              style={provided.draggableProps.style}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <ReferenceCard
                                image={cloneImage}
                                index={rubric.source.index}
                                onRemove={handleRemoveReferenceImage}
                                isDragging
                              />
                            </div>
                          );
                        }}
                      >
                        {(provided) => (
                          <div
                            ref={(node) => {
                              provided.innerRef(node);
                              referenceGridRef.current = node;
                            }}
                            className={`reference-grid${referenceDragActive ? " is-dragging" : ""}`}
                            {...provided.droppableProps}
                          >
                            {referenceImages.map((image, index) => (
                              <Draggable
                                key={image.id}
                                draggableId={image.id}
                                index={index}
                                disableInteractiveElementBlocking
                              >
                                {(draggableProvided, snapshot) => (
                                  <div
                                    ref={draggableProvided.innerRef}
                                    data-reference-id={image.id}
                                    className={`reference-item${snapshot.isDragging ? " is-dragging" : ""}`}
                                    style={draggableProvided.draggableProps.style}
                                    {...draggableProvided.draggableProps}
                                    {...draggableProvided.dragHandleProps}
                                  >
                                    <ReferenceCard
                                      image={image}
                                      index={index}
                                      onRemove={handleRemoveReferenceImage}
                                      isDragging={snapshot.isDragging}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </>
                ) : null}

                <label className="field-label field-label-inline" htmlFor="bananaModelSelector">
                  <span>底模选择</span>
                  {selectedModel ? (
                    <small className="model-helper-text">{selectedModel.description}</small>
                  ) : null}
                </label>
                <select
                  id="bananaModelSelector"
                  name="bananaModelSelector"
                  className="model-selector"
                  value={selectedModelId}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {model.priceLabel}
                    </option>
                  ))}
                </select>

                <div className="layout-config-card">
                  <div className="layout-control-row">
                    <label className="image-option-field layout-select-field" htmlFor="aspectRatioSelector">
                      <span className="field-label">图片比例</span>
                      <select
                        id="aspectRatioSelector"
                        name="aspectRatioSelector"
                        className="model-selector compact-selector"
                        value={selectedAspectRatio}
                        onChange={(event) => setSelectedAspectRatio(event.target.value)}
                      >
                        {availableAspectRatioOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="image-option-field image-size-field" htmlFor="imageSizeSelector">
                      <span className="field-label">分辨率</span>
                      <select
                        id="imageSizeSelector"
                        name="imageSizeSelector"
                        className="model-selector compact-selector"
                        value={selectedImageSize}
                        onChange={(event) => setSelectedImageSize(event.target.value)}
                      >
                        {availableImageSizeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="image-option-field image-count-field" htmlFor="imageCountSelector">
                      <span className="field-label">生成张数</span>
                      <select
                        id="imageCountSelector"
                        name="imageCountSelector"
                        className="model-selector compact-selector"
                        value={selectedImageCount}
                        onChange={(event) => setSelectedImageCount(normalizeImageCountValue(event.target.value))}
                      >
                        {IMAGE_COUNT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="image-option-field layout-track-field" htmlFor="layoutRows">
                      <span className="field-label">行数</span>
                      <select
                        id="layoutRows"
                        name="layoutRows"
                        className="model-selector compact-selector"
                        value={layoutRows}
                        onChange={(event) => setLayoutRows(clampLayoutTrack(event.target.value))}
                      >
                        {LAYOUT_TRACK_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="image-option-field layout-track-field" htmlFor="layoutColumns">
                      <span className="field-label">列数</span>
                      <select
                        id="layoutColumns"
                        name="layoutColumns"
                        className="model-selector compact-selector"
                        value={layoutColumns}
                        onChange={(event) => setLayoutColumns(clampLayoutTrack(event.target.value))}
                      >
                        {LAYOUT_TRACK_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="layout-preview-shell">
                    <div className="layout-preview-square">
                      <canvas
                        ref={handleLayoutCanvasMount}
                        className="layout-preview-canvas"
                        aria-label="布局预览"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {studioError ? <p className="error-text">{studioError}</p> : null}

            {promptMode !== "focus" ? (
              <>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={studioPending || !selectedModelId}
                >
                  {studioPending ? "banana 正在生图..." : "开始生成"}
                </button>
                {remainingQuota !== null ? (
                  <p className="quota-hint">剩余{remainingQuota}张额度</p>
                ) : null}
              </>
            ) : null}
          </form>
        </section>
      </main>
      {resourceManagerOpen ? (
        <div
          className="resource-manager-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="资源管理器"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setResourceManagerOpen(false);
            }
          }}
        >
          <section className="resource-manager-panel">
            <div className="resource-manager-windowbar">
              <span className="finder-window-spacer" aria-hidden="true" />
              <strong>资源管理器</strong>
              <button
                type="button"
                className="finder-close-button"
                onClick={() => setResourceManagerOpen(false)}
                aria-label="关闭资源管理器"
                title="关闭"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="finder-layout">
              <aside className="finder-sidebar">
                <div className="finder-sidebar-group">
                  <div className="finder-sidebar-list">
                    {finderFilters.map((item) => (
                      <FinderSidebarItem
                        key={item.id}
                        item={item}
                        isActive={activeFinderFilter?.id === item.id}
                        onSelect={setResourceManagerFilter}
                      />
                    ))}
                  </div>
                </div>

              </aside>

              <section className="finder-browser">
                <div className="finder-browser-toolbar">
                  <div className="finder-browser-title">
                    <strong>{activeFinderFilter?.label || "全部图片"}</strong>
                    <span>
                      {filteredGenerationLibrary.length} 个项目
                    </span>
                  </div>
                  <div className="finder-browser-meta">
                    <span>按保存时间排序</span>
                    <span>{new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date())}</span>
                  </div>
                </div>

                {filteredGenerationLibrary.length > 0 ? (
                  <div className="finder-grid">
                    {filteredGenerationLibrary.map((record) => (
                      <ResourceCard
                        key={record.id}
                        record={record}
                        onPreview={handlePreviewStoredRecord}
                        onDelete={handleDeleteStoredRecord}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state resource-empty-state">
                    <p>当前分组里还没有图片。</p>
                    <small>换一个边栏分组，或者先生成一张图。</small>
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
      {imagePreviewOpen && previewRecord ? (
        <div
          className="image-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeImagePreview();
            }
          }}
        >
          <div className="image-preview-topbar">
            <div className="image-preview-status">
              <strong>图片预览</strong>
              <span>{Math.round(imagePreviewTransform.scale * 100)}%</span>
            </div>
            <div className="image-preview-actions">
              <a
                className="image-preview-action"
                href={previewRecord.previewUrl}
                download={previewRecord.downloadName}
              >
                下载
              </a>
              <button
                type="button"
                className="image-preview-action"
                onClick={() =>
                  setImagePreviewTransform({
                    scale: MIN_PREVIEW_SCALE,
                    x: 0,
                    y: 0,
                  })
                }
              >
                还原
              </button>
              <button
                type="button"
                className="image-preview-action image-preview-delete"
                onClick={() => {
                  if (previewRecord?.id) {
                    void handleDeleteStoredRecord(previewRecord.id);
                  }
                }}
              >
                删除
              </button>
              <button
                type="button"
                className="image-preview-action image-preview-close"
                onClick={closeImagePreview}
              >
                退出
              </button>
            </div>
          </div>

          <div
            ref={imagePreviewViewportRef}
            className={`image-preview-stage${imagePreviewDragging ? " is-dragging" : ""}`}
            onWheel={handleImagePreviewWheel}
            onPointerDown={handleImagePreviewPointerDown}
            onPointerMove={handleImagePreviewPointerMove}
            onPointerUp={handleImagePreviewPointerEnd}
            onPointerCancel={handleImagePreviewPointerEnd}
            onPointerLeave={handleImagePreviewPointerEnd}
            onDoubleClick={(event) => {
              const targetScale =
                imagePreviewTransform.scale > MIN_PREVIEW_SCALE ? MIN_PREVIEW_SCALE : 2;

              applyPreviewScale(targetScale, {
                x: event.clientX,
                y: event.clientY,
              });
            }}
          >
            <img
              className="image-preview-media"
              src={previewRecord.previewUrl}
              alt="Banana generated preview"
              draggable="false"
              onLoad={(event) => {
                setImagePreviewNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
              style={{
                ...(imagePreviewBaseStyle || {}),
                transform: `translate(${imagePreviewTransform.x}px, ${imagePreviewTransform.y}px) scale(${imagePreviewTransform.scale})`,
              }}
            />
          </div>

          <div className="image-preview-zoombar">
            <button
              type="button"
              className="image-preview-action"
              onClick={() => applyPreviewScale(imagePreviewTransform.scale - 0.4)}
            >
              -
            </button>
            <button
              type="button"
              className="image-preview-action"
              onClick={() =>
                setImagePreviewTransform({
                  scale: MIN_PREVIEW_SCALE,
                  x: 0,
                  y: 0,
                })
              }
            >
              {Math.round(imagePreviewTransform.scale * 100)}%
            </button>
            <button
              type="button"
              className="image-preview-action"
              onClick={() => applyPreviewScale(imagePreviewTransform.scale + 0.4)}
            >
              +
            </button>
          </div>
        </div>
      ) : null}
      {backendBusyOverlay}
    </div>
  );
}

function RouteRedirect({ to }) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const targetUrl = `${to}${window.location.search || ""}${window.location.hash || ""}`;

    if (window.location.pathname === to) {
      return;
    }

    window.location.replace(targetUrl);
  }, [to]);

  return (
    <div className="page-shell">
      <main className="status-card">
        <p className="eyebrow">BANANA STUDIO</p>
        <h1>正在跳转</h1>
        <p>正在进入 Banana Studio...</p>
      </main>
    </div>
  );
}

function App() {
  const pathname =
    typeof window !== "undefined" && typeof window.location?.pathname === "string"
      ? window.location.pathname
      : "/";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminApp />;
  }

  if (pathname === "/" || pathname === "") {
    return <RouteRedirect to={LOGIN_PATH} />;
  }

  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return <BananaStudioApp routeMode="login" />;
  }

  if (pathname === STUDIO_PATH || pathname.startsWith(`${STUDIO_PATH}/`)) {
    return <BananaStudioApp routeMode="studio" />;
  }

  return <RouteRedirect to={LOGIN_PATH} />;
}

export default App;
