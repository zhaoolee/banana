import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSwappingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import localforage from "localforage";
import AdminApp from "./AdminApp.jsx";
import {
  canRetryRequestTask,
  getRequestTaskRetryHandler,
  isRequestTaskTerminal,
  normalizeRequestTaskProgress,
  setRequestTaskRetryHandler,
  useTaskStore,
} from "./stores/taskStore.js";
import { getProfessionalExportLayoutMetrics } from "../shared/professionalExportLayout.js";

const LOGIN_PATH = "/login";
const STUDIO_PATH = "/studio";
const PANEL_MODE_STORAGE_KEY = "banana.panelMode";
const LEGACY_SELECTED_MODEL_STORAGE_KEY = "banana.selectedModelId";
const LEGACY_SELECTED_ASPECT_RATIO_STORAGE_KEY = "banana.selectedAspectRatio";
const LEGACY_SELECTED_LAYOUT_ROWS_STORAGE_KEY = "banana.selectedLayoutRows";
const LEGACY_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY = "banana.selectedLayoutColumns";
const LEGACY_SELECTED_IMAGE_SIZE_STORAGE_KEY = "banana.selectedImageSize";
const LEGACY_SELECTED_IMAGE_COUNT_STORAGE_KEY = "banana.selectedImageCount";
const LEGACY_PROMPT_STORAGE_KEY = "banana.prompt";
const PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY = "banana.professional.selectedModelId";
const PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY = "banana.professional.globalPrompt";
const PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY = "banana.professional.canvasSize";
const PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY = "banana.professional.customScenarios";
const PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY = "banana.professional.customCanvasWidth";
const PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY = "banana.professional.customCanvasHeight";
const PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY = "banana.professional.selectedLayoutRows";
const PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY = "banana.professional.selectedLayoutColumns";
const PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY = "banana.professional.storyboardAspectRatio";
const PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY = "banana.professional.storyboardImageSize";
const PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY = "banana.professional.storyboardDividerWidth";
const PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY = "banana.professional.storyboardCaptionFontSize";
const PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY = "banana.professional.storyboardCaptionBackgroundAlpha";
const PROFESSIONAL_SELECTED_IMAGE_SIZE_STORAGE_KEY = "banana.professional.selectedImageSize";
const PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY = "banana.professional.selectedImageCount";
const PROFESSIONAL_STORYBOARD_CELLS_STORAGE_KEY = "professionalStoryboardCells";
const PROFESSIONAL_REFERENCE_IMAGES_STORAGE_KEY = "professionalReferenceImages";
const SIMPLE_REFERENCE_IMAGES_STORAGE_KEY = "simpleReferenceImages";
const SIMPLE_PROMPT_STORAGE_KEY = "banana.simple.prompt";
const LAST_GENERATION_DB_NAME = "banana.studio";
const LAST_GENERATION_STORE_NAME = "app";
const LAST_GENERATION_RECORD_KEY = "lastGenerationResult";
const GENERATION_LIBRARY_RECORDS_KEY = "generationLibraryRecords";
const LAST_GENERATION_RECORD_ID_KEY = "lastGenerationRecordId";
const MAX_REFERENCE_IMAGES = 12;
const MAX_LAYOUT_TRACKS = 8;
const VERTEX_INLINE_IMAGE_MAX_BYTES = 7 * 1024 * 1024;
const REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES = Math.floor(VERTEX_INLINE_IMAGE_MAX_BYTES * 0.78);
const REFERENCE_IMAGE_MAX_LONG_EDGE_PX = 2560;
const REFERENCE_IMAGE_MIN_LONG_EDGE_PX = 1280;
const REFERENCE_IMAGE_JPEG_QUALITY_STEPS = [0.82, 0.76, 0.7, 0.64, 0.58];
const REFERENCE_IMAGE_RESIZE_STEPS = [1, 0.9, 0.82, 0.74];
const PROMPT_TEXTAREA_MIN_ROWS = 2;
const PROMPT_TEXTAREA_MAX_ROWS = 5;
const PANEL_MODE_SIMPLE = "simple";
const PANEL_MODE_PROFESSIONAL = "professional";
const CUSTOM_CANVAS_SIZE_VALUE = "custom";
const STORYBOARD_EDITOR_MODE_GENERATE = "generate";
const STORYBOARD_EDITOR_MODE_ASSET = "asset";
const PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO = "1:1";
const PROFESSIONAL_STYLE_REFERENCE_LIMIT = 1;
const STORYBOARD_CELL_REFERENCE_LIMIT = 1;
const PROFESSIONAL_SCENE_ARCHIVE_KIND = "banana.professional.scene";
const PROFESSIONAL_SCENE_ARCHIVE_VERSION = 1;
const DEFAULT_CUSTOM_CANVAS_WIDTH = 1080;
const DEFAULT_CUSTOM_CANVAS_HEIGHT = 1440;
const DEFAULT_STORYBOARD_DIVIDER_WIDTH_PX = 2;
const MIN_STORYBOARD_DIVIDER_WIDTH_PX = 0;
const MAX_STORYBOARD_DIVIDER_WIDTH_PX = 8;
const DEFAULT_STORYBOARD_CAPTION_FONT_SIZE_PERCENT = 100;
const MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT = 70;
const MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT = 440;
const DEFAULT_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT = 90;
const MIN_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT = 72;
const MAX_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT = 100;
const STORYBOARD_DRAG_ACTIVATION_DISTANCE_PX = 6;
const STORYBOARD_MOBILE_DRAG_ACTIVATION_DELAY_MS = 220;
const STORYBOARD_MOBILE_DRAG_TOLERANCE_PX = 8;
const STORYBOARD_DRAG_CLICK_SUPPRESSION_MS = 240;
const SIMPLE_PANEL_DEFAULTS = {
  modelId: "nano-banana-2",
  aspectRatio: "3:4",
  imageSize: "1K",
  imageCount: 2,
  layoutRows: 1,
  layoutColumns: 1,
};
const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "方图 1:1" },
  { value: "1:4", label: "超长竖 1:4" },
  { value: "1:8", label: "极长竖 1:8" },
  { value: "2:3", label: "竖版 2:3" },
  { value: "3:2", label: "横版 3:2" },
  { value: "4:3", label: "横版 4:3" },
  { value: "3:4", label: "小红书封面 3:4（1080 x 1440）" },
  { value: "4:1", label: "超宽 4:1" },
  { value: "4:5", label: "竖版 4:5" },
  { value: "5:4", label: "横版 5:4" },
  { value: "8:1", label: "极宽 8:1" },
  { value: "16:9", label: "横版 16:9" },
  { value: "9:16", label: "竖版 9:16" },
  { value: "21:9", label: "超宽 21:9" },
];
const CANVAS_SIZE_OPTIONS = [
  {
    value: "programmer-lv1-lv7",
    label: "程序员LV1到LV7",
    width: 1088,
    height: 3936,
    layoutRows: 7,
    layoutColumns: 1,
  },
  {
    value: "xiaohongshu-cover",
    label: "小红书封面",
    width: 1080,
    height: 1440,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "xiaohongshu-cover-8-grid",
    label: "小红书封面8宫格",
    width: 1080,
    height: 1440,
    layoutRows: 2,
    layoutColumns: 4,
  },
  {
    value: "xiaohongshu-cover-4-grid",
    label: "小红书封面4宫格",
    width: 1080,
    height: 1440,
    layoutRows: 4,
    layoutColumns: 1,
  },
  {
    value: "square-logo",
    label: "方形LOGO",
    width: 1024,
    height: 1024,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "logo-selection-8-grid",
    label: "LOGO选品8宫格",
    width: 2048,
    height: 4096,
    layoutRows: 4,
    layoutColumns: 2,
  },
  {
    value: "phone-wallpaper",
    label: "手机壁纸",
    width: 1440,
    height: 3200,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "pc-wallpaper",
    label: "PC壁纸",
    width: 3840,
    height: 2160,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "ipad-wallpaper",
    label: "iPad壁纸",
    width: 2732,
    height: 2048,
    layoutRows: 1,
    layoutColumns: 1,
  },
];
const REQUEST_TASK_RECOVERY_STALE_AFTER_MS = 4 * 60 * 1000;
const SUPPORTED_ASPECT_RATIO_VALUES = new Set(ASPECT_RATIO_OPTIONS.map((option) => option.value));
const SUPPORTED_CANVAS_SIZE_VALUES = new Set(CANVAS_SIZE_OPTIONS.map((option) => option.value));
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

function createClientRequestId() {
  return createPersistedRecordId();
}

function normalizeAspectRatioValue(value) {
  return SUPPORTED_ASPECT_RATIO_VALUES.has(value) ? value : "1:1";
}

function normalizePanelModeValue(value) {
  return value === PANEL_MODE_SIMPLE || value === PANEL_MODE_PROFESSIONAL
    ? value
    : PANEL_MODE_PROFESSIONAL;
}

function normalizeImageSizeValue(value) {
  return SUPPORTED_IMAGE_SIZE_VALUES.has(value) ? value : "1K";
}

function normalizeImageCountValue(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return SUPPORTED_IMAGE_COUNT_VALUES.has(parsedValue) ? parsedValue : 1;
}

function normalizeCanvasDimensionValue(value, fallbackValue) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.min(Math.max(parsedValue, 64), 10000);
}

function normalizeStoryboardCaptionFontSizePercent(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_STORYBOARD_CAPTION_FONT_SIZE_PERCENT;
  }

  return Math.min(
    Math.max(parsedValue, MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT),
    MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT,
  );
}

function normalizeStoryboardDividerWidthPx(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_STORYBOARD_DIVIDER_WIDTH_PX;
  }

  return Math.min(
    Math.max(parsedValue, MIN_STORYBOARD_DIVIDER_WIDTH_PX),
    MAX_STORYBOARD_DIVIDER_WIDTH_PX,
  );
}

function normalizeStoryboardCaptionBackgroundAlphaPercent(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT;
  }

  return Math.min(
    Math.max(parsedValue, MIN_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT),
    MAX_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT,
  );
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

function resolveSimplePanelModelId(models, fallbackModelId) {
  if (!Array.isArray(models) || models.length === 0) {
    return fallbackModelId || "";
  }

  if (models.some((item) => item.id === SIMPLE_PANEL_DEFAULTS.modelId)) {
    return SIMPLE_PANEL_DEFAULTS.modelId;
  }

  if (fallbackModelId && models.some((item) => item.id === fallbackModelId)) {
    return fallbackModelId;
  }

  return models[0]?.id || "";
}

function resolveCanvasSizeFromLegacyAspectRatio(aspectRatioValue) {
  return aspectRatioValue === "3:4" ? "xiaohongshu-cover" : "programmer-lv1-lv7";
}

function getCanvasSizeOption(
  value,
  customWidth = DEFAULT_CUSTOM_CANVAS_WIDTH,
  customHeight = DEFAULT_CUSTOM_CANVAS_HEIGHT,
  customScenarios = [],
  customLayoutRows = 1,
  customLayoutColumns = 1,
) {
  if (value === CUSTOM_CANVAS_SIZE_VALUE) {
    const width = normalizeCanvasDimensionValue(customWidth, DEFAULT_CUSTOM_CANVAS_WIDTH);
    const height = normalizeCanvasDimensionValue(customHeight, DEFAULT_CUSTOM_CANVAS_HEIGHT);

    return {
      value: CUSTOM_CANVAS_SIZE_VALUE,
      label: `自定义场景 ${width} x ${height}`,
      width,
      height,
      layoutRows: clampLayoutTrack(customLayoutRows),
      layoutColumns: clampLayoutTrack(customLayoutColumns),
    };
  }

  return [...CANVAS_SIZE_OPTIONS, ...customScenarios].find((option) => option.value === value) ||
    CANVAS_SIZE_OPTIONS[0];
}

function getCanvasScenarioOption(value, customScenarios = []) {
  if (value === CUSTOM_CANVAS_SIZE_VALUE) {
    return {
      value: CUSTOM_CANVAS_SIZE_VALUE,
      label: "自定义场景",
      layoutRows: 1,
      layoutColumns: 1,
    };
  }

  return [...CANVAS_SIZE_OPTIONS, ...customScenarios].find((option) => option.value === value) ||
    CANVAS_SIZE_OPTIONS[0];
}

function normalizeCanvasScenarioValue(value, customScenarios = []) {
  const customScenarioIds = new Set(customScenarios.map((scenario) => scenario.value));

  return SUPPORTED_CANVAS_SIZE_VALUES.has(value) ||
    customScenarioIds.has(value)
    ? value
    : CANVAS_SIZE_OPTIONS[0].value;
}

function buildLayoutCells(rows, columns) {
  return Array.from({ length: rows * columns }, (_value, index) => index + 1);
}

function buildStoryboardCellDefinitions(rows, columns) {
  return buildLayoutCells(rows, columns).map((index) => {
    const row = Math.floor((index - 1) / columns) + 1;
    const column = ((index - 1) % columns) + 1;

    return {
      id: `storyboard-cell-${row}-${column}`,
      index,
      row,
      column,
      label: `第 ${index} 格`,
      coordinateLabel: `${row}-${column}`,
    };
  });
}

function createStoryboardCellState(definition) {
  return {
    ...definition,
    prompt: "",
    caption: "",
    referenceImages: [],
    pendingRequestId: "",
    status: "idle",
    statusText: "",
    error: "",
    record: null,
  };
}

function findStoryboardCellIdByPendingRequestId(cells, requestId) {
  const normalizedRequestId = normalizeTextValue(requestId);

  if (!cells || typeof cells !== "object" || !normalizedRequestId) {
    return "";
  }

  return (
    Object.entries(cells).find(
      ([, cell]) => normalizeTextValue(cell?.pendingRequestId) === normalizedRequestId,
    )?.[0] || ""
  );
}

function shouldPreserveRuntimeStoryboardCell(cell) {
  return Boolean(
    cell?.record ||
      normalizeTextValue(cell?.pendingRequestId) ||
      cell?.status === "loading" ||
      normalizeTextValue(cell?.statusText) ||
      normalizeTextValue(cell?.error),
  );
}

function mergeHydratedStoryboardCells(persistedCells, currentCells, rows, columns) {
  const normalizedPersistedCells = normalizeStoryboardCells(persistedCells, rows, columns);
  const normalizedCurrentCells = normalizeStoryboardCells(currentCells, rows, columns);

  return Object.fromEntries(
    Object.keys(normalizedPersistedCells).map((cellId) => {
      const persistedCell = normalizedPersistedCells[cellId];
      const currentCell = normalizedCurrentCells[cellId];

      if (!shouldPreserveRuntimeStoryboardCell(currentCell)) {
        return [cellId, persistedCell];
      }

      return [
        cellId,
        {
          ...persistedCell,
          ...currentCell,
          prompt: normalizeTextValue(currentCell?.prompt) || persistedCell.prompt,
          caption: typeof currentCell?.caption === "string" && currentCell.caption
            ? currentCell.caption
            : persistedCell.caption,
          pendingRequestId:
            normalizeTextValue(currentCell?.pendingRequestId) || persistedCell.pendingRequestId,
          referenceImages:
            Array.isArray(currentCell?.referenceImages) && currentCell.referenceImages.length > 0
              ? currentCell.referenceImages
              : persistedCell.referenceImages,
          record: currentCell?.record || persistedCell.record,
        },
      ];
    }),
  );
}

function buildStoryboardCellTaskPatch(task, currentCell) {
  if (!task) {
    return null;
  }

  if (
    task.status === "queued" ||
    task.status === "accepted" ||
    task.status === "processing" ||
    task.status === "saving"
  ) {
    return {
      status: "loading",
      statusText: task.message || "banana 正在生图...",
      error: "",
      pendingRequestId:
        normalizeTextValue(currentCell?.pendingRequestId) || normalizeTextValue(task?.requestId),
    };
  }

  if (task.status === "failed") {
    return {
      status: currentCell?.record ? "success" : "idle",
      statusText: "",
      error: task.error || task.message || "banana 生图失败",
      pendingRequestId: "",
    };
  }

  if (task.status === "cancelled") {
    return {
      status: currentCell?.record ? "success" : "idle",
      statusText: task.message || "已取消当前任务",
      error: "",
      pendingRequestId: "",
    };
  }

  if (task.status === "recovered" || task.status === "succeeded") {
    if (currentCell?.record) {
      return {
        status: "success",
        statusText:
          currentCell.statusText || task.message || "已恢复上一次请求的图片结果",
        error: "",
        pendingRequestId: "",
      };
    }

    return {
      status: "loading",
      statusText: task.message || "banana 已完成任务，正在恢复图片...",
      error: "",
      pendingRequestId:
        normalizeTextValue(currentCell?.pendingRequestId) || normalizeTextValue(task?.requestId),
    };
  }

  return null;
}

function doesStoryboardCellHaveContent(cell) {
  return Boolean(
    normalizeTextValue(cell?.prompt) ||
      normalizeTextValue(cell?.caption) ||
      (Array.isArray(cell?.referenceImages) && cell.referenceImages.length > 0) ||
      cell?.record,
  );
}

function buildStoryboardCellContentSnapshot(cell) {
  return {
    prompt: typeof cell?.prompt === "string" ? cell.prompt : "",
    caption: typeof cell?.caption === "string" ? cell.caption : "",
    referenceImages: Array.isArray(cell?.referenceImages)
      ? cell.referenceImages.slice(0, STORYBOARD_CELL_REFERENCE_LIMIT)
      : [],
    status:
      cell?.status === "loading" || cell?.status === "success" ? cell.status : "idle",
    statusText: typeof cell?.statusText === "string" ? cell.statusText : "",
    error: typeof cell?.error === "string" ? cell.error : "",
    pendingRequestId: normalizeTextValue(cell?.pendingRequestId),
    record: cell?.record || null,
  };
}

function swapStoryboardCellContent(currentCells, sourceCellId, targetCellId) {
  const sourceCell = currentCells[sourceCellId];
  const targetCell = currentCells[targetCellId];

  if (
    !sourceCell ||
    !targetCell ||
    sourceCellId === targetCellId ||
    sourceCell.status === "loading" ||
    targetCell.status === "loading"
  ) {
    return currentCells;
  }

  const sourceContent = buildStoryboardCellContentSnapshot(sourceCell);
  const targetContent = buildStoryboardCellContentSnapshot(targetCell);

  return {
    ...currentCells,
    [sourceCellId]: {
      ...sourceCell,
      ...targetContent,
    },
    [targetCellId]: {
      ...targetCell,
      ...sourceContent,
    },
  };
}

function normalizeStoryboardCells(currentCells, rows, columns) {
  return Object.fromEntries(
    buildStoryboardCellDefinitions(rows, columns).map((definition) => {
      const currentCell = currentCells?.[definition.id];

      return [
        definition.id,
        currentCell
          ? {
              ...currentCell,
              ...definition,
              caption: typeof currentCell?.caption === "string" ? currentCell.caption : "",
              pendingRequestId: normalizeTextValue(currentCell?.pendingRequestId),
              referenceImages: Array.isArray(currentCell?.referenceImages)
                ? currentCell.referenceImages
                    .map(restorePersistedReferenceImage)
                    .filter(Boolean)
                    .slice(0, STORYBOARD_CELL_REFERENCE_LIMIT)
                : [],
            }
          : createStoryboardCellState(definition),
      ];
    }),
  );
}

function formatStoryboardPromptPreview(value) {
  const text = normalizeTextValue(value);

  if (!text) {
    return "点击填写分镜提示词";
  }

  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

function getAspectRatioNumber(value) {
  const { width, height } = parseAspectRatio(value);
  return width / height;
}

function calculateCoverCropFraction(imageAspectRatio, frameAspectRatio) {
  if (
    !Number.isFinite(imageAspectRatio) ||
    !Number.isFinite(frameAspectRatio) ||
    imageAspectRatio <= 0 ||
    frameAspectRatio <= 0
  ) {
    return 1;
  }

  const visibleFraction = Math.min(
    imageAspectRatio / frameAspectRatio,
    frameAspectRatio / imageAspectRatio,
  );

  return 1 - Math.min(Math.max(visibleFraction, 0), 1);
}

function findRecommendedStoryboardAspectRatioOption(options, frameAspectRatio) {
  if (!Array.isArray(options) || options.length === 0 || !Number.isFinite(frameAspectRatio)) {
    return null;
  }

  return options.reduce((bestMatch, option) => {
    const optionAspectRatio = getAspectRatioNumber(option.value);
    const cropFraction = calculateCoverCropFraction(optionAspectRatio, frameAspectRatio);

    if (!bestMatch) {
      return {
        option,
        aspectRatio: optionAspectRatio,
        cropFraction,
      };
    }

    if (cropFraction < bestMatch.cropFraction - 0.000001) {
      return {
        option,
        aspectRatio: optionAspectRatio,
        cropFraction,
      };
    }

    if (
      Math.abs(cropFraction - bestMatch.cropFraction) <= 0.000001 &&
      Math.abs(optionAspectRatio - frameAspectRatio) <
        Math.abs(bestMatch.aspectRatio - frameAspectRatio)
    ) {
      return {
        option,
        aspectRatio: optionAspectRatio,
        cropFraction,
      };
    }

    return bestMatch;
  }, null);
}

function findRecommendedStoryboardAspectRatioForLayout({
  options,
  canvasWidth,
  canvasHeight,
  rows,
  columns,
}) {
  if (!Array.isArray(options) || options.length === 0) {
    return null;
  }

  const metrics = getProfessionalExportLayoutMetrics({
    canvasWidth,
    canvasHeight,
    rows,
    columns,
  });
  const frameAspectRatio = (metrics?.cellWidth || 1) / (metrics?.cellHeight || 1);

  return findRecommendedStoryboardAspectRatioOption(options, frameAspectRatio);
}

function formatCropPercentValue(value) {
  const safeValue = Math.max(0, value) * 100;

  if (safeValue >= 10) {
    return `${safeValue.toFixed(0)}%`;
  }

  if (safeValue >= 1) {
    return `${safeValue.toFixed(1)}%`;
  }

  return `${safeValue.toFixed(2)}%`;
}

function buildStoryboardCellClassName(
  cell,
  {
    dragDisabled = false,
    isDragging = false,
    isDropTarget = false,
    isOverlay = false,
    hasMobileDragHandle = false,
  } = {},
) {
  return `storyboard-cell is-${cell.status}${cell.record ? " has-image" : ""}${normalizeTextValue(cell.caption) ? " has-caption" : ""}${dragDisabled ? " is-drag-disabled" : ""}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop-target" : ""}${isOverlay ? " is-overlay" : ""}${hasMobileDragHandle ? " has-mobile-drag-handle" : ""}`;
}

function buildStoryboardCellTransformStyle(transform, transition) {
  return {
    transform: CSS.Transform.toString(transform),
    transition: [
      transition,
      "background 180ms ease",
      "box-shadow 180ms ease",
      "filter 180ms ease",
      "opacity 180ms ease",
    ]
      .filter(Boolean)
      .join(", "),
  };
}

function resolveStoryboardCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  return closestCenter(args);
}

function StoryboardCellContent({ cell }) {
  return (
    <>
      {cell.record ? (
        <img
          className="storyboard-cell-image"
          src={cell.record.previewUrl}
          alt={`${cell.label} 生成结果`}
          draggable="false"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span className="storyboard-cell-index">{cell.index}</span>
      <span className="storyboard-cell-prompt">
        {formatStoryboardPromptPreview(cell.prompt)}
      </span>
      <span className="storyboard-cell-status">
        {cell.status === "loading"
          ? "生成中"
          : cell.record
            ? "已生成"
            : "待填写"}
      </span>
      {normalizeTextValue(cell.caption) ? (
        <span className="storyboard-cell-caption">
          <span className="storyboard-cell-caption-text">
            {normalizeTextValue(cell.caption)}
          </span>
        </span>
      ) : null}
    </>
  );
}

function SortableStoryboardCell({
  cell,
  dragDisabled = false,
  dragHandleOnly = false,
  onOpen,
  onClear,
}) {
  const {
    attributes,
    isDragging,
    isOver,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: cell.id,
    disabled: dragDisabled,
  });
  const hasContent = doesStoryboardCellHaveContent(cell);
  const dragActivatorProps = !dragDisabled
    ? {
        ...attributes,
        ...listeners,
      }
    : {};
  const cardDragActivatorProps = dragHandleOnly ? {} : dragActivatorProps;
  const handleDragActivatorProps = dragHandleOnly ? dragActivatorProps : {};

  return (
    <div
      ref={setNodeRef}
      className="storyboard-cell-shell"
      style={buildStoryboardCellTransformStyle(transform, transition)}
    >
      <button
        type="button"
        role="gridcell"
        className={buildStoryboardCellClassName(cell, {
          dragDisabled,
          hasMobileDragHandle: dragHandleOnly,
          isDragging,
          isDropTarget: isOver && !isDragging,
        })}
        onClick={() => onOpen(cell.id)}
        aria-label={`${cell.label}${dragHandleOnly ? "，点击打开编辑，拖拽请使用排序手柄" : dragDisabled ? "，生成中暂不可拖拽" : "，可拖拽调整顺序"}${cell.status === "loading" ? "，生成中" : ""}`}
        aria-roledescription={dragHandleOnly ? "分镜格" : "可拖拽分镜格"}
        ref={dragHandleOnly ? undefined : setActivatorNodeRef}
        {...cardDragActivatorProps}
      >
        <StoryboardCellContent cell={cell} />
      </button>
      {dragHandleOnly ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="storyboard-cell-drag-handle"
          aria-label={`${cell.label}排序手柄，长按后拖拽调整顺序`}
          title={`拖拽调整${cell.label}顺序`}
          disabled={dragDisabled}
          {...handleDragActivatorProps}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="7" cy="6" r="1.2" />
            <circle cx="13" cy="6" r="1.2" />
            <circle cx="7" cy="10" r="1.2" />
            <circle cx="13" cy="10" r="1.2" />
            <circle cx="7" cy="14" r="1.2" />
            <circle cx="13" cy="14" r="1.2" />
          </svg>
        </button>
      ) : null}
      {hasContent ? (
        <button
          type="button"
          className="storyboard-cell-clear-button"
          onClick={(event) => {
            event.stopPropagation();
            onClear(cell.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          aria-label={`清空${cell.label}内容`}
          title={`清空${cell.label}内容`}
          disabled={dragDisabled}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
            <path d="M4 6h12" />
            <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
            <path d="M8 9v4.5" />
            <path d="M12 9v4.5" />
          </svg>
        </button>
      ) : null}
    </div>
  );
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

function formatAspectRatioCssValue(value) {
  const { width, height } = parseAspectRatio(value);
  return `${width} / ${height}`;
}

function formatCanvasSizeAspectRatioValue(canvasSizeOption) {
  if (!canvasSizeOption) {
    return "1:1";
  }

  return `${canvasSizeOption.width}:${canvasSizeOption.height}`;
}

function buildProfessionalExportCssVariables(
  metrics,
  {
    dividerWidthPx = DEFAULT_STORYBOARD_DIVIDER_WIDTH_PX,
    captionFontScale = 1,
    captionBackgroundAlpha = DEFAULT_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT / 100,
  } = {},
) {
  return {
    "--professional-export-divider-size": `${dividerWidthPx}px`,
    "--professional-export-placeholder-padding": `${metrics.placeholderPadding}px`,
    "--professional-export-placeholder-font-size": `${metrics.placeholderFontSize}px`,
    "--professional-export-caption-inset": `${metrics.captionInset}px`,
    "--professional-export-caption-padding-y": `${metrics.captionPaddingY}px`,
    "--professional-export-caption-padding-x": `${metrics.captionPaddingX}px`,
    "--professional-export-caption-font-size": `${metrics.captionFontSize}px`,
    "--professional-export-caption-radius": `${metrics.captionRadius}px`,
    "--professional-export-caption-font-scale": String(captionFontScale),
    "--professional-export-caption-background-alpha": String(captionBackgroundAlpha),
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

function detectMobilePerformanceMode() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches;
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

function sanitizeProfessionalCustomScenarios(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      const label = normalizeTextValue(item?.label);
      const width = normalizeCanvasDimensionValue(item?.width, DEFAULT_CUSTOM_CANVAS_WIDTH);
      const height = normalizeCanvasDimensionValue(item?.height, DEFAULT_CUSTOM_CANVAS_HEIGHT);
      const layoutRows = clampLayoutTrack(item?.layoutRows);
      const layoutColumns = clampLayoutTrack(item?.layoutColumns);

      if (!label) {
        return null;
      }

      return {
        value:
          normalizeTextValue(item?.value) ||
          normalizeTextValue(item?.id) ||
          `custom-scene-${index + 1}`,
        label,
        width,
        height,
        layoutRows,
        layoutColumns,
      };
    })
    .filter(Boolean);
}

function readStoredProfessionalCustomScenarios() {
  const rawValue = readLocalValue(PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return sanitizeProfessionalCustomScenarios(parsedValue);
  } catch (_error) {
    return [];
  }
}

function buildPersistedProfessionalCustomScenarios(scenarios) {
  return scenarios.map((scenario) => ({
    value: scenario.value,
    label: scenario.label,
    width: scenario.width,
    height: scenario.height,
    layoutRows: scenario.layoutRows,
    layoutColumns: scenario.layoutColumns,
  }));
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

function buildProfessionalSceneArchiveDownloadName() {
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

  return `banana-${datePart}-${timePart}-professional-scene.json`;
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

function getRequestTaskTypeLabel(task) {
  if (task?.type === "enhance" || task?.mode === "enhance") {
    return "提升";
  }

  if (task?.type === "storyboard") {
    return "分镜生图";
  }

  if (task?.mode === "simple") {
    return "简易生图";
  }

  return "专业生图";
}

function getRequestTaskStatusLabel(task) {
  if (task?.status === "failed" && task?.stage === "stale") {
    return "已中断";
  }

  switch (task?.status) {
    case "cancelled":
      return "已取消";
    case "queued":
      return "排队中";
    case "processing":
      return "处理中";
    case "saving":
      return "保存中";
    case "succeeded":
      return "已完成";
    case "recovered":
      return "已恢复";
    case "failed":
      return "失败";
    case "accepted":
    default:
      return "已接收";
  }
}

function buildRequestTaskMeta(task) {
  const parts = [
    getRequestTaskTypeLabel(task),
    task?.requestId ? `ID ${task.requestId.slice(0, 8)}` : "",
    formatPersistedAt(task?.updatedAt || task?.createdAt),
  ].filter(Boolean);

  return parts.join(" · ");
}

function buildRequestTaskQueueSummary(task) {
  if (task?.queueRateLimitWaitMs > 0) {
    const seconds = Math.ceil(task.queueRateLimitWaitMs / 1000);
    return task.queuePosition > 0
      ? `Google 限流冷却中，前方还有 ${Math.max(task.queuePosition - 1, 0)} 个任务，预计至少 ${seconds} 秒`
      : `Google 限流冷却中，预计至少 ${seconds} 秒`;
  }

  if (task?.queuePosition > 1) {
    return `队列前方还有 ${task.queuePosition - 1} 个任务`;
  }

  if (!isRequestTaskTerminal(task) && task?.queueConcurrency > 0) {
    return `后端并发 ${task.queueActiveCount}/${task.queueConcurrency}`;
  }

  return "";
}

function parseRequestTaskTimeMs(value) {
  const timeMs = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(timeMs) ? timeMs : 0;
}

function isOrphanedPendingRequestTask(task, backendStartedAt) {
  if (isRequestTaskTerminal(task)) {
    return false;
  }

  const taskCreatedAtMs = parseRequestTaskTimeMs(task?.createdAt);
  const backendStartedAtMs = parseRequestTaskTimeMs(backendStartedAt);

  return taskCreatedAtMs > 0 && backendStartedAtMs > taskCreatedAtMs;
}

function buildOrphanedRequestTaskPatch(task) {
  return {
    status: "failed",
    stage: "stale",
    message: "后端已重启，旧任务未继续执行，请重试",
    error: "后端已重启，旧任务未继续执行，请重试",
    canRetry: task?.canRetry !== false,
    queuePosition: 0,
    queueActiveCount: 0,
    queuePendingCount: 0,
    queueConcurrency: 0,
    queueRateLimitWaitMs: 0,
    queueRateLimitedUntil: "",
  };
}

function buildMissingRecoverableRequestTaskPatch(
  task,
  message = "后端已找不到这个任务，已视为结束，请重新生成",
) {
  return {
    status: "failed",
    stage: "error",
    message,
    error: message,
    canRetry: task?.canRetry !== false,
    queuePosition: 0,
    queueActiveCount: 0,
    queuePendingCount: 0,
    queueConcurrency: 0,
    queueRateLimitWaitMs: 0,
    queueRateLimitedUntil: "",
  };
}

function isRequestTaskRecoveryStale(task, referenceValue = "") {
  if (isRequestTaskTerminal(task)) {
    return false;
  }

  const latestUpdateMs =
    parseRequestTaskTimeMs(referenceValue) ||
    parseRequestTaskTimeMs(task?.updatedAt) ||
    parseRequestTaskTimeMs(task?.createdAt);

  if (!latestUpdateMs) {
    return false;
  }

  return Date.now() - latestUpdateMs >= REQUEST_TASK_RECOVERY_STALE_AFTER_MS;
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

function getReferenceImageOptimizationSummary(image) {
  if (
    !image?.optimized ||
    !Number.isFinite(image?.originalSize) ||
    !Number.isFinite(image?.size) ||
    image.originalSize <= image.size
  ) {
    return "";
  }

  return `已自动优化上传：${formatBytes(image.originalSize)} -> ${formatBytes(image.size)}。`;
}

function buildReferenceUploadFileName(name, mimeType) {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const safeBaseName = (trimmedName || "reference-image").replace(/\.[^./\\]+$/, "");
  return `${safeBaseName}.${getFileExtensionFromMimeType(mimeType)}`;
}

function ensureClipboardImageFileName(file, index = 0) {
  if (!(file instanceof File)) {
    return null;
  }

  const trimmedName = typeof file.name === "string" ? file.name.trim() : "";

  if (trimmedName) {
    return file;
  }

  const mimeType = file.type || "image/png";

  return new File(
    [file],
    `clipboard-image-${Date.now()}-${index + 1}.${getFileExtensionFromMimeType(mimeType)}`,
    {
      type: mimeType,
      lastModified: file.lastModified || Date.now(),
    },
  );
}

function getImageFilesFromClipboardData(clipboardData) {
  if (!clipboardData) {
    return [];
  }

  const itemFiles = Array.from(clipboardData.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item, index) => ensureClipboardImageFileName(item.getAsFile(), index))
    .filter(Boolean);

  if (itemFiles.length > 0) {
    return itemFiles;
  }

  return Array.from(clipboardData.files || [])
    .filter((file) => file.type.startsWith("image/"))
    .map((file, index) => ensureClipboardImageFileName(file, index))
    .filter(Boolean);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImageElementFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片解析失败，无法自动优化这张参考图"));
    image.decoding = "async";
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("图片压缩失败，请重试"));
    }, mimeType, quality);
  });
}

function getScaledDimensions(width, height, scale) {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function optimizeReferenceImageFile(
  file,
  {
    targetBytes = REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES,
    hardLimitBytes = VERTEX_INLINE_IMAGE_MAX_BYTES,
    maxLongEdge = REFERENCE_IMAGE_MAX_LONG_EDGE_PX,
    minLongEdge = REFERENCE_IMAGE_MIN_LONG_EDGE_PX,
  } = {},
) {
  if (!file || file.size <= targetBytes) {
    return {
      file,
      optimized: false,
      originalSize: file?.size || 0,
      outputSize: file?.size || 0,
    };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElementFromUrl(objectUrl);
    const naturalWidth = image.naturalWidth || 0;
    const naturalHeight = image.naturalHeight || 0;
    const sourceLongEdge = Math.max(naturalWidth, naturalHeight);

    if (!sourceLongEdge) {
      throw new Error("图片尺寸无效，无法自动优化这张参考图");
    }

    const maxLongEdgeScale = sourceLongEdge > maxLongEdge ? maxLongEdge / sourceLongEdge : 1;
    const minLongEdgeScale = sourceLongEdge > minLongEdge ? minLongEdge / sourceLongEdge : 1;
    const candidateScales = Array.from(
      new Set(
        REFERENCE_IMAGE_RESIZE_STEPS.map((step) =>
          Math.max(minLongEdgeScale, Math.min(1, maxLongEdgeScale * step)),
        ),
      ),
    );
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("当前浏览器不支持参考图自动优化，请换一个浏览器后重试");
    }

    let bestBlob = null;

    for (const scale of candidateScales) {
      const { width, height } = getScaledDimensions(naturalWidth, naturalHeight, scale);
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      if (file.type === "image/png") {
        const pngBlob = await canvasToBlob(canvas, "image/png");

        if (!bestBlob || pngBlob.size < bestBlob.size) {
          bestBlob = pngBlob;
        }

        if (pngBlob.size <= targetBytes) {
          break;
        }
      }

      for (const quality of REFERENCE_IMAGE_JPEG_QUALITY_STEPS) {
        const jpegBlob = await canvasToBlob(canvas, "image/jpeg", quality);

        if (!bestBlob || jpegBlob.size < bestBlob.size) {
          bestBlob = jpegBlob;
        }

        if (jpegBlob.size <= targetBytes) {
          break;
        }
      }

      if (bestBlob?.size <= targetBytes) {
        break;
      }
    }

    if (!bestBlob || bestBlob.size >= file.size) {
      if (file.size > hardLimitBytes) {
        throw new Error("这张图片过大，自动优化后仍无法稳定上传，请换一张更小的图片");
      }

      return {
        file,
        optimized: false,
        originalSize: file.size,
        outputSize: file.size,
      };
    }

    if (bestBlob.size > hardLimitBytes) {
      throw new Error("这张图片过大，自动优化后仍超过 7MB，请换一张更小的图片");
    }

    return {
      file: new File([bestBlob], buildReferenceUploadFileName(file.name, bestBlob.type), {
        type: bestBlob.type || "image/jpeg",
        lastModified: file.lastModified,
      }),
      optimized: true,
      originalSize: file.size,
      outputSize: bestBlob.size,
    };
  } catch (error) {
    if (file.size <= hardLimitBytes) {
      return {
        file,
        optimized: false,
        originalSize: file.size,
        outputSize: file.size,
      };
    }

    throw error;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

function createRequestCancelledError() {
  const error = new Error("任务已取消");
  error.code = "BANANA_TASK_CANCELLED";
  return error;
}

function isRequestCancelledError(error) {
  return (
    error?.code === "BANANA_TASK_CANCELLED" ||
    normalizeTextValue(error?.message) === "任务已取消" ||
    normalizeTextValue(error?.message) === "请求已取消"
  );
}

function buildCancelledRequestTaskPatch(message = "任务已取消") {
  return {
    status: "cancelled",
    stage: "cancelled",
    message,
    error: "",
    queuePosition: 0,
    queueActiveCount: 0,
    queuePendingCount: 0,
    queueConcurrency: 0,
    queueRateLimitWaitMs: 0,
    queueRateLimitedUntil: "",
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(data.error || "请求失败，请稍后再试");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function readFileAsImagePayload(file, { optimize = false } = {}) {
  const optimizedFileResult = optimize ? await optimizeReferenceImageFile(file) : null;
  const fileToRead = optimizedFileResult?.file || file;
  const dataUrl = await readFileAsDataUrl(fileToRead);

  const [, base64 = ""] = dataUrl.split(",", 2);

  return {
    id: `${fileToRead.name}-${fileToRead.size}-${fileToRead.lastModified}-${Math.random()
      .toString(36)
      .slice(2)}`,
    name: fileToRead.name,
    size: fileToRead.size,
    originalSize: optimizedFileResult?.originalSize || file.size,
    optimized: Boolean(optimizedFileResult?.optimized),
    mimeType: fileToRead.type || "image/png",
    previewUrl: dataUrl,
    data: base64,
  };
}

async function readFileAsReferenceImage(file) {
  return readFileAsImagePayload(file, { optimize: true });
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsText(file);
  });
}

async function readFileAsGenerationResultRecord(file) {
  const image = await readFileAsImagePayload(file);

  return restorePersistedGenerationResultRecord({
    id: createPersistedRecordId(),
    persistedAt: new Date().toISOString(),
    downloadName: file.name || buildDownloadNameWithOptions({ mimeType: image.mimeType }),
    promptSnapshot: "",
    imageSize: "本地导入",
    aspectRatio: "",
    imageBase64: image.data,
    mimeType: image.mimeType,
  });
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
    cache: "no-store",
  });

  return parseJsonResponse(response);
}

async function verifyPassword(password) {
  const response = await fetch("/api/access/session", {
    headers: buildPwHeaders(password),
    cache: "no-store",
  });

  return parseJsonResponse(response);
}

async function fetchRecoverableGenerationRequest(password, requestId) {
  const response = await fetch(`/api/generations/${encodeURIComponent(requestId)}`, {
    headers: buildPwHeaders(password),
    cache: "no-store",
  });

  return parseJsonResponse(response);
}

async function fetchRetryableGenerationRequest(password, requestId) {
  const response = await fetch(`/api/generations/${encodeURIComponent(requestId)}/retry`, {
    method: "POST",
    headers: buildPwHeaders(password),
  });

  return parseJsonResponse(response);
}

async function fetchCancelableGenerationRequest(password, requestId) {
  const response = await fetch(`/api/generations/${encodeURIComponent(requestId)}/cancel`, {
    method: "POST",
    headers: buildPwHeaders(password),
  });

  return parseJsonResponse(response);
}

function createSseBufferDrainer(handleSseEvent) {
  return function drainSseBuffer(currentBuffer, flush = false) {
    let nextBuffer = currentBuffer;

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

      handleSseEvent(eventName, JSON.parse(dataLines.join("\n")));
    }

    if (flush && nextBuffer.trim()) {
      const eventMatch = nextBuffer.match(/^event:\s*(.+)$/m);
      const eventName = eventMatch?.[1]?.trim() || "message";
      const dataLines = nextBuffer
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length > 0) {
        handleSseEvent(eventName, JSON.parse(dataLines.join("\n")));
      }

      nextBuffer = "";
    }

    return {
      buffer: nextBuffer,
    };
  };
}

async function requestSseJsonStream(password, endpoint, payload, handlers = {}) {
  const abortController = new AbortController();
  const externalSignal = handlers.signal;
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

  let finalResultFromEvents = null;
  const drainSseBuffer = createSseBufferDrainer((eventName, data) => {
    const eventResult = handleSseEvent(eventName, data);

    if (eventResult) {
      finalResultFromEvents = eventResult;
    }
  });

  armStreamTimeout();

  function handleExternalAbort() {
    abortController.abort(
      externalSignal?.reason instanceof Error
        ? externalSignal.reason
        : createRequestCancelledError(),
    );
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      handleExternalAbort();
    } else {
      externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
    }
  }

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
          finalResult = finalResultFromEvents || finalResult;
          break;
        }

        armStreamTimeout();
        buffer += decoder.decode(value, { stream: true });

        const drained = drainSseBuffer(buffer);
        buffer = drained.buffer;
        finalResult = finalResultFromEvents || finalResult;
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
  } finally {
    externalSignal?.removeEventListener?.("abort", handleExternalAbort);
  }
}

function subscribeTaskStatusStream(password, requestIds, handlers = {}) {
  const abortController = new AbortController();
  let timeoutId = 0;
  let closed = false;

  function clearTimeoutId() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = 0;
    }
  }

  function armTimeout() {
    clearTimeoutId();
    timeoutId = window.setTimeout(() => {
      abortController.abort(new Error("任务状态连接超时，请稍后重试。"));
    }, SSE_INACTIVITY_TIMEOUT_MS);
  }

  function close() {
    if (closed) {
      return;
    }

    closed = true;
    clearTimeoutId();
    abortController.abort();
  }

  const drainSseBuffer = createSseBufferDrainer((eventName, data) => {
    armTimeout();

    if (eventName === "status") {
      handlers.onStatus?.(data);
      return;
    }

    if (eventName === "error") {
      throw new Error(data?.error || "任务状态订阅失败");
    }
  });

  armTimeout();

  const ready = (async () => {
    const response = await fetch("/api/tasks/watch/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildPwHeaders(password),
      },
      body: JSON.stringify({ requestIds }),
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      clearTimeoutId();
      return parseJsonResponse(response);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          drainSseBuffer(buffer, true);
          break;
        }

        armTimeout();
        buffer += decoder.decode(value, { stream: true });
        const drained = drainSseBuffer(buffer);
        buffer = drained.buffer;
      }
    } finally {
      clearTimeoutId();
      reader.releaseLock();
    }

    return null;
  })();

  return {
    close,
    ready,
  };
}

async function requestSimpleGeneration(password, payload, handlers) {
  try {
    return await requestSseJsonStream(password, "/api/generate/simple/stream", payload, handlers);
  } catch (error) {
    if (error?.status !== 404 && error?.status !== 405) {
      throw error;
    }

    return requestSseJsonStream(password, "/api/generate/stream", payload, handlers);
  }
}

async function requestProfessionalGeneration(password, payload, handlers) {
  try {
    return await requestSseJsonStream(
      password,
      "/api/generate/professional/stream",
      payload,
      handlers,
    );
  } catch (error) {
    if (error?.status !== 404 && error?.status !== 405) {
      throw error;
    }

    return requestSseJsonStream(password, "/api/generate/stream", payload, handlers);
  }
}

async function requestEnhancement(password, payload, handlers) {
  return requestSseJsonStream(password, "/api/enhance/stream", payload, handlers);
}

function parseResponseFilename(response) {
  const contentDisposition = response.headers.get("content-disposition") || "";
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return plainMatch?.[1] || "";
}

async function requestProfessionalExportPreview(password, payload) {
  const response = await fetch("/api/export/professional-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildPwHeaders(password),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return parseJsonResponse(response);
  }

  return {
    blob: await response.blob(),
    filename: parseResponseFilename(response),
  };
}

async function saveBlobFile(blob, filename) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof URL === "undefined"
  ) {
    throw new Error("当前环境不支持导出文件");
  }

  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
  const objectUrl = URL.createObjectURL(blob);

  try {
    if (
      isCoarsePointer &&
      typeof navigator !== "undefined" &&
      typeof File !== "undefined" &&
      navigator.share
    ) {
      const file = new File([blob], filename, {
        type: blob.type || "application/octet-stream",
      });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: filename,
          });
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            return;
          }

          console.warn("Share failed, falling back to download.", error);
        }
      }
    }

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.rel = "noopener";
    anchor.style.display = "none";

    if (isCoarsePointer) {
      anchor.target = "_blank";
      anchor.download = "";
    } else {
      anchor.download = filename;
    }

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

function downloadTextFile(filename, text, mimeType = "application/json") {
  if (typeof document === "undefined") {
    throw new Error("当前环境不支持下载文件");
  }

  const blob = new Blob([text], {
    type: `${mimeType};charset=utf-8`,
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
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
        <img
          src={image.previewUrl}
          alt={image.name}
          draggable="false"
          loading="lazy"
          decoding="async"
        />
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

function buildSimpleGenerationPayload({
  modelId,
  prompt,
  aspectRatio,
  imageSize,
  imageCount,
  referenceImages = [],
}) {
  const imageOptions = {
    imageSize,
    imageCount,
  };

  if (typeof aspectRatio === "string" && aspectRatio) {
    imageOptions.aspectRatio = aspectRatio;
  }

  return {
    modelId,
    prompt,
    imageOptions,
    referenceImages,
  };
}

function buildProfessionalGenerationPayload({
  modelId,
  prompt = "",
  aspectRatio,
  imageSize,
  imageCount,
  layoutRows,
  layoutColumns,
  referenceImages = [],
}) {
  return {
    modelId,
    prompt,
    imageOptions: {
      aspectRatio,
      imageSize,
      imageCount,
      layoutRows,
      layoutColumns,
    },
    // Keep the layout guide local-only. Uploading the preview canvas makes Gemini
    // treat labels, borders, and placeholders as real visual content.
    layoutGuideImage: null,
    referenceImages,
  };
}

function buildProfessionalReferenceImages(
  images = [],
  limit = PROFESSIONAL_STYLE_REFERENCE_LIMIT,
  role = "content",
) {
  return images
    .slice(0, limit)
    .filter((image) => image?.data && image?.mimeType)
    .map((image) => ({
      name: image.name,
      mimeType: image.mimeType,
      data: image.data,
      role: image.role || role,
    }));
}

function buildProfessionalStoryboardPrompt(globalPrompt, cellPrompt) {
  const normalizedGlobalPrompt = normalizeTextValue(globalPrompt);
  const normalizedCellPrompt = normalizeTextValue(cellPrompt);
  const promptParts = [];

  promptParts.push(
    "参考图规则：整体画风参考图只用于约束画风、笔触、色彩、材质和整体氛围，不用于指定主体、构图、动作或镜头。当前格子的参考图才是这个格子的内容参考；如果提示词里提到参考图、这张图、图1等，默认指当前格子的参考图，而不是整体画风参考图。",
  );

  if (normalizedGlobalPrompt) {
    promptParts.push(`整体要求：${normalizedGlobalPrompt}`);
  }

  if (normalizedCellPrompt) {
    promptParts.push(`当前分镜要求：${normalizedCellPrompt}`);
  }

  return promptParts.join("\n\n");
}

function buildProfessionalExportPayload({
  canvasSizeOption,
  rows,
  columns,
  cells,
  title = "",
  dividerStyle = {},
  captionStyle = {},
}) {
  return {
    title: normalizeTextValue(title),
    canvas: {
      label: canvasSizeOption?.label || "",
      width: Number(canvasSizeOption?.width) || 1,
      height: Number(canvasSizeOption?.height) || 1,
      rows,
      columns,
    },
    dividerStyle: {
      widthPx: normalizeStoryboardDividerWidthPx(dividerStyle.widthPx),
    },
    captionStyle: {
      fontSizePercent: normalizeStoryboardCaptionFontSizePercent(captionStyle.fontSizePercent),
      backgroundAlphaPercent: normalizeStoryboardCaptionBackgroundAlphaPercent(
        captionStyle.backgroundAlphaPercent,
      ),
    },
    cells: cells.map((cell) => ({
      id: cell.id,
      index: cell.index,
      row: cell.row,
      column: cell.column,
      prompt: normalizeTextValue(cell.prompt),
      caption: normalizeTextValue(cell.caption),
      status: cell.status,
      image:
        cell.record?.imageBase64 && cell.record?.mimeType
          ? {
              mimeType: cell.record.mimeType,
              data: cell.record.imageBase64,
            }
          : null,
    })),
  };
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

function cloneGenerationResultRecord(record) {
  return restorePersistedGenerationResultRecord(buildPersistedGenerationResultRecord(record));
}

async function copyTextToClipboard(text) {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("当前环境不支持复制");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const didCopy = document.execCommand("copy");

    if (!didCopy) {
      throw new Error("复制失败");
    }
  } finally {
    document.body.removeChild(textarea);
  }
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

function buildPersistedStoryboardCells(cells) {
  if (!cells || typeof cells !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(cells).map(([cellId, cell]) => [
      cellId,
      {
        prompt: typeof cell?.prompt === "string" ? cell.prompt : "",
        caption: typeof cell?.caption === "string" ? cell.caption : "",
        pendingRequestId: normalizeTextValue(cell?.pendingRequestId),
        referenceImages: Array.isArray(cell?.referenceImages)
          ? cell.referenceImages
              .map(buildPersistedReferenceImage)
              .filter(Boolean)
              .slice(0, STORYBOARD_CELL_REFERENCE_LIMIT)
          : [],
        record: buildPersistedGenerationResultRecord(cell?.record),
      },
    ]),
  );
}

function buildProfessionalSceneArchive({
  selectedModelId,
  globalPrompt,
  canvasSize,
  customScenarios,
  customCanvasWidth,
  customCanvasHeight,
  layoutRows,
  layoutColumns,
  storyboardAspectRatio,
  storyboardImageSize,
  selectedImageCount,
  storyboardDividerWidthPx,
  storyboardCaptionFontSizePercent,
  storyboardCaptionBackgroundAlphaPercent,
  referenceImages,
  storyboardCells,
}) {
  return {
    kind: PROFESSIONAL_SCENE_ARCHIVE_KIND,
    version: PROFESSIONAL_SCENE_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    mode: PANEL_MODE_PROFESSIONAL,
    state: {
      selectedModelId: normalizeTextValue(selectedModelId),
      globalPrompt: typeof globalPrompt === "string" ? globalPrompt : "",
      canvasSize: normalizeCanvasScenarioValue(canvasSize, customScenarios),
      customScenarios: buildPersistedProfessionalCustomScenarios(customScenarios),
      customCanvasWidth: normalizeCanvasDimensionValue(
        customCanvasWidth,
        DEFAULT_CUSTOM_CANVAS_WIDTH,
      ),
      customCanvasHeight: normalizeCanvasDimensionValue(
        customCanvasHeight,
        DEFAULT_CUSTOM_CANVAS_HEIGHT,
      ),
      layoutRows: clampLayoutTrack(layoutRows),
      layoutColumns: clampLayoutTrack(layoutColumns),
      storyboardAspectRatio: normalizeAspectRatioValue(storyboardAspectRatio),
      storyboardImageSize: normalizeImageSizeValue(storyboardImageSize),
      selectedImageCount: normalizeImageCountValue(selectedImageCount),
      storyboardDividerWidthPx: normalizeStoryboardDividerWidthPx(storyboardDividerWidthPx),
      storyboardCaptionFontSizePercent: normalizeStoryboardCaptionFontSizePercent(
        storyboardCaptionFontSizePercent,
      ),
      storyboardCaptionBackgroundAlphaPercent:
        normalizeStoryboardCaptionBackgroundAlphaPercent(
          storyboardCaptionBackgroundAlphaPercent,
        ),
      referenceImages: Array.isArray(referenceImages)
        ? referenceImages
            .map(buildPersistedReferenceImage)
            .filter(Boolean)
            .slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT)
        : [],
      storyboardCells: buildPersistedStoryboardCells(storyboardCells),
    },
  };
}

function resolveProfessionalSceneArchiveState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("场景文件内容无效");
  }

  if (input.kind && input.kind !== PROFESSIONAL_SCENE_ARCHIVE_KIND) {
    throw new Error("不是可识别的 banana 专业模式场景文件");
  }

  const rawState =
    input.kind === PROFESSIONAL_SCENE_ARCHIVE_KIND
      ? input.state
      : input.state || input.professionalScene || input;

  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    throw new Error("场景文件缺少可导入的数据");
  }

  const customScenarios = sanitizeProfessionalCustomScenarios(rawState.customScenarios);
  const layoutRows = clampLayoutTrack(rawState.layoutRows ?? rawState.professionalLayoutRows);
  const layoutColumns = clampLayoutTrack(
    rawState.layoutColumns ?? rawState.professionalLayoutColumns,
  );
  const canvasSize = normalizeCanvasScenarioValue(
    normalizeTextValue(rawState.canvasSize ?? rawState.professionalCanvasSize),
    customScenarios,
  );

  return {
    selectedModelId: normalizeTextValue(
      rawState.selectedModelId ?? rawState.professionalSelectedModelId,
    ),
    globalPrompt:
      typeof rawState.globalPrompt === "string"
        ? rawState.globalPrompt
        : typeof rawState.professionalGlobalPrompt === "string"
          ? rawState.professionalGlobalPrompt
          : "",
    canvasSize,
    customScenarios,
    customCanvasWidth: normalizeCanvasDimensionValue(
      rawState.customCanvasWidth ?? rawState.professionalCustomCanvasWidth,
      DEFAULT_CUSTOM_CANVAS_WIDTH,
    ),
    customCanvasHeight: normalizeCanvasDimensionValue(
      rawState.customCanvasHeight ?? rawState.professionalCustomCanvasHeight,
      DEFAULT_CUSTOM_CANVAS_HEIGHT,
    ),
    layoutRows,
    layoutColumns,
    storyboardAspectRatio: normalizeAspectRatioValue(
      rawState.storyboardAspectRatio ?? rawState.professionalStoryboardAspectRatio,
    ),
    storyboardImageSize: normalizeImageSizeValue(
      rawState.storyboardImageSize ?? rawState.professionalStoryboardImageSize,
    ),
    selectedImageCount: normalizeImageCountValue(
      rawState.selectedImageCount ?? rawState.professionalSelectedImageCount,
    ),
    storyboardDividerWidthPx: normalizeStoryboardDividerWidthPx(
      rawState.storyboardDividerWidthPx ?? rawState.professionalStoryboardDividerWidthPx,
    ),
    storyboardCaptionFontSizePercent: normalizeStoryboardCaptionFontSizePercent(
      rawState.storyboardCaptionFontSizePercent ??
        rawState.professionalStoryboardCaptionFontSizePercent,
    ),
    storyboardCaptionBackgroundAlphaPercent:
      normalizeStoryboardCaptionBackgroundAlphaPercent(
        rawState.storyboardCaptionBackgroundAlphaPercent ??
          rawState.professionalStoryboardCaptionBackgroundAlphaPercent,
      ),
    referenceImages: Array.isArray(rawState.referenceImages)
      ? rawState.referenceImages
          .map(restorePersistedReferenceImage)
          .filter(Boolean)
          .slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT)
      : [],
    storyboardCells: normalizeStoryboardCells(
      restorePersistedStoryboardCells(rawState.storyboardCells || rawState.cells),
      layoutRows,
      layoutColumns,
    ),
  };
}

function buildPersistedReferenceImage(image) {
  if (!image?.data || !image?.mimeType) {
    return null;
  }

  const { previewUrl: _previewUrl, ...persistedImage } = image;
  return persistedImage;
}

function restorePersistedReferenceImage(image) {
  if (!image?.data || !image?.mimeType) {
    return null;
  }

  return {
    ...image,
    previewUrl: image.previewUrl || `data:${image.mimeType};base64,${image.data}`,
  };
}

function restorePersistedStoryboardCells(cells) {
  if (!cells || typeof cells !== "object" || Array.isArray(cells)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(cells).map(([cellId, cell]) => {
      const restoredRecord = restorePersistedGenerationResultRecord(cell?.record);

      return [
        cellId,
        {
          id: cellId,
          prompt: typeof cell?.prompt === "string" ? cell.prompt : "",
          caption: typeof cell?.caption === "string" ? cell.caption : "",
          pendingRequestId: normalizeTextValue(cell?.pendingRequestId),
          referenceImages: Array.isArray(cell?.referenceImages)
            ? cell.referenceImages
                .map(restorePersistedReferenceImage)
                .filter(Boolean)
                .slice(0, STORYBOARD_CELL_REFERENCE_LIMIT)
            : [],
          status: restoredRecord ? "success" : "idle",
          statusText: "",
          error: "",
          record: restoredRecord,
        },
      ];
    }),
  );
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

async function writeLastGenerationRecord(record) {
  const persistedRecord = buildPersistedGenerationResultRecord(record);

  if (persistedRecord) {
    await generationResultStorage.setItem(LAST_GENERATION_RECORD_KEY, persistedRecord);
    return;
  }

  await generationResultStorage.removeItem(LAST_GENERATION_RECORD_KEY);
}

async function writeLastGenerationRecordId(recordId) {
  if (recordId) {
    await generationResultStorage.setItem(LAST_GENERATION_RECORD_ID_KEY, recordId);
    return;
  }

  await generationResultStorage.removeItem(LAST_GENERATION_RECORD_ID_KEY);
}

async function readPersistedStoryboardCells() {
  const persistedCells = await generationResultStorage.getItem(
    PROFESSIONAL_STORYBOARD_CELLS_STORAGE_KEY,
  );

  return restorePersistedStoryboardCells(persistedCells);
}

async function writePersistedStoryboardCells(cells) {
  const persistedCells = buildPersistedStoryboardCells(cells);
  await generationResultStorage.setItem(PROFESSIONAL_STORYBOARD_CELLS_STORAGE_KEY, persistedCells);
}

async function readPersistedReferenceImages() {
  const persistedImages = await generationResultStorage.getItem(
    PROFESSIONAL_REFERENCE_IMAGES_STORAGE_KEY,
  );

  if (!Array.isArray(persistedImages)) {
    return [];
  }

  return persistedImages.map(restorePersistedReferenceImage).filter(Boolean);
}

async function readPersistedSimpleReferenceImages() {
  const persistedImages = await generationResultStorage.getItem(
    SIMPLE_REFERENCE_IMAGES_STORAGE_KEY,
  );

  if (!Array.isArray(persistedImages)) {
    return [];
  }

  return persistedImages.map(restorePersistedReferenceImage).filter(Boolean);
}

async function writePersistedReferenceImages(images) {
  const persistedImages = images.map(buildPersistedReferenceImage).filter(Boolean);

  if (persistedImages.length > 0) {
    await generationResultStorage.setItem(
      PROFESSIONAL_REFERENCE_IMAGES_STORAGE_KEY,
      persistedImages,
    );
    return;
  }

  await generationResultStorage.removeItem(PROFESSIONAL_REFERENCE_IMAGES_STORAGE_KEY);
}

async function writePersistedSimpleReferenceImages(images) {
  const persistedImages = images.map(buildPersistedReferenceImage).filter(Boolean);

  if (persistedImages.length > 0) {
    await generationResultStorage.setItem(
      SIMPLE_REFERENCE_IMAGES_STORAGE_KEY,
      persistedImages,
    );
    return;
  }

  await generationResultStorage.removeItem(SIMPLE_REFERENCE_IMAGES_STORAGE_KEY);
}

async function readPersistedGenerationArtifacts() {
  let libraryRecords = await readPersistedGenerationLibrary();
  let lastRecordId = await generationResultStorage.getItem(LAST_GENERATION_RECORD_ID_KEY);
  const persistedCurrentRecord = restorePersistedGenerationResultRecord(
    await generationResultStorage.getItem(LAST_GENERATION_RECORD_KEY),
  );

  if (!libraryRecords.length && persistedCurrentRecord) {
    libraryRecords = [persistedCurrentRecord];
    lastRecordId = persistedCurrentRecord.id;
    await Promise.all([
      writePersistedGenerationLibrary(libraryRecords),
      writeLastGenerationRecordId(persistedCurrentRecord.id),
    ]);
  }

  const currentRecord =
    persistedCurrentRecord ||
    libraryRecords.find((record) => record.id === lastRecordId) ||
    libraryRecords[0] ||
    null;

  if (currentRecord) {
    await writeLastGenerationRecord(currentRecord);
  }

  if (currentRecord && currentRecord.id !== lastRecordId) {
    await writeLastGenerationRecordId(currentRecord.id);
  }

  return {
    libraryRecords,
    currentRecord,
  };
}

async function readPersistedCurrentGenerationRecord() {
  const persistedCurrentRecord = restorePersistedGenerationResultRecord(
    await generationResultStorage.getItem(LAST_GENERATION_RECORD_KEY),
  );

  if (persistedCurrentRecord) {
    return persistedCurrentRecord;
  }

  const persistedArtifacts = await readPersistedGenerationArtifacts();

  if (persistedArtifacts.currentRecord) {
    await writeLastGenerationRecord(persistedArtifacts.currentRecord);
  }

  return persistedArtifacts.currentRecord;
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
        <img
          src={record.previewUrl}
          alt="本地保存的 banana 图片"
          draggable="false"
          loading="lazy"
          decoding="async"
        />
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
  const isE2eStudioMode =
    import.meta.env.DEV &&
    routeMode === "studio" &&
    readSearchParam("e2e") === "1";
  const shouldAutoVerifyStudioPassword =
    routeMode === "studio" && Boolean(urlPassword) && !isE2eStudioMode;
  const [password, setPassword] = useState(() => urlPassword);
  const [activePw, setActivePw] = useState(() => (isE2eStudioMode ? "__banana_e2e__" : ""));
  const [sessionState, setSessionState] = useState(() =>
    isE2eStudioMode ? "ready" : shouldAutoVerifyStudioPassword ? "checking" : "locked",
  );
  const [models, setModels] = useState([]);
  const [panelMode, setPanelMode] = useState(() =>
    normalizePanelModeValue(readLocalValue(PANEL_MODE_STORAGE_KEY)),
  );
  const [professionalSelectedModelId, setProfessionalSelectedModelId] = useState(() =>
    readLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY) ||
      readLocalValue(LEGACY_SELECTED_MODEL_STORAGE_KEY),
  );
  const [professionalGlobalPrompt, setProfessionalGlobalPrompt] = useState(() =>
    readLocalValue(PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY),
  );
  const [professionalCustomScenarios, setProfessionalCustomScenarios] = useState(() =>
    readStoredProfessionalCustomScenarios(),
  );
  const [professionalCanvasSize, setProfessionalCanvasSize] = useState(() =>
    normalizeCanvasScenarioValue(
      readLocalValue(PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY) ||
        resolveCanvasSizeFromLegacyAspectRatio(
          readLocalValue(LEGACY_SELECTED_ASPECT_RATIO_STORAGE_KEY) || "1:1",
        ),
      readStoredProfessionalCustomScenarios(),
    ),
  );
  const [professionalLayoutRows, setProfessionalLayoutRows] = useState(() =>
    clampLayoutTrack(
      readLocalValue(PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY) ||
        readLocalValue(LEGACY_SELECTED_LAYOUT_ROWS_STORAGE_KEY) ||
        1,
    ),
  );
  const [professionalLayoutColumns, setProfessionalLayoutColumns] = useState(() =>
    clampLayoutTrack(
      readLocalValue(PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY) ||
        readLocalValue(LEGACY_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY) ||
        1,
    ),
  );
  const [professionalStoryboardAspectRatio, setProfessionalStoryboardAspectRatio] = useState(() =>
    normalizeAspectRatioValue(
      readLocalValue(PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY) ||
        PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO,
    ),
  );
  const [professionalStoryboardImageSize, setProfessionalStoryboardImageSize] = useState(() =>
    normalizeImageSizeValue(
      readLocalValue(PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY) ||
        readLocalValue(PROFESSIONAL_SELECTED_IMAGE_SIZE_STORAGE_KEY) ||
        "1K",
    ),
  );
  const [professionalSelectedImageCount, setProfessionalSelectedImageCount] = useState(() =>
    normalizeImageCountValue(
      readLocalValue(PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY) ||
        readLocalValue(LEGACY_SELECTED_IMAGE_COUNT_STORAGE_KEY) ||
        1,
    ),
  );
  const [simplePrompt, setSimplePrompt] = useState(() =>
    readLocalValue(SIMPLE_PROMPT_STORAGE_KEY) || readLocalValue(LEGACY_PROMPT_STORAGE_KEY),
  );
  const [simpleReferenceImages, setSimpleReferenceImages] = useState([]);
  const [simpleReferenceImagesHydrated, setSimpleReferenceImagesHydrated] = useState(false);
  const [simpleReferenceDisclosureOpen, setSimpleReferenceDisclosureOpen] = useState(false);
  const [referenceImages, setReferenceImages] = useState([]);
  const [referenceImagesHydrated, setReferenceImagesHydrated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState(null);
  const [studioError, setStudioError] = useState("");
  const [studioNotice, setStudioNotice] = useState("");
  const [studioPending, setStudioPending] = useState(false);
  const [professionalExportPending, setProfessionalExportPending] = useState(false);
  const [professionalSceneTransferPending, setProfessionalSceneTransferPending] = useState(false);
  const [enhancePending, setEnhancePending] = useState(false);
  const [backendRequestCount, setBackendRequestCount] = useState(0);
  const [backendBusyLabel, setBackendBusyLabel] = useState("");
  const [backendBusyEstimateMs, setBackendBusyEstimateMs] = useState(secondsToEstimateMs(18));
  const [backendBusyStartedAt, setBackendBusyStartedAt] = useState(0);
  const [backendBusyTickAt, setBackendBusyTickAt] = useState(0);
  const [backendBusyStreamText, setBackendBusyStreamText] = useState("");
  const [taskRecoveryPauseCount, setTaskRecoveryPauseCount] = useState(0);
  const [generationResult, setGenerationResult] = useState(null);
  const [generationResults, setGenerationResults] = useState([]);
  const [generationLibrary, setGenerationLibrary] = useState([]);
  const [generationLibraryLoaded, setGenerationLibraryLoaded] = useState(false);
  const [resourceManagerPending, setResourceManagerPending] = useState(false);
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
  const [professionalCustomCanvasWidth, setProfessionalCustomCanvasWidth] = useState(() =>
    normalizeCanvasDimensionValue(
      readLocalValue(PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY),
      DEFAULT_CUSTOM_CANVAS_WIDTH,
    ),
  );
  const [professionalCustomCanvasHeight, setProfessionalCustomCanvasHeight] = useState(() =>
    normalizeCanvasDimensionValue(
      readLocalValue(PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY),
      DEFAULT_CUSTOM_CANVAS_HEIGHT,
    ),
  );
  const [professionalStoryboardDividerWidthPx, setProfessionalStoryboardDividerWidthPx] = useState(() =>
    normalizeStoryboardDividerWidthPx(
      readLocalValue(PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY),
    ),
  );
  const [professionalStoryboardCaptionFontSizePercent, setProfessionalStoryboardCaptionFontSizePercent] = useState(() =>
    normalizeStoryboardCaptionFontSizePercent(
      readLocalValue(PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY),
    ),
  );
  const [professionalStoryboardCaptionBackgroundAlphaPercent, setProfessionalStoryboardCaptionBackgroundAlphaPercent] = useState(() =>
    normalizeStoryboardCaptionBackgroundAlphaPercent(
      readLocalValue(PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY),
    ),
  );
  const [storyboardCells, setStoryboardCells] = useState(() =>
    normalizeStoryboardCells({}, professionalLayoutRows, professionalLayoutColumns),
  );
  const [scenarioManagerOpen, setScenarioManagerOpen] = useState(false);
  const [scenarioManagerSelectedType, setScenarioManagerSelectedType] = useState("new");
  const [scenarioManagerDraft, setScenarioManagerDraft] = useState(() => ({
    value: "",
    label: "",
    width: String(DEFAULT_CUSTOM_CANVAS_WIDTH),
    height: String(DEFAULT_CUSTOM_CANVAS_HEIGHT),
    layoutRows: 1,
    layoutColumns: 1,
  }));
  const [scenarioManagerSelectedId, setScenarioManagerSelectedId] = useState("");
  const [storyboardEditorCellId, setStoryboardEditorCellId] = useState("");
  const [storyboardEditorMode, setStoryboardEditorMode] = useState(STORYBOARD_EDITOR_MODE_GENERATE);
  const [storyboardLibraryPickerOpen, setStoryboardLibraryPickerOpen] = useState(false);
  const [storyboardLibraryPickerPending, setStoryboardLibraryPickerPending] = useState(false);
  const [storyboardClearConfirmOpen, setStoryboardClearConfirmOpen] = useState(false);
  const [storyboardCellClearConfirmCellId, setStoryboardCellClearConfirmCellId] = useState("");
  const [requestTaskCancelConfirmId, setRequestTaskCancelConfirmId] = useState("");
  const [storyboardShareCopyState, setStoryboardShareCopyState] = useState("idle");
  const [storyboardImageControlsCollapsed, setStoryboardImageControlsCollapsed] = useState(true);
  const [storyboardStyleControlsCollapsed, setStoryboardStyleControlsCollapsed] = useState(true);
  const [storyboardCellsHydrated, setStoryboardCellsHydrated] = useState(false);
  const [activeStoryboardDragId, setActiveStoryboardDragId] = useState("");
  const [isMobilePerformanceMode, setIsMobilePerformanceMode] = useState(() =>
    detectMobilePerformanceMode(),
  );
  const [professionalExportPreviewVisible, setProfessionalExportPreviewVisible] = useState(() =>
    !detectMobilePerformanceMode(),
  );
  const [professionalExportScale, setProfessionalExportScale] = useState(1);
  const [professionalExportCardElement, setProfessionalExportCardElement] = useState(null);
  const requestTasks = useTaskStore((state) => state.requestTasks);
  const retryingRequestTaskIds = useTaskStore((state) => state.retryingRequestTaskIds);
  const cancellingRequestTaskIds = useTaskStore((state) => state.cancellingRequestTaskIds);
  const taskManagerOpen = useTaskStore((state) => state.taskManagerOpen);
  const setTaskManagerOpen = useTaskStore((state) => state.setTaskManagerOpen);
  const upsertRequestTask = useTaskStore((state) => state.upsertRequestTask);
  const updateRequestTask = useTaskStore((state) => state.updateRequestTask);
  const startRetryingRequestTask = useTaskStore((state) => state.startRetryingRequestTask);
  const finishRetryingRequestTask = useTaskStore((state) => state.finishRetryingRequestTask);
  const startCancellingRequestTask = useTaskStore((state) => state.startCancellingRequestTask);
  const finishCancellingRequestTask = useTaskStore((state) => state.finishCancellingRequestTask);
  const clearTerminalRequestTasks = useTaskStore((state) => state.clearTerminalRequestTasks);
  const layoutCanvasRef = useRef(null);
  const promptTextareaRef = useRef(null);
  const storyboardCaptionTextareaRef = useRef(null);
  const storyboardDragClickSuppressionRef = useRef({
    cellId: "",
    timestamp: 0,
  });
  const storyboardShareCopyResetTimeoutRef = useRef(null);
  const storyboardLibraryPickerTimeoutRef = useRef(null);
  const generationLibraryLoadPromiseRef = useRef(null);
  const taskRecoveryInFlightRequestIdsRef = useRef(new Set());
  const taskStatusStreamHandleRef = useRef(null);
  const taskStatusStreamReconnectTimeoutRef = useRef(0);
  const taskStatusStreamRequestIdsRef = useRef([]);
  const taskStatusStreamPasswordRef = useRef("");
  const taskStatusStreamGenerationRef = useRef(0);
  const requestAbortControllersRef = useRef(new Map());
  const professionalSceneImportInputRef = useRef(null);
  const referenceGridRef = useRef(null);
  const imagePreviewViewportRef = useRef(null);
  const imagePreviewPointersRef = useRef(new Map());
  const imagePreviewPanRef = useRef(null);
  const imagePreviewPinchRef = useRef(null);
  const hasLayoutValues = Boolean(
    professionalCanvasSize &&
      professionalLayoutRows > 0 &&
      professionalLayoutColumns > 0,
  );
  const isSimplePanelMode = panelMode === PANEL_MODE_SIMPLE;
  const isProfessionalPanelMode = panelMode === PANEL_MODE_PROFESSIONAL;
  const showResultPanel = isSimplePanelMode;
  const showProfessionalExportPanel = isProfessionalPanelMode;
  const shouldRenderProfessionalExportPreview =
    showProfessionalExportPanel && professionalExportPreviewVisible;
  const showPromptField = isSimplePanelMode;
  const isPromptFocusMode = showPromptField && promptMode === "focus";
  const showSimplePanelSubmit = isSimplePanelMode && !isPromptFocusMode;
  const showProfessionalPanelControls = isProfessionalPanelMode && !isPromptFocusMode;
  const professionalSceneTransferReady =
    referenceImagesHydrated && storyboardCellsHydrated;
  const simpleStyleReference = simpleReferenceImages[0] || null;
  const storyboardCellDefinitions = useMemo(
    () => buildStoryboardCellDefinitions(professionalLayoutRows, professionalLayoutColumns),
    [professionalLayoutColumns, professionalLayoutRows],
  );
  const allCanvasScenarioOptions = useMemo(
    () => [...CANVAS_SIZE_OPTIONS, ...professionalCustomScenarios],
    [professionalCustomScenarios],
  );
  const professionalCanvasSizeOption = useMemo(
    () =>
      getCanvasSizeOption(
        professionalCanvasSize,
        professionalCustomCanvasWidth,
        professionalCustomCanvasHeight,
        professionalCustomScenarios,
        professionalLayoutRows,
        professionalLayoutColumns,
      ),
    [
      professionalCanvasSize,
      professionalCustomCanvasHeight,
      professionalCustomCanvasWidth,
      professionalCustomScenarios,
      professionalLayoutColumns,
      professionalLayoutRows,
    ],
  );
  const professionalStyleReference = referenceImages[0] || null;
  const activeCustomScenario = useMemo(
    () =>
      professionalCustomScenarios.find((scenario) => scenario.value === professionalCanvasSize) || null,
    [professionalCanvasSize, professionalCustomScenarios],
  );
  const activeSystemScenario = useMemo(
    () => CANVAS_SIZE_OPTIONS.find((scenario) => scenario.value === professionalCanvasSize) || null,
    [professionalCanvasSize],
  );
  const storyboardEditorOpen = Boolean(storyboardEditorCellId);
  const storyboardEditorCell = storyboardEditorCellId
    ? storyboardCells[storyboardEditorCellId] || null
    : null;
  const activeStoryboardDragCell = activeStoryboardDragId
    ? storyboardCells[activeStoryboardDragId] || null
    : null;
  const isStoryboardEditorGenerateMode = storyboardEditorMode === STORYBOARD_EDITOR_MODE_GENERATE;
  const isStoryboardEditorAssetMode = storyboardEditorMode === STORYBOARD_EDITOR_MODE_ASSET;
  const storyboardDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobilePerformanceMode
        ? {
            delay: STORYBOARD_MOBILE_DRAG_ACTIVATION_DELAY_MS,
            tolerance: STORYBOARD_MOBILE_DRAG_TOLERANCE_PX,
          }
        : {
            distance: STORYBOARD_DRAG_ACTIVATION_DISTANCE_PX,
          },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");
    const handleChange = () => {
      const nextValue = mediaQuery.matches;
      setIsMobilePerformanceMode(nextValue);
      setProfessionalExportPreviewVisible(nextValue ? false : true);
    };

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);
  const storyboardCaptionFontScale = professionalStoryboardCaptionFontSizePercent / 100;
  const storyboardCaptionBackgroundAlpha =
    professionalStoryboardCaptionBackgroundAlphaPercent / 100;
  const storyboardGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(professionalLayoutColumns, 1)}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${Math.max(professionalLayoutRows, 1)}, minmax(0, 1fr))`,
      "--storyboard-divider-size": `${professionalStoryboardDividerWidthPx}px`,
      "--storyboard-caption-font-scale": String(storyboardCaptionFontScale),
      "--storyboard-caption-background-alpha": String(storyboardCaptionBackgroundAlpha),
    }),
    [
      professionalStoryboardDividerWidthPx,
      professionalLayoutColumns,
      professionalLayoutRows,
      storyboardCaptionBackgroundAlpha,
      storyboardCaptionFontScale,
    ],
  );
  const storyboardShellStyle = useMemo(
    () => ({
      aspectRatio: `${professionalCanvasSizeOption.width} / ${professionalCanvasSizeOption.height}`,
    }),
    [professionalCanvasSizeOption],
  );
  const professionalExportMetrics = useMemo(
    () =>
      getProfessionalExportLayoutMetrics({
        canvasWidth: professionalCanvasSizeOption.width,
        canvasHeight: professionalCanvasSizeOption.height,
        rows: professionalLayoutRows,
        columns: professionalLayoutColumns,
      }),
    [professionalCanvasSizeOption, professionalLayoutColumns, professionalLayoutRows],
  );
  const professionalExportViewportStyle = useMemo(
    () => ({
      width: `${professionalCanvasSizeOption.width * professionalExportScale}px`,
      height: `${professionalCanvasSizeOption.height * professionalExportScale}px`,
    }),
    [professionalCanvasSizeOption, professionalExportScale],
  );
  const professionalExportGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(professionalLayoutColumns, 1)}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${Math.max(professionalLayoutRows, 1)}, minmax(0, 1fr))`,
      "--professional-export-divider-size": `${professionalStoryboardDividerWidthPx}px`,
    }),
    [
      professionalLayoutColumns,
      professionalLayoutRows,
      professionalStoryboardDividerWidthPx,
    ],
  );
  const professionalExportSheetStyle = useMemo(
    () => ({
      width: `${professionalCanvasSizeOption.width}px`,
      height: `${professionalCanvasSizeOption.height}px`,
      transform: `scale(${professionalExportScale})`,
      ...buildProfessionalExportCssVariables(professionalExportMetrics, {
        dividerWidthPx: professionalStoryboardDividerWidthPx,
        captionFontScale: storyboardCaptionFontScale,
        captionBackgroundAlpha: storyboardCaptionBackgroundAlpha,
      }),
    }),
    [
      professionalCanvasSizeOption,
      professionalExportMetrics,
      professionalExportScale,
      professionalStoryboardDividerWidthPx,
      storyboardCaptionBackgroundAlpha,
      storyboardCaptionFontScale,
    ],
  );
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
  const recoverableRequestTasks = useMemo(
    () =>
      requestTasks
        .filter((task) => !isRequestTaskTerminal(task))
        .sort((leftTask, rightTask) => {
          const leftTime = Date.parse(leftTask.createdAt || "") || 0;
          const rightTime = Date.parse(rightTask.createdAt || "") || 0;
          return leftTime - rightTime;
        }),
    [requestTasks],
  );
  const activeRequestTaskCount = recoverableRequestTasks.length;
  const recoverableRequestTaskSignature = useMemo(
    () => recoverableRequestTasks.map((task) => task.requestId).join("|"),
    [recoverableRequestTasks],
  );
  const sortedRequestTasks = useMemo(
    () => requestTasks,
    [requestTasks],
  );
  const clearableRequestTaskCount = useMemo(
    () => requestTasks.filter((task) => isRequestTaskTerminal(task)).length,
    [requestTasks],
  );
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

  function beginTaskRecoveryPause() {
    let released = false;
    setTaskRecoveryPauseCount((currentValue) => currentValue + 1);

    return () => {
      if (released) {
        return;
      }

      released = true;
      setTaskRecoveryPauseCount((currentValue) => Math.max(0, currentValue - 1));
    };
  }

  function registerRequestAbortController(requestId, abortController) {
    if (!requestId || !abortController) {
      return;
    }

    requestAbortControllersRef.current.set(requestId, abortController);
  }

  function unregisterRequestAbortController(requestId, abortController) {
    if (!requestId) {
      return;
    }

    const currentController = requestAbortControllersRef.current.get(requestId);

    if (!currentController || (abortController && currentController !== abortController)) {
      return;
    }

    requestAbortControllersRef.current.delete(requestId);
  }

  function abortRequestAbortController(requestId, reason = createRequestCancelledError()) {
    if (!requestId) {
      return;
    }

    const abortController = requestAbortControllersRef.current.get(requestId);

    if (!abortController || abortController.signal.aborted) {
      return;
    }

    abortController.abort(reason);
  }

  async function executeRetryPayloadTask(task, retryPayload) {
    const resolvedStoryboardCellId =
      normalizeTextValue(task?.storyboardCellId) ||
      findStoryboardCellIdByPendingRequestId(storyboardCells, task?.requestId);
    const resolvedStoryboardCell =
      resolvedStoryboardCellId && storyboardCells[resolvedStoryboardCellId]
        ? storyboardCells[resolvedStoryboardCellId]
        : null;
    const retryType =
      resolvedStoryboardCell
        ? "storyboard"
        : normalizeTextValue(task?.type) === "storyboard"
        ? "storyboard"
        : normalizeTextValue(retryPayload?.type) || normalizeTextValue(task?.type);
    const retryMode = normalizeTextValue(retryPayload?.mode) || normalizeTextValue(task?.mode);
    const retryImageOptions = retryPayload?.imageOptions || {};

    if (retryType === "enhance") {
      await executeEnhancementTask({
        sourceGenerationRecord: {
          bananaModelId: retryPayload?.modelId || "",
          mimeType: retryPayload?.sourceImage?.mimeType || "image/png",
          imageBase64: retryPayload?.sourceImage?.data || "",
          aspectRatio: retryImageOptions?.aspectRatio || "",
          layoutRows: retryImageOptions?.layoutRows || 1,
          layoutColumns: retryImageOptions?.layoutColumns || 1,
          savedRecord: null,
        },
        promptSnapshot: retryPayload?.prompt || task?.promptSnapshot || "",
        targetImageSize: retryImageOptions?.imageSize || enhancementTargetImageSize,
      });
      return;
    }

    if (retryType === "storyboard") {
      if (resolvedStoryboardCell) {
        await executeStoryboardCellTask({
          editorCell: resolvedStoryboardCell,
          modelId: retryPayload?.modelId || generationModelId,
          requestedPromptValue: retryPayload?.prompt || task?.promptSnapshot || "",
          storyboardAspectRatio: retryImageOptions?.aspectRatio || professionalStoryboardAspectRatioValue,
          storyboardImageSize: retryImageOptions?.imageSize || professionalStoryboardImageSizeValue,
          globalReferenceImageRecords: retryPayload?.referenceImages || [],
        });
        return;
      }
    }

    await executeGenerationTask({
      mode: retryMode === "simple" ? "simple" : "professional",
      modelId: retryPayload?.modelId || generationModelId,
      prompt: retryPayload?.prompt || task?.promptSnapshot || "",
      aspectRatio:
        retryImageOptions?.aspectRatio ||
        (retryMode === "simple" ? generationAspectRatio : professionalDefaultCellAspectRatio),
      imageSize: retryImageOptions?.imageSize || generationImageSize,
      imageCount: retryImageOptions?.imageCount || 1,
      layoutRows: retryImageOptions?.layoutRows || 1,
      layoutColumns: retryImageOptions?.layoutColumns || 1,
      referenceImageRecords: retryPayload?.referenceImages || [],
    });
  }

  async function handleRetryRequestTask(task) {
    const requestId = normalizeTextValue(task?.requestId);
    const retryHandler = getRequestTaskRetryHandler(requestId);

    if (!requestId || retryingRequestTaskIds[requestId]) {
      return;
    }

    startRetryingRequestTask(requestId);

    try {
      setStudioError("");
      setStudioNotice("已重新提交失败任务，请查看新的任务状态。");

      if (activePw) {
        const data = await fetchRetryableGenerationRequest(activePw, requestId);

        if (data?.retryPayload) {
          await executeRetryPayloadTask(task, data.retryPayload);
          updateRequestTask(requestId, {
            canRetry: true,
            message: "已重新提交新的重试任务",
          });
          return;
        }
      }

      if (typeof retryHandler === "function") {
        await retryHandler();
      } else {
        throw new Error("当前任务没有可重试的请求体，请重新发起一次请求");
      }

      updateRequestTask(requestId, {
        message: "已重新提交新的重试任务",
      });
    } catch (error) {
      if (error?.status === 400 && typeof retryHandler !== "function") {
        updateRequestTask(requestId, {
          canRetry: false,
        });
      }
      setStudioError(error instanceof Error ? error.message : "任务重试失败");
    } finally {
      finishRetryingRequestTask(requestId);
    }
  }

  async function recoverRequestTaskFromServer(requestTask) {
    if (!activePw || !requestTask?.requestId) {
      return { state: "idle" };
    }

    try {
      const data = await fetchRecoverableGenerationRequest(activePw, requestTask.requestId);
      const nextRemainingCredits = normalizeRemainingCredits(
        data?.result?.quota?.remainingCredits ?? data?.quota?.remainingCredits,
      );

      if (nextRemainingCredits !== null) {
        setRemainingQuota(nextRemainingCredits);
      }

      if (isOrphanedPendingRequestTask(requestTask, data?.backendStartedAt)) {
        updateRequestTask(requestTask.requestId, buildOrphanedRequestTaskPatch(requestTask));
        return {
          state: "failed",
          data,
        };
      }

      if (data?.status === "succeeded" && data?.result) {
        const nextResults = buildGeneratedImageRecords(data.result, {
          promptSnapshot: requestTask.promptSnapshot,
        });
        const storyboardCellId =
          normalizeTextValue(requestTask?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(storyboardCells, requestTask?.requestId);
        const recoveredStoryboardResult =
          storyboardCellId
            ? buildGeneratedImageRecord(data.result, {
                promptSnapshot: requestTask.promptSnapshot,
                storyboardCellId,
                storyboardCellLabel: requestTask?.storyboardCellLabel || "",
                storyboardCellCoordinate: requestTask?.storyboardCellCoordinate || "",
              })
            : null;

        if (nextResults.length === 0) {
          throw new Error("banana 已完成任务，但恢复结果失败");
        }

        if (storyboardCellId && recoveredStoryboardResult) {
          updateStoryboardCell(storyboardCellId, (cell) => ({
            ...cell,
            status: "success",
            statusText: "已恢复上一次请求的图片结果",
            error: "",
            pendingRequestId: "",
            record: recoveredStoryboardResult,
          }));
        }

        setCurrentGenerationSelection(nextResults, nextResults[0]);
        setStudioError("");
        setStudioNotice("已恢复上一次请求的图片结果");
        updateRequestTask(requestTask.requestId, {
          status: "recovered",
          stage: "result",
          message: data?.message || "已恢复上一次请求的图片结果",
          error: "",
          canRetry: data?.canRetry !== false,
          queuePosition: 0,
          queueRateLimitWaitMs: 0,
        });

        try {
          await persistGeneratedRecords(nextResults, nextResults[0].id);
        } catch (error) {
          console.warn("Persist recovered generation result failed:", error);
          setStudioError("图片已恢复，但写入本地资源管理器失败");
        }

        return {
          state: "recovered",
          data,
        };
      }

      if (data?.status === "failed") {
        const storyboardCellId =
          normalizeTextValue(requestTask?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(storyboardCells, requestTask?.requestId);

        if (storyboardCellId) {
          updateStoryboardCell(storyboardCellId, (cell) => ({
            ...cell,
            status: cell?.record ? "success" : "idle",
            statusText: "",
            error: data?.error || data?.message || "banana 任务失败",
            pendingRequestId: "",
          }));
        }

        setStudioNotice("");
        setStudioError(data?.error || data?.message || "banana 任务失败");
        updateRequestTask(requestTask.requestId, {
          status: "failed",
          stage: data?.stage || "error",
          message: data?.message || "banana 任务失败",
          error: data?.error || data?.message || "banana 任务失败",
          canRetry: data?.canRetry !== false,
          queuePosition: data?.queuePosition || 0,
          queueActiveCount: data?.queueActiveCount || 0,
          queuePendingCount: data?.queuePendingCount || 0,
          queueConcurrency: data?.queueConcurrency || 0,
          queueRateLimitWaitMs: data?.queueRateLimitWaitMs || 0,
          queueRateLimitedUntil: data?.queueRateLimitedUntil || "",
        });
        return {
          state: "failed",
          data,
        };
      }

      if (data?.status === "cancelled") {
        const storyboardCellId =
          normalizeTextValue(requestTask?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(storyboardCells, requestTask?.requestId);

        if (storyboardCellId) {
          updateStoryboardCell(storyboardCellId, (cell) => ({
            ...cell,
            status: cell?.record ? "success" : "idle",
            statusText: data?.message || "任务已取消",
            error: "",
            pendingRequestId: "",
          }));
        }

        setStudioNotice(data?.message || "任务已取消");
        setStudioError("");
        updateRequestTask(
          requestTask.requestId,
          buildCancelledRequestTaskPatch(data?.message || "任务已取消"),
        );

        return {
          state: "cancelled",
          data,
        };
      }

      if (isRequestTaskRecoveryStale(requestTask, data?.updatedAt)) {
        const staleTaskPatch = buildMissingRecoverableRequestTaskPatch(
          requestTask,
          "任务状态长时间未更新，后端可能已丢失该任务，请重新生成",
        );
        updateRequestTask(requestTask.requestId, staleTaskPatch);
        setStudioNotice("");
        setStudioError(staleTaskPatch.error);

        return {
          state: "failed",
          data,
        };
      }

      updateRequestTask(requestTask.requestId, {
        status: normalizeRequestTaskProgress(data)?.status || "processing",
        stage: data?.stage || "accepted",
        message:
          data?.message || "网络中断后任务仍在后端处理中，恢复联网后会自动取回结果。",
        error: data?.error || "",
        canRetry: data?.canRetry !== false,
        queuePosition: data?.queuePosition || 0,
        queueActiveCount: data?.queueActiveCount || 0,
        queuePendingCount: data?.queuePendingCount || 0,
        queueConcurrency: data?.queueConcurrency || 0,
        queueRateLimitWaitMs: data?.queueRateLimitWaitMs || 0,
        queueRateLimitedUntil: data?.queueRateLimitedUntil || "",
      });
      setStudioNotice(
        data?.message || "网络中断后任务仍在后端处理中，恢复联网后会自动取回结果。",
      );

      return {
        state: "pending",
        data,
      };
    } catch (error) {
      if (error?.status === 404) {
        const createdAtMs = Date.parse(requestTask?.createdAt || "");
        const isFreshRequest =
          Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 60 * 1000;

        if (isFreshRequest) {
          setStudioNotice("正在尝试恢复上一次请求结果...");
          updateRequestTask(requestTask.requestId, {
            status: "queued",
            stage: "queued",
            message: "正在尝试恢复上一次请求结果...",
          });
          return {
            state: "pending",
            error,
          };
        }

        setStudioNotice("");
        setStudioError("未找到待恢复的请求记录，请重新生成");
        updateRequestTask(requestTask.requestId, {
          status: "failed",
          stage: "error",
          message: "未找到待恢复的请求记录，请重新生成",
          error: "未找到待恢复的请求记录，请重新生成",
        });
        return {
          state: "missing",
          error,
        };
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStudioNotice("网络已断开，恢复联网后会自动取回上一次生成结果。");
      }

      throw error;
    }
  }

  async function ensureGenerationLibraryLoaded() {
    if (generationLibraryLoaded) {
      return generationLibrary;
    }

    if (generationLibraryLoadPromiseRef.current) {
      return generationLibraryLoadPromiseRef.current;
    }

    const loadPromise = readPersistedGenerationLibrary()
      .then((records) => {
        setGenerationLibrary(records);
        setGenerationLibraryLoaded(true);
        return records;
      })
      .finally(() => {
        generationLibraryLoadPromiseRef.current = null;
      });

    generationLibraryLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }

  useEffect(() => {
    let cancelled = false;

    async function restorePersistedImages() {
      try {
        const [
          persistedCurrentRecord,
          persistedStoryboardCells,
          persistedReferenceImages,
          persistedSimpleReferenceImages,
        ] = await Promise.all([
          readPersistedCurrentGenerationRecord(),
          readPersistedStoryboardCells(),
          readPersistedReferenceImages(),
          readPersistedSimpleReferenceImages(),
        ]);

        if (cancelled) {
          return;
        }

        setGenerationResult(persistedCurrentRecord);
        setGenerationResults(persistedCurrentRecord ? [persistedCurrentRecord] : []);
        setReferenceImages(persistedReferenceImages.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT));
        setSimpleReferenceImages(
          persistedSimpleReferenceImages.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT),
        );
        setStoryboardCells((currentValue) =>
          mergeHydratedStoryboardCells(
            persistedStoryboardCells,
            currentValue,
            professionalLayoutRows,
            professionalLayoutColumns,
          ),
        );
      } catch (error) {
        console.warn("Restore persisted generation result failed:", error);
      } finally {
        if (!cancelled) {
          setSimpleReferenceImagesHydrated(true);
          setReferenceImagesHydrated(true);
          setStoryboardCellsHydrated(true);
        }
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
    if (isE2eStudioMode) {
      setActivePw("__banana_e2e__");
      setRemainingQuota(null);
      setSessionState("ready");
      return;
    }

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
  }, [isE2eStudioMode, routeMode, urlPassword]);

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
        setProfessionalSelectedModelId((currentValue) => {
          if (currentValue && data.models?.some((item) => item.id === currentValue)) {
            return currentValue;
          }

          const storedModelId =
            readLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY) ||
            readLocalValue(LEGACY_SELECTED_MODEL_STORAGE_KEY);

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

  function closeTaskStatusStream() {
    if (taskStatusStreamReconnectTimeoutRef.current) {
      window.clearTimeout(taskStatusStreamReconnectTimeoutRef.current);
      taskStatusStreamReconnectTimeoutRef.current = 0;
    }

    taskStatusStreamGenerationRef.current += 1;
    taskStatusStreamHandleRef.current?.close?.();
    taskStatusStreamHandleRef.current = null;
    taskStatusStreamRequestIdsRef.current = [];
    taskStatusStreamPasswordRef.current = "";
  }

  useEffect(() => {
    return () => {
      closeTaskStatusStream();
    };
  }, []);

  useEffect(() => {
    const shouldSubscribe =
      sessionState === "ready" &&
      Boolean(activePw) &&
      recoverableRequestTasks.length > 0 &&
      taskRecoveryPauseCount === 0 &&
      !studioPending &&
      !enhancePending;

    if (!shouldSubscribe) {
      closeTaskStatusStream();
      return;
    }

    const desiredRequestIds = recoverableRequestTasks.map((task) => task.requestId);
    const currentRequestIds = taskStatusStreamRequestIdsRef.current;
    const hasActiveStream = Boolean(taskStatusStreamHandleRef.current);
    const samePassword = taskStatusStreamPasswordRef.current === activePw;
    const alreadyWatchingDesiredTasks =
      hasActiveStream &&
      samePassword &&
      desiredRequestIds.every((requestId) => currentRequestIds.includes(requestId));

    if (alreadyWatchingDesiredTasks) {
      return;
    }

    const recoverTaskResultIfNeeded = async (requestId) => {
      if (
        !requestId ||
        taskRecoveryInFlightRequestIdsRef.current.has(requestId)
      ) {
        return;
      }

      const requestTask =
        useTaskStore
          .getState()
          .requestTasks.find((task) => task.requestId === requestId) || null;

      if (!requestTask || requestTask.status === "recovered") {
        return;
      }

      taskRecoveryInFlightRequestIdsRef.current.add(requestId);

      try {
        await recoverRequestTaskFromServer(requestTask);
      } finally {
        taskRecoveryInFlightRequestIdsRef.current.delete(requestId);
      }
    };

    closeTaskStatusStream();

    const streamGeneration = taskStatusStreamGenerationRef.current + 1;
    taskStatusStreamGenerationRef.current = streamGeneration;
    taskStatusStreamRequestIdsRef.current = desiredRequestIds.slice();
    taskStatusStreamPasswordRef.current = activePw;

    const connectTaskStream = () => {
      if (taskStatusStreamGenerationRef.current !== streamGeneration) {
        return;
      }

      taskStatusStreamHandleRef.current = subscribeTaskStatusStream(
        activePw,
        desiredRequestIds,
        {
          onStatus: (eventPayload) => {
            if (
              taskStatusStreamGenerationRef.current !== streamGeneration ||
              !eventPayload?.requestId ||
              eventPayload?.stage === "heartbeat"
            ) {
              return;
            }

            const currentTask =
              useTaskStore
                .getState()
                .requestTasks.find((task) => task.requestId === eventPayload.requestId) || null;

            if (isOrphanedPendingRequestTask(currentTask, eventPayload.backendStartedAt)) {
              updateRequestTask(eventPayload.requestId, buildOrphanedRequestTaskPatch(currentTask));
              return;
            }

            updateRequestTask(eventPayload.requestId, {
              status: normalizeRequestTaskProgress(eventPayload)?.status || eventPayload.status,
              stage: eventPayload.stage || "accepted",
              message: eventPayload.message || "",
              error: eventPayload.error || "",
              canRetry: eventPayload.canRetry !== false,
              queuePosition: eventPayload.queuePosition || 0,
              queueActiveCount: eventPayload.queueActiveCount || 0,
              queuePendingCount: eventPayload.queuePendingCount || 0,
              queueConcurrency: eventPayload.queueConcurrency || 0,
              queueRateLimitWaitMs: eventPayload.queueRateLimitWaitMs || 0,
              queueRateLimitedUntil: eventPayload.queueRateLimitedUntil || "",
            });

            if (eventPayload.status === "succeeded") {
              void recoverTaskResultIfNeeded(eventPayload.requestId);
            }
          },
        },
      );

      taskStatusStreamHandleRef.current.ready
        .then(() => {})
        .catch(() => {
          if (taskStatusStreamGenerationRef.current !== streamGeneration) {
            return;
          }

          if (taskStatusStreamReconnectTimeoutRef.current) {
            window.clearTimeout(taskStatusStreamReconnectTimeoutRef.current);
          }

          taskStatusStreamReconnectTimeoutRef.current = window.setTimeout(() => {
            taskStatusStreamReconnectTimeoutRef.current = 0;
            connectTaskStream();
          }, 1500);
        });
    };

    connectTaskStream();
  }, [
    activePw,
    enhancePending,
    recoverableRequestTaskSignature,
    sessionState,
    taskRecoveryPauseCount,
    studioPending,
    updateRequestTask,
  ]);

  const selectedModel = useMemo(() => {
    return models.find((item) => item.id === professionalSelectedModelId) || null;
  }, [models, professionalSelectedModelId]);
  const simplePanelModelId = useMemo(() => {
    return resolveSimplePanelModelId(models, "");
  }, [models]);
  const simplePanelModel = useMemo(() => {
    return models.find((item) => item.id === simplePanelModelId) || null;
  }, [models, simplePanelModelId]);

  const availableAspectRatioOptions = useMemo(() => {
    return getModelAspectRatioOptions(selectedModel);
  }, [selectedModel]);
  const availableAspectRatioValueSet = useMemo(
    () => new Set(availableAspectRatioOptions.map((option) => option.value)),
    [availableAspectRatioOptions],
  );
  const availableImageSizeOptions = useMemo(() => {
    return getModelImageSizeOptions(selectedModel);
  }, [selectedModel]);
  const availableImageSizeValueSet = useMemo(
    () => new Set(availableImageSizeOptions.map((option) => option.value)),
    [availableImageSizeOptions],
  );
  const professionalDefaultCellAspectRatio = useMemo(() => {
    if (
      availableAspectRatioOptions.some(
        (option) => option.value === PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO,
      )
    ) {
      return PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO;
    }

    return availableAspectRatioOptions[0]?.value || "1:1";
  }, [availableAspectRatioOptions]);
  const professionalDefaultCellImageSize = useMemo(() => {
    if (availableImageSizeOptions.some((option) => option.value === "1K")) {
      return "1K";
    }

    return availableImageSizeOptions[0]?.value || "1K";
  }, [availableImageSizeOptions]);
  const professionalStoryboardAspectRatioValue = useMemo(() => {
    if (availableAspectRatioValueSet.has(professionalStoryboardAspectRatio)) {
      return professionalStoryboardAspectRatio;
    }

    return professionalDefaultCellAspectRatio;
  }, [
    availableAspectRatioValueSet,
    professionalDefaultCellAspectRatio,
    professionalStoryboardAspectRatio,
  ]);
  const professionalStoryboardImageSizeValue = useMemo(() => {
    if (availableImageSizeValueSet.has(professionalStoryboardImageSize)) {
      return professionalStoryboardImageSize;
    }

    return professionalDefaultCellImageSize;
  }, [
    availableImageSizeValueSet,
    professionalDefaultCellImageSize,
    professionalStoryboardImageSize,
  ]);
  const storyboardCellAspectRatio = useMemo(() => {
    const cellWidth = professionalExportMetrics?.cellWidth || 1;
    const cellHeight = professionalExportMetrics?.cellHeight || 1;
    return cellWidth / cellHeight;
  }, [professionalExportMetrics]);
  const recommendedStoryboardAspectRatio = useMemo(
    () =>
      findRecommendedStoryboardAspectRatioOption(
        availableAspectRatioOptions,
        storyboardCellAspectRatio,
      ),
    [availableAspectRatioOptions, storyboardCellAspectRatio],
  );
  const canApplyRecommendedStoryboardAspectRatio =
    recommendedStoryboardAspectRatio &&
    recommendedStoryboardAspectRatio.option.value !== professionalStoryboardAspectRatioValue;
  const storyboardCellList = useMemo(
    () =>
      storyboardCellDefinitions.map(
        (definition) => storyboardCells[definition.id] || createStoryboardCellState(definition),
      ),
    [
      storyboardCellDefinitions,
      storyboardCells,
    ],
  );
  const storyboardSortableIds = useMemo(
    () => storyboardCellList.map((cell) => cell.id),
    [storyboardCellList],
  );
  const storyboardEditorCellIndex = useMemo(
    () => storyboardCellList.findIndex((cell) => cell.id === storyboardEditorCellId),
    [storyboardCellList, storyboardEditorCellId],
  );
  const previousStoryboardEditorCell =
    storyboardEditorCellIndex > 0 ? storyboardCellList[storyboardEditorCellIndex - 1] : null;
  const nextStoryboardEditorCell =
    storyboardEditorCellIndex >= 0 && storyboardEditorCellIndex < storyboardCellList.length - 1
      ? storyboardCellList[storyboardEditorCellIndex + 1]
      : null;
  const storyboardCellClearConfirmCell = storyboardCellClearConfirmCellId
    ? storyboardCells[storyboardCellClearConfirmCellId] || null
    : null;
  const requestTaskCancelConfirmTask = requestTaskCancelConfirmId
    ? requestTasks.find((task) => task.requestId === requestTaskCancelConfirmId) || null
    : null;
  const storyboardHasContent = useMemo(
    () => storyboardCellList.some((cell) => doesStoryboardCellHaveContent(cell)),
    [storyboardCellList],
  );
  const storyboardShareText = useMemo(() => {
    const shareSections = [
      "专业模式分享",
      "",
      "参数",
      `底模：${selectedModel?.name || professionalSelectedModelId || "未选择"}`,
      `常用场景：${professionalCanvasSizeOption.label}`,
      `分镜布局：${professionalLayoutRows} 行 × ${professionalLayoutColumns} 列`,
      `图片比例：${professionalStoryboardAspectRatioValue}`,
      `分辨率：${professionalStoryboardImageSizeValue}`,
      `分割线：${professionalStoryboardDividerWidthPx}px`,
      `配文字号：${professionalStoryboardCaptionFontSizePercent}%`,
      `整体画风参考图：${professionalStyleReference?.name || "未设置"}`,
      "",
      "全局提示词与画风参考图",
      normalizeTextValue(professionalGlobalPrompt) || "未填写",
      "",
      "分镜提示词与配文",
    ];
    const cellSections = storyboardCellList
      .map((cell) => {
        const prompt = normalizeTextValue(cell.prompt);
        const caption = normalizeTextValue(cell.caption);

        if (!prompt && !caption) {
          return "";
        }

        return [
          `${cell.label}｜行 ${cell.row} / 列 ${cell.column}`,
          `提示词：${prompt || "未填写"}`,
          `配文：${caption || "未填写"}`,
          `格子参考图：${cell.referenceImages?.[0]?.name || "未设置"}`,
        ].join("\n");
      })
      .filter(Boolean);

    return [
      ...shareSections,
      ...(cellSections.length > 0 ? cellSections : ["未填写任何格子提示词或配文"]),
    ]
      .join("\n\n")
      .trim();
  }, [
    professionalCanvasSizeOption.label,
    professionalGlobalPrompt,
    professionalLayoutColumns,
    professionalLayoutRows,
    professionalSelectedModelId,
    professionalStoryboardAspectRatioValue,
    professionalStoryboardCaptionFontSizePercent,
    professionalStoryboardDividerWidthPx,
    professionalStoryboardImageSizeValue,
    professionalStyleReference?.name,
    selectedModel?.name,
    storyboardCellList,
  ]);
  const storyboardHasLoadingCells = useMemo(
    () => storyboardCellList.some((cell) => cell.status === "loading"),
    [storyboardCellList],
  );
  const professionalExportHasRenderableContent = useMemo(
    () =>
      storyboardCellList.some(
        (cell) => cell.record || normalizeTextValue(cell.prompt),
      ),
    [storyboardCellList],
  );

  const simplePanelImageSize = useMemo(() => {
    const simpleImageSizeOptions = getModelImageSizeOptions(simplePanelModel);

    if (simpleImageSizeOptions.some((option) => option.value === SIMPLE_PANEL_DEFAULTS.imageSize)) {
      return SIMPLE_PANEL_DEFAULTS.imageSize;
    }

    return simpleImageSizeOptions[0]?.value || "1K";
  }, [simplePanelModel]);
  const generationModelId = isSimplePanelMode ? simplePanelModelId : professionalSelectedModelId;
  const generationAspectRatio = isSimplePanelMode
    ? null
    : professionalStoryboardAspectRatioValue;
  const generationImageSize = isSimplePanelMode
    ? simplePanelImageSize
    : professionalStoryboardImageSizeValue;
  const generationImageCount = isSimplePanelMode
    ? SIMPLE_PANEL_DEFAULTS.imageCount
    : professionalSelectedImageCount;
  const generationLayoutRows = isSimplePanelMode
    ? SIMPLE_PANEL_DEFAULTS.layoutRows
    : professionalLayoutRows;
  const generationLayoutColumns = isSimplePanelMode
    ? SIMPLE_PANEL_DEFAULTS.layoutColumns
    : professionalLayoutColumns;
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
    writeLocalValue(PANEL_MODE_STORAGE_KEY, panelMode);
  }, [panelMode]);

  useEffect(() => {
    writeLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY, professionalSelectedModelId);
  }, [professionalSelectedModelId]);

  useEffect(() => {
    writeLocalValue(PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY, professionalGlobalPrompt);
  }, [professionalGlobalPrompt]);

  useEffect(() => {
    if (
      normalizeCanvasScenarioValue(
        professionalCanvasSize,
        professionalCustomScenarios,
      ) !== professionalCanvasSize
    ) {
      setProfessionalCanvasSize(CANVAS_SIZE_OPTIONS[0].value);
      return;
    }

    writeLocalValue(PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY, professionalCanvasSize);
  }, [professionalCanvasSize, professionalCustomScenarios]);

  useEffect(() => {
    const persistedValue = buildPersistedProfessionalCustomScenarios(professionalCustomScenarios);
    writeLocalValue(
      PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY,
      persistedValue.length > 0 ? JSON.stringify(persistedValue) : "",
    );
  }, [professionalCustomScenarios]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY,
      String(normalizeCanvasDimensionValue(professionalCustomCanvasWidth, DEFAULT_CUSTOM_CANVAS_WIDTH)),
    );
  }, [professionalCustomCanvasWidth]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY,
      String(normalizeCanvasDimensionValue(professionalCustomCanvasHeight, DEFAULT_CUSTOM_CANVAS_HEIGHT)),
    );
  }, [professionalCustomCanvasHeight]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
      String(professionalLayoutRows),
    );
  }, [professionalLayoutRows]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
      String(professionalLayoutColumns),
    );
  }, [professionalLayoutColumns]);

  useEffect(() => {
    if (!availableAspectRatioValueSet.has(professionalStoryboardAspectRatio)) {
      setProfessionalStoryboardAspectRatio(professionalDefaultCellAspectRatio);
      return;
    }

    writeLocalValue(
      PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY,
      professionalStoryboardAspectRatio,
    );
  }, [
    availableAspectRatioValueSet,
    professionalDefaultCellAspectRatio,
    professionalStoryboardAspectRatio,
  ]);

  useEffect(() => {
    if (!availableImageSizeValueSet.has(professionalStoryboardImageSize)) {
      setProfessionalStoryboardImageSize(professionalDefaultCellImageSize);
      return;
    }

    writeLocalValue(
      PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY,
      professionalStoryboardImageSize,
    );
  }, [
    availableImageSizeValueSet,
    professionalDefaultCellImageSize,
    professionalStoryboardImageSize,
  ]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY,
      String(normalizeStoryboardDividerWidthPx(professionalStoryboardDividerWidthPx)),
    );
  }, [professionalStoryboardDividerWidthPx]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY,
      String(
        normalizeStoryboardCaptionFontSizePercent(
          professionalStoryboardCaptionFontSizePercent,
        ),
      ),
    );
  }, [professionalStoryboardCaptionFontSizePercent]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY,
      String(
        normalizeStoryboardCaptionBackgroundAlphaPercent(
          professionalStoryboardCaptionBackgroundAlphaPercent,
        ),
      ),
    );
  }, [professionalStoryboardCaptionBackgroundAlphaPercent]);

  useEffect(() => {
    if (!SUPPORTED_IMAGE_COUNT_VALUES.has(professionalSelectedImageCount)) {
      setProfessionalSelectedImageCount(1);
      return;
    }

    writeLocalValue(
      PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY,
      String(professionalSelectedImageCount),
    );
  }, [professionalSelectedImageCount]);

  useEffect(() => {
    writeLocalValue(SIMPLE_PROMPT_STORAGE_KEY, simplePrompt);
  }, [simplePrompt]);

  useEffect(() => {
    setStoryboardCells((currentValue) =>
      normalizeStoryboardCells(currentValue, professionalLayoutRows, professionalLayoutColumns),
    );
  }, [
    professionalLayoutColumns,
    professionalLayoutRows,
  ]);

  useEffect(() => {
    if (!storyboardCellsHydrated) {
      return;
    }

    setStoryboardCells((currentValue) => {
      const latestStoryboardTaskByCellId = new Map();

      requestTasks.forEach((task) => {
        const storyboardCellId =
          normalizeTextValue(task?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(currentValue, task?.requestId);

        if (!storyboardCellId || !currentValue[storyboardCellId]) {
          return;
        }

        const taskTimeMs =
          parseRequestTaskTimeMs(task?.updatedAt) || parseRequestTaskTimeMs(task?.createdAt);
        const currentTask = latestStoryboardTaskByCellId.get(storyboardCellId);
        const currentTaskTimeMs = currentTask
          ? parseRequestTaskTimeMs(currentTask?.updatedAt) ||
            parseRequestTaskTimeMs(currentTask?.createdAt)
          : 0;

        if (!currentTask || taskTimeMs >= currentTaskTimeMs) {
          latestStoryboardTaskByCellId.set(storyboardCellId, task);
        }
      });

      if (latestStoryboardTaskByCellId.size === 0) {
        return currentValue;
      }

      let hasChanges = false;
      const nextValue = { ...currentValue };

      latestStoryboardTaskByCellId.forEach((task, cellId) => {
        const currentCell = currentValue[cellId];

        if (!currentCell) {
          return;
        }

        const patch = buildStoryboardCellTaskPatch(task, currentCell);

        if (!patch) {
          return;
        }

        const nextCell = {
          ...currentCell,
          ...patch,
        };

        if (
          nextCell.status !== currentCell.status ||
          nextCell.statusText !== currentCell.statusText ||
          nextCell.error !== currentCell.error
        ) {
          nextValue[cellId] = nextCell;
          hasChanges = true;
        }
      });

      return hasChanges ? nextValue : currentValue;
    });
  }, [requestTasks, storyboardCellsHydrated]);

  useEffect(() => {
    if (!storyboardCellsHydrated || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writePersistedStoryboardCells(storyboardCells).catch((error) => {
        console.warn("Persist storyboard cells failed:", error);
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [storyboardCells, storyboardCellsHydrated]);

  useEffect(() => {
    if (!simpleReferenceImagesHydrated || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writePersistedSimpleReferenceImages(simpleReferenceImages).catch((error) => {
        console.warn("Persist simple reference images failed:", error);
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [simpleReferenceImages, simpleReferenceImagesHydrated]);

  useEffect(() => {
    if (!referenceImagesHydrated || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writePersistedReferenceImages(referenceImages).catch((error) => {
        console.warn("Persist professional reference images failed:", error);
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [referenceImages, referenceImagesHydrated]);

  useEffect(() => {
    if (!storyboardEditorCellId) {
      return;
    }

    if (storyboardCells[storyboardEditorCellId]) {
      return;
    }

    setStoryboardEditorCellId("");
  }, [storyboardCells, storyboardEditorCellId]);

  useEffect(() => {
    if (!storyboardCellClearConfirmCellId) {
      return;
    }

    const targetCell = storyboardCells[storyboardCellClearConfirmCellId];

    if (targetCell && doesStoryboardCellHaveContent(targetCell)) {
      return;
    }

    setStoryboardCellClearConfirmCellId("");
  }, [storyboardCellClearConfirmCellId, storyboardCells]);

  useEffect(() => {
    setStoryboardLibraryPickerOpen(false);
    setStoryboardLibraryPickerPending(false);
    if (storyboardLibraryPickerTimeoutRef.current) {
      window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      storyboardLibraryPickerTimeoutRef.current = null;
    }
  }, [storyboardEditorCellId]);

  useEffect(() => {
    if (storyboardEditorMode === STORYBOARD_EDITOR_MODE_ASSET) {
      return;
    }

    setStoryboardLibraryPickerOpen(false);
    setStoryboardLibraryPickerPending(false);
    if (storyboardLibraryPickerTimeoutRef.current) {
      window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      storyboardLibraryPickerTimeoutRef.current = null;
    }
  }, [storyboardEditorMode]);

  useEffect(() => {
    return () => {
      if (storyboardShareCopyResetTimeoutRef.current) {
        window.clearTimeout(storyboardShareCopyResetTimeoutRef.current);
      }
      if (storyboardLibraryPickerTimeoutRef.current) {
        window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasLayoutValues) {
      return;
    }

    drawLayoutGuide(layoutCanvasRef.current, {
      aspectRatio: formatCanvasSizeAspectRatioValue(professionalCanvasSizeOption),
      rows: professionalLayoutRows,
      columns: professionalLayoutColumns,
    });
  }, [
    hasLayoutValues,
    professionalCanvasSizeOption,
    professionalLayoutColumns,
    professionalLayoutRows,
  ]);

  useEffect(() => {
    const textarea = promptTextareaRef.current;

    if (!textarea) {
      return;
    }

    if (isPromptFocusMode) {
      textarea.style.height = "100%";
      textarea.style.overflowY = "auto";
      return;
    }

    resizePromptTextarea(textarea);
  }, [isPromptFocusMode, simplePrompt]);

  useEffect(() => {
    if (!isPromptFocusMode) {
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
  }, [isPromptFocusMode]);

  useEffect(() => {
    const textarea = storyboardCaptionTextareaRef.current;

    if (!textarea || !storyboardEditorOpen) {
      return;
    }

    resizePromptTextarea(textarea);
  }, [storyboardEditorOpen, storyboardEditorCell?.id, storyboardEditorCell?.caption]);

  useLayoutEffect(() => {
    const card = professionalExportCardElement;

    if (!card || !shouldRenderProfessionalExportPreview) {
      setProfessionalExportScale(1);
      return;
    }

    const updateScale = () => {
      const measuredCardWidth = card.getBoundingClientRect().width;
      const availableWidth = Math.max(measuredCardWidth, 1);
      const maxPreviewHeight = Math.max(
        Math.min(window.innerHeight * 0.72, 860),
        320,
      );
      const nextScale = Math.min(
        availableWidth / professionalCanvasSizeOption.width,
        maxPreviewHeight / professionalCanvasSizeOption.height,
        1,
      );

      setProfessionalExportScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale,
      );
    };

    const animationFrameId = window.requestAnimationFrame(() => {
      updateScale();
    });

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);

      return () => {
        window.cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", updateScale);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(card);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [
    professionalExportCardElement,
    professionalCanvasSizeOption.height,
    professionalCanvasSizeOption.width,
    shouldRenderProfessionalExportPreview,
  ]);

  useEffect(() => {
    if (!showPromptField && promptMode === "focus") {
      setPromptMode("simple");
    }
  }, [promptMode, showPromptField]);

  useEffect(() => {
    if (isProfessionalPanelMode) {
      return;
    }

    setStoryboardEditorCellId("");
    setStoryboardClearConfirmOpen(false);
    setStoryboardCellClearConfirmCellId("");
    setRequestTaskCancelConfirmId("");
  }, [isProfessionalPanelMode]);

  useEffect(() => {
    if (!requestTaskCancelConfirmId) {
      return;
    }

    if (!requestTaskCancelConfirmTask || isRequestTaskTerminal(requestTaskCancelConfirmTask)) {
      setRequestTaskCancelConfirmId("");
    }
  }, [requestTaskCancelConfirmId, requestTaskCancelConfirmTask]);

  useEffect(() => {
    if (
      (!imagePreviewOpen &&
        !resourceManagerOpen &&
        !storyboardEditorOpen &&
        !storyboardClearConfirmOpen &&
        !storyboardCellClearConfirmCellId) ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
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

        if (storyboardClearConfirmOpen) {
          closeStoryboardClearConfirm();
          return;
        }

        if (storyboardCellClearConfirmCellId) {
          closeStoryboardCellClearConfirm();
          return;
        }

        if (requestTaskCancelConfirmId) {
          closeRequestTaskCancelConfirm();
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
  }, [
    imagePreviewOpen,
    resourceManagerOpen,
    storyboardCellClearConfirmCellId,
    storyboardClearConfirmOpen,
    storyboardEditorOpen,
  ]);

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

  useEffect(() => {
    if (
      !storyboardEditorOpen ||
      !storyboardEditorCellId ||
      imagePreviewOpen ||
      resourceManagerOpen ||
      storyboardClearConfirmOpen ||
      requestTaskCancelConfirmId ||
      typeof window === "undefined"
    ) {
      return;
    }

    function handlePaste(event) {
      const imageFiles = getImageFilesFromClipboardData(event.clipboardData);

      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();

      if (storyboardEditorMode === STORYBOARD_EDITOR_MODE_ASSET) {
        void appendStoryboardLocalImageFiles(imageFiles, "已粘贴剪贴板图片，仅作用于当前格子");
        return;
      }

      void appendStoryboardReferenceFiles(imageFiles);
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [
    imagePreviewOpen,
    requestTaskCancelConfirmId,
    resourceManagerOpen,
    storyboardClearConfirmOpen,
    storyboardEditorCellId,
    storyboardEditorMode,
    storyboardEditorOpen,
  ]);

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
      aspectRatio: formatCanvasSizeAspectRatioValue(professionalCanvasSizeOption),
      rows: professionalLayoutRows,
      columns: professionalLayoutColumns,
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

  async function handleDownloadProfessionalExport() {
    if (!activePw || !professionalExportHasRenderableContent) {
      return;
    }

    setStudioError("");
    setProfessionalExportPending(true);
    const releaseBackendRequest = beginBackendRequest(
      "正在导出专业模式预览...",
      secondsToEstimateMs(12),
    );

    try {
      const { blob, filename } = await requestProfessionalExportPreview(
        activePw,
        buildProfessionalExportPayload({
          canvasSizeOption: professionalCanvasSizeOption,
          rows: professionalLayoutRows,
          columns: professionalLayoutColumns,
          cells: storyboardCellList,
          title: professionalGlobalPrompt || "专业模式导出预览",
          dividerStyle: {
            widthPx: professionalStoryboardDividerWidthPx,
          },
          captionStyle: {
            fontSizePercent: professionalStoryboardCaptionFontSizePercent,
            backgroundAlphaPercent: professionalStoryboardCaptionBackgroundAlphaPercent,
          },
        }),
      );

      await saveBlobFile(
        blob,
        filename ||
          buildDownloadNameWithOptions({
            mimeType: "image/png",
            suffix: "professional-export",
          }),
      );
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "导出预览失败");
    } finally {
      releaseBackendRequest();
      setProfessionalExportPending(false);
    }
  }

  async function applyImportedProfessionalScene(sceneState) {
    const persistedCustomScenarios = buildPersistedProfessionalCustomScenarios(
      sceneState.customScenarios,
    );

    setPanelMode(PANEL_MODE_PROFESSIONAL);
    setProfessionalSelectedModelId(sceneState.selectedModelId);
    setProfessionalGlobalPrompt(sceneState.globalPrompt);
    setProfessionalCustomScenarios(sceneState.customScenarios);
    setProfessionalCanvasSize(sceneState.canvasSize);
    setProfessionalCustomCanvasWidth(sceneState.customCanvasWidth);
    setProfessionalCustomCanvasHeight(sceneState.customCanvasHeight);
    setProfessionalLayoutRows(sceneState.layoutRows);
    setProfessionalLayoutColumns(sceneState.layoutColumns);
    setProfessionalStoryboardAspectRatio(sceneState.storyboardAspectRatio);
    setProfessionalStoryboardImageSize(sceneState.storyboardImageSize);
    setProfessionalSelectedImageCount(sceneState.selectedImageCount);
    setProfessionalStoryboardDividerWidthPx(sceneState.storyboardDividerWidthPx);
    setProfessionalStoryboardCaptionFontSizePercent(
      sceneState.storyboardCaptionFontSizePercent,
    );
    setProfessionalStoryboardCaptionBackgroundAlphaPercent(
      sceneState.storyboardCaptionBackgroundAlphaPercent,
    );
    setReferenceImages(sceneState.referenceImages);
    setReferenceImagesHydrated(true);
    setStoryboardCells(sceneState.storyboardCells);
    setStoryboardCellsHydrated(true);
    setPromptMode("simple");
    setStoryboardImageControlsCollapsed(true);
    setStoryboardStyleControlsCollapsed(true);
    setScenarioManagerOpen(false);
    setResourceManagerOpen(false);
    closeStoryboardEditor();
    closeStoryboardClearConfirm();
    closeImagePreview();
    setStudioError("");

    if (!isMobilePerformanceMode) {
      setProfessionalExportPreviewVisible(true);
    }

    writeLocalValue(PANEL_MODE_STORAGE_KEY, PANEL_MODE_PROFESSIONAL);
    writeLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY, sceneState.selectedModelId);
    writeLocalValue(PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY, sceneState.globalPrompt);
    writeLocalValue(PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY, sceneState.canvasSize);
    writeLocalValue(
      PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY,
      persistedCustomScenarios.length > 0 ? JSON.stringify(persistedCustomScenarios) : "",
    );
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY,
      String(sceneState.customCanvasWidth),
    );
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY,
      String(sceneState.customCanvasHeight),
    );
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
      String(sceneState.layoutRows),
    );
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
      String(sceneState.layoutColumns),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY,
      sceneState.storyboardAspectRatio,
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY,
      sceneState.storyboardImageSize,
    );
    writeLocalValue(
      PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY,
      String(sceneState.selectedImageCount),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY,
      String(sceneState.storyboardDividerWidthPx),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY,
      String(sceneState.storyboardCaptionFontSizePercent),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY,
      String(sceneState.storyboardCaptionBackgroundAlphaPercent),
    );

    await Promise.all([
      writePersistedReferenceImages(sceneState.referenceImages),
      writePersistedStoryboardCells(sceneState.storyboardCells),
    ]);
  }

  async function handleExportProfessionalScene() {
    if (!professionalSceneTransferReady) {
      return;
    }

    setProfessionalSceneTransferPending(true);
    setStudioError("");

    try {
      const archive = buildProfessionalSceneArchive({
        selectedModelId: professionalSelectedModelId,
        globalPrompt: professionalGlobalPrompt,
        canvasSize: professionalCanvasSize,
        customScenarios: professionalCustomScenarios,
        customCanvasWidth: professionalCustomCanvasWidth,
        customCanvasHeight: professionalCustomCanvasHeight,
        layoutRows: professionalLayoutRows,
        layoutColumns: professionalLayoutColumns,
        storyboardAspectRatio: professionalStoryboardAspectRatioValue,
        storyboardImageSize: professionalStoryboardImageSizeValue,
        selectedImageCount: professionalSelectedImageCount,
        storyboardDividerWidthPx: professionalStoryboardDividerWidthPx,
        storyboardCaptionFontSizePercent: professionalStoryboardCaptionFontSizePercent,
        storyboardCaptionBackgroundAlphaPercent:
          professionalStoryboardCaptionBackgroundAlphaPercent,
        referenceImages,
        storyboardCells,
      });

      downloadTextFile(
        buildProfessionalSceneArchiveDownloadName(),
        JSON.stringify(archive, null, 2),
      );
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "专业模式场景导出失败");
    } finally {
      setProfessionalSceneTransferPending(false);
    }
  }

  function handleOpenProfessionalSceneImport() {
    if (professionalSceneTransferPending || !professionalSceneTransferReady) {
      return;
    }

    professionalSceneImportInputRef.current?.click();
  }

  async function handleImportProfessionalSceneFileChange(event) {
    const [file] = Array.from(event.target.files || []);

    if (!file) {
      return;
    }

    setProfessionalSceneTransferPending(true);
    setStudioError("");

    try {
      const rawText = await readFileAsText(file);
      let parsedValue = null;

      try {
        parsedValue = JSON.parse(rawText);
      } catch {
        throw new Error("场景文件不是合法的 JSON");
      }

      const sceneState = resolveProfessionalSceneArchiveState(parsedValue);
      await applyImportedProfessionalScene(sceneState);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "专业模式场景导入失败");
    } finally {
      setProfessionalSceneTransferPending(false);
      event.target.value = "";
    }
  }

  async function appendReferenceFiles(files) {
    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFiles = imageFiles.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT);

      if (nextFiles.length === 0) {
        setStudioError("请上传 1 张图片作为整体画风参考");
        return;
      }

      setStudioNotice(
        nextFiles.some((file) => file.size > REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES)
          ? "正在优化参考图，上传大图时会自动压缩到更稳定的体积..."
          : "",
      );
      const parsedImages = await Promise.all(nextFiles.map(readFileAsReferenceImage));
      setReferenceImages(parsedImages);
      setStudioError("");
      setStudioNotice("");
    } catch (error) {
      setStudioNotice("");
      setStudioError(error instanceof Error ? error.message : "图片读取失败");
    }
  }

  async function appendSimpleReferenceFiles(files) {
    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFiles = imageFiles.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT);

      if (nextFiles.length === 0) {
        setStudioError("请上传 1 张图片作为简易模式参考图");
        return;
      }

      setStudioNotice(
        nextFiles.some((file) => file.size > REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES)
          ? "正在优化参考图，上传大图时会自动压缩到更稳定的体积..."
          : "",
      );
      const parsedImages = await Promise.all(nextFiles.map(readFileAsReferenceImage));
      setSimpleReferenceImages(parsedImages);
      setSimpleReferenceDisclosureOpen(true);
      setStudioError("");
      setStudioNotice("");
    } catch (error) {
      setStudioNotice("");
      setStudioError(error instanceof Error ? error.message : "图片读取失败");
    }
  }

  async function appendStoryboardReferenceFiles(files) {
    if (!storyboardEditorCellId) {
      return;
    }

    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFiles = imageFiles.slice(0, STORYBOARD_CELL_REFERENCE_LIMIT);

      if (nextFiles.length === 0) {
        updateStoryboardCell(storyboardEditorCellId, (cell) => ({
          ...cell,
          error: "请上传 1 张图片作为当前格子的参考图",
        }));
        return;
      }

      setStudioNotice(
        nextFiles.some((file) => file.size > REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES)
          ? "正在优化参考图，上传大图时会自动压缩到更稳定的体积..."
          : "",
      );
      const parsedImages = await Promise.all(nextFiles.map(readFileAsReferenceImage));
      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        referenceImages: parsedImages,
        error: "",
      }));
      setStudioError("");
      setStudioNotice("");
    } catch (error) {
      setStudioNotice("");
      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        error: error instanceof Error ? error.message : "参考图读取失败",
      }));
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

  async function handleSimpleReferenceFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    try {
      await appendSimpleReferenceFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  async function handleStoryboardReferenceFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    try {
      await appendStoryboardReferenceFiles(files);
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

  async function handleSimpleReferenceUploadDrop(event) {
    event.preventDefault();
    setUploadDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);

    if (files.length === 0) {
      return;
    }

    await appendSimpleReferenceFiles(files);
  }

  function handleRemoveReferenceImage(imageId) {
    setReferenceImages((currentValue) =>
      currentValue.filter((image) => image.id !== imageId),
    );
  }

  function handleRemoveSimpleReferenceImage(imageId) {
    setSimpleReferenceImages((currentValue) =>
      currentValue.filter((image) => image.id !== imageId),
    );
  }

  function handleRemoveStoryboardReferenceImage(imageId) {
    if (!storyboardEditorCellId) {
      return;
    }

    updateStoryboardCell(storyboardEditorCellId, (cell) => ({
      ...cell,
      referenceImages: Array.isArray(cell.referenceImages)
        ? cell.referenceImages.filter((image) => image.id !== imageId)
        : [],
      error: "",
    }));
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
    const existingLibraryRecords = await ensureGenerationLibraryLoaded();
    const nextRecordIds = new Set(records.map((record) => record.id));
    const nextLibraryRecords = [
      ...records,
      ...existingLibraryRecords.filter((record) => !nextRecordIds.has(record.id)),
    ];
    const currentRecord =
      nextLibraryRecords.find((record) => record.id === currentRecordId) ||
      records[0] ||
      null;

    await Promise.all([
      writePersistedGenerationLibrary(nextLibraryRecords),
      writeLastGenerationRecordId(currentRecordId),
      writeLastGenerationRecord(currentRecord),
    ]);

    setGenerationLibrary(nextLibraryRecords);
    setGenerationLibraryLoaded(true);
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
    void Promise.all([
      writeLastGenerationRecordId(record.id),
      writeLastGenerationRecord(record),
    ]);
  }

  function handleProfessionalScenarioChange(value) {
    const scenario = getCanvasScenarioOption(value, professionalCustomScenarios);
    const nextRows = clampLayoutTrack(scenario.layoutRows);
    const nextColumns = clampLayoutTrack(scenario.layoutColumns);
    const nextRecommendedAspectRatio = findRecommendedStoryboardAspectRatioForLayout({
      options: availableAspectRatioOptions,
      canvasWidth:
        scenario.value === CUSTOM_CANVAS_SIZE_VALUE
          ? professionalCustomCanvasWidth
          : scenario.width,
      canvasHeight:
        scenario.value === CUSTOM_CANVAS_SIZE_VALUE
          ? professionalCustomCanvasHeight
          : scenario.height,
      rows: nextRows,
      columns: nextColumns,
    });

    setProfessionalCanvasSize(scenario.value);
    setProfessionalLayoutRows(nextRows);
    setProfessionalLayoutColumns(nextColumns);

    if (nextRecommendedAspectRatio?.option?.value) {
      setProfessionalStoryboardAspectRatio(nextRecommendedAspectRatio.option.value);
    }
  }

  function buildScenarioManagerDraft(sourceScenario = null) {
    return {
      value: sourceScenario?.value || "",
      label: sourceScenario?.label || "我的场景",
      width: String(
        normalizeCanvasDimensionValue(
          sourceScenario?.width,
          professionalCanvasSizeOption.width || DEFAULT_CUSTOM_CANVAS_WIDTH,
        ),
      ),
      height: String(
        normalizeCanvasDimensionValue(
          sourceScenario?.height,
          professionalCanvasSizeOption.height || DEFAULT_CUSTOM_CANVAS_HEIGHT,
        ),
      ),
      layoutRows: clampLayoutTrack(
        sourceScenario?.layoutRows || professionalLayoutRows || 1,
      ),
      layoutColumns: clampLayoutTrack(
        sourceScenario?.layoutColumns || professionalLayoutColumns || 1,
      ),
    };
  }

  function openScenarioManager() {
    if (activeCustomScenario) {
      setScenarioManagerSelectedType("custom");
      setScenarioManagerSelectedId(activeCustomScenario.value);
      setScenarioManagerDraft(buildScenarioManagerDraft(activeCustomScenario));
      setScenarioManagerOpen(true);
      return;
    }

    if (activeSystemScenario) {
      setScenarioManagerSelectedType("system");
      setScenarioManagerSelectedId(activeSystemScenario.value);
      setScenarioManagerDraft(buildScenarioManagerDraft(activeSystemScenario));
      setScenarioManagerOpen(true);
      return;
    }

    setScenarioManagerSelectedType("new");
    setScenarioManagerSelectedId("");
    setScenarioManagerDraft(buildScenarioManagerDraft());
    setScenarioManagerOpen(true);
  }

  function closeScenarioManager() {
    setScenarioManagerOpen(false);
  }

  function handleScenarioManagerSelect(value) {
    const scenario = professionalCustomScenarios.find((item) => item.value === value);

    if (!scenario) {
      return;
    }

    setScenarioManagerSelectedType("custom");
    setScenarioManagerSelectedId(scenario.value);
    setScenarioManagerDraft(buildScenarioManagerDraft(scenario));
  }

  function handleScenarioManagerSelectSystem(value) {
    const scenario = CANVAS_SIZE_OPTIONS.find((item) => item.value === value);

    if (!scenario) {
      return;
    }

    setScenarioManagerSelectedType("system");
    setScenarioManagerSelectedId(scenario.value);
    setScenarioManagerDraft(buildScenarioManagerDraft(scenario));
  }

  function handleScenarioManagerCreate() {
    setScenarioManagerSelectedType("new");
    setScenarioManagerSelectedId("");
    setScenarioManagerDraft(buildScenarioManagerDraft());
  }

  function handleScenarioManagerDraftLabelChange(value) {
    setScenarioManagerDraft((currentValue) => ({
      ...currentValue,
      label: value,
    }));
  }

  function handleScenarioManagerDraftDimensionChange(field, value) {
    setScenarioManagerDraft((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  function handleScenarioManagerDraftLayoutChange(field, value) {
    setScenarioManagerDraft((currentValue) => ({
      ...currentValue,
      [field]: clampLayoutTrack(value),
    }));
  }

  function handleScenarioManagerSave() {
    const label = normalizeTextValue(scenarioManagerDraft.label);

    if (!label) {
      setStudioError("请先填写常用场景名称");
      return;
    }

    const nextScenario = {
      value: scenarioManagerSelectedId || `custom-scene-${createPersistedRecordId()}`,
      label,
      width: normalizeCanvasDimensionValue(
        scenarioManagerDraft.width,
        DEFAULT_CUSTOM_CANVAS_WIDTH,
      ),
      height: normalizeCanvasDimensionValue(
        scenarioManagerDraft.height,
        DEFAULT_CUSTOM_CANVAS_HEIGHT,
      ),
      layoutRows: clampLayoutTrack(scenarioManagerDraft.layoutRows),
      layoutColumns: clampLayoutTrack(scenarioManagerDraft.layoutColumns),
    };

    setProfessionalCustomScenarios((currentValue) => {
      const nextValue = currentValue.some((item) => item.value === nextScenario.value)
        ? currentValue.map((item) => (item.value === nextScenario.value ? nextScenario : item))
        : [...currentValue, nextScenario];

      return nextValue;
    });

    setScenarioManagerSelectedId(nextScenario.value);
    setScenarioManagerSelectedType("custom");
    setScenarioManagerDraft(buildScenarioManagerDraft(nextScenario));
    setProfessionalCanvasSize(nextScenario.value);
    setProfessionalLayoutRows(nextScenario.layoutRows);
    setProfessionalLayoutColumns(nextScenario.layoutColumns);
    const nextRecommendedAspectRatio = findRecommendedStoryboardAspectRatioForLayout({
      options: availableAspectRatioOptions,
      canvasWidth: nextScenario.width,
      canvasHeight: nextScenario.height,
      rows: nextScenario.layoutRows,
      columns: nextScenario.layoutColumns,
    });

    if (nextRecommendedAspectRatio?.option?.value) {
      setProfessionalStoryboardAspectRatio(nextRecommendedAspectRatio.option.value);
    }

    setStudioError("");
  }

  function handleScenarioManagerDelete(value) {
    if (!value) {
      return;
    }

    setProfessionalCustomScenarios((currentValue) =>
      currentValue.filter((scenario) => scenario.value !== value),
    );

    if (professionalCanvasSize === value) {
      handleProfessionalScenarioChange(CANVAS_SIZE_OPTIONS[0].value);
    }

    setScenarioManagerSelectedId("");
    setScenarioManagerSelectedType("new");
    setScenarioManagerDraft(buildScenarioManagerDraft());
    setStudioError("");
  }

  async function handleDeleteStoredRecord(recordId) {
    try {
      const existingLibraryRecords = await ensureGenerationLibraryLoaded();
      const nextLibraryRecords = existingLibraryRecords.filter((record) => record.id !== recordId);
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

      await Promise.all([
        writePersistedGenerationLibrary(nextLibraryRecords),
        writeLastGenerationRecordId(nextStoredCurrentRecord?.id || ""),
        writeLastGenerationRecord(nextCurrentRecord),
      ]);

      setGenerationLibrary(nextLibraryRecords);
      setGenerationLibraryLoaded(true);
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

  function updateStoryboardCell(cellId, updater) {
    setStoryboardCells((currentValue) => {
      const cell = currentValue[cellId];

      if (!cell) {
        return currentValue;
      }

      const nextCell =
        typeof updater === "function"
          ? updater(cell)
          : {
              ...cell,
              ...updater,
            };

      return {
        ...currentValue,
        [cellId]: nextCell,
      };
    });
  }

  function openStoryboardEditor(cellId) {
    const cell = storyboardCells[cellId];

    if (!cell) {
      return;
    }

    setStoryboardEditorMode(
      cell.record && !normalizeTextValue(cell.prompt)
        ? STORYBOARD_EDITOR_MODE_ASSET
        : STORYBOARD_EDITOR_MODE_GENERATE,
    );
    setStoryboardEditorCellId(cellId);
  }

  function suppressStoryboardCellOpen(cellId) {
    storyboardDragClickSuppressionRef.current = {
      cellId,
      timestamp: Date.now(),
    };
  }

  function isStoryboardCellOpenSuppressed(cellId) {
    const { cellId: suppressedCellId, timestamp } = storyboardDragClickSuppressionRef.current;

    if (!suppressedCellId || suppressedCellId !== cellId) {
      return false;
    }

    if (Date.now() - timestamp > STORYBOARD_DRAG_CLICK_SUPPRESSION_MS) {
      storyboardDragClickSuppressionRef.current = {
        cellId: "",
        timestamp: 0,
      };
      return false;
    }

    return true;
  }

  function handleStoryboardCellOpen(cellId) {
    if (isStoryboardCellOpenSuppressed(cellId)) {
      return;
    }

    openStoryboardEditor(cellId);
  }

  function handleStoryboardDragStart(event) {
    const activeId = String(event.active?.id || "");

    if (!activeId) {
      return;
    }

    setActiveStoryboardDragId(activeId);
  }

  function handleStoryboardDragCancel() {
    if (activeStoryboardDragId) {
      suppressStoryboardCellOpen(activeStoryboardDragId);
    }

    setActiveStoryboardDragId("");
  }

  function handleStoryboardDragEnd(event) {
    const activeId = String(event.active?.id || "");
    const overId = String(event.over?.id || "");

    if (activeId) {
      suppressStoryboardCellOpen(activeId);
    }

    setActiveStoryboardDragId("");

    if (!activeId || !overId || activeId === overId) {
      return;
    }

    setStoryboardCells((currentValue) => swapStoryboardCellContent(currentValue, activeId, overId));
  }

  function closeStoryboardEditor() {
    setStoryboardEditorCellId("");
    setStoryboardEditorMode(STORYBOARD_EDITOR_MODE_GENERATE);
  }

  function navigateStoryboardEditor(direction) {
    const targetCell =
      direction === "previous" ? previousStoryboardEditorCell : nextStoryboardEditorCell;

    if (!targetCell) {
      return;
    }

    setStoryboardEditorCellId(targetCell.id);
  }

  function openStoryboardClearConfirm() {
    if (!storyboardHasContent || storyboardHasLoadingCells) {
      return;
    }

    setStoryboardClearConfirmOpen(true);
  }

  function closeStoryboardClearConfirm() {
    setStoryboardClearConfirmOpen(false);
  }

  function handleClearStoryboard() {
    if (storyboardHasLoadingCells) {
      return;
    }

    setStoryboardCells(normalizeStoryboardCells({}, professionalLayoutRows, professionalLayoutColumns));
    closeStoryboardClearConfirm();
    closeStoryboardEditor();
  }

  function openStoryboardCellClearConfirm(cellId) {
    const cell = storyboardCells[cellId];

    if (!cell || cell.status === "loading" || !doesStoryboardCellHaveContent(cell)) {
      return;
    }

    setStoryboardCellClearConfirmCellId(cellId);
  }

  function closeStoryboardCellClearConfirm() {
    setStoryboardCellClearConfirmCellId("");
  }

  function handleConfirmClearStoryboardCell() {
    const cellId = storyboardCellClearConfirmCellId;
    const cell = cellId ? storyboardCells[cellId] : null;

    if (!cell || cell.status === "loading") {
      closeStoryboardCellClearConfirm();
      return;
    }

    updateStoryboardCell(cellId, (currentCell) => createStoryboardCellState(currentCell));
    closeStoryboardCellClearConfirm();
  }

  function openRequestTaskCancelConfirm(requestId) {
    const nextRequestId = normalizeTextValue(requestId);
    const targetTask = nextRequestId
      ? requestTasks.find((task) => task.requestId === nextRequestId) || null
      : null;

    if (
      !targetTask ||
      isRequestTaskTerminal(targetTask) ||
      cancellingRequestTaskIds[nextRequestId]
    ) {
      return;
    }

    setRequestTaskCancelConfirmId(nextRequestId);
  }

  function closeRequestTaskCancelConfirm() {
    setRequestTaskCancelConfirmId("");
  }

  async function handleConfirmCancelRequestTask() {
    const targetTask = requestTaskCancelConfirmTask;
    const requestId = normalizeTextValue(targetTask?.requestId);

    if (!activePw || !requestId || isRequestTaskTerminal(targetTask)) {
      closeRequestTaskCancelConfirm();
      return;
    }

    startCancellingRequestTask(requestId);

    try {
      const data = await fetchCancelableGenerationRequest(activePw, requestId);
      const cancelledMessage = data?.message || "任务已取消";

      updateRequestTask(requestId, buildCancelledRequestTaskPatch(cancelledMessage));
      abortRequestAbortController(requestId, createRequestCancelledError());
      setStudioError("");
      setStudioNotice(cancelledMessage);
      closeRequestTaskCancelConfirm();
    } catch (error) {
      if (error?.status === 404) {
        const missingTaskPatch = buildMissingRecoverableRequestTaskPatch(targetTask);
        updateRequestTask(requestId, missingTaskPatch);
        abortRequestAbortController(requestId, createRequestCancelledError());
        setStudioNotice("");
        setStudioError(missingTaskPatch.error);
        closeRequestTaskCancelConfirm();
        return;
      }

      if (error?.status === 409 && normalizeTextValue(error?.message) === "任务已经取消") {
        const cancelledMessage = "任务已取消";
        updateRequestTask(requestId, buildCancelledRequestTaskPatch(cancelledMessage));
        abortRequestAbortController(requestId, createRequestCancelledError());
        setStudioError("");
        setStudioNotice(cancelledMessage);
        closeRequestTaskCancelConfirm();
        return;
      }

      if (error?.status === 409) {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(targetTask);

          if (
            recoveryOutcome.state === "recovered" ||
            recoveryOutcome.state === "failed" ||
            recoveryOutcome.state === "cancelled" ||
            recoveryOutcome.state === "missing"
          ) {
            closeRequestTaskCancelConfirm();
            return;
          }
        } catch {
          // Fall through to the generic error below.
        }
      }

      setStudioError(error instanceof Error ? error.message : "取消任务失败");
    } finally {
      finishCancellingRequestTask(requestId);
    }
  }

  function handleStoryboardPromptChange(value) {
    if (!storyboardEditorCellId) {
      return;
    }

    updateStoryboardCell(storyboardEditorCellId, (cell) => ({
      ...cell,
      prompt: value,
      error: "",
    }));
  }

  function handleStoryboardCaptionChange(value) {
    if (!storyboardEditorCellId) {
      return;
    }

    updateStoryboardCell(storyboardEditorCellId, (cell) => ({
      ...cell,
      caption: value,
      error: "",
    }));
  }

  async function appendStoryboardLocalImageFiles(
    files,
    successText = "已导入本地图片，仅作用于当前格子",
  ) {
    if (!storyboardEditorCellId) {
      return;
    }

    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFile = imageFiles[0];

      if (!nextFile) {
        updateStoryboardCell(storyboardEditorCellId, (cell) => ({
          ...cell,
          error: "请上传 1 张图片作为当前格子的图片",
        }));
        return;
      }

      const record = await readFileAsGenerationResultRecord(nextFile);

      if (!record) {
        updateStoryboardCell(storyboardEditorCellId, (cell) => ({
          ...cell,
          error: "当前图片导入失败",
        }));
        return;
      }

      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        pendingRequestId: "",
        status: "success",
        statusText: successText,
        error: "",
        record,
      }));
      setStoryboardLibraryPickerOpen(false);
      setStudioError("");
    } catch (error) {
      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        error: error instanceof Error ? error.message : "本地图片读取失败",
      }));
    }
  }

  async function handleStoryboardLocalImageFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0 || !storyboardEditorCellId) {
      return;
    }

    try {
      await appendStoryboardLocalImageFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  function handleSelectStoryboardLibraryRecord(record) {
    if (!storyboardEditorCellId) {
      return;
    }

    const clonedRecord = cloneGenerationResultRecord(record);

    if (!clonedRecord) {
      return;
    }

    updateStoryboardCell(storyboardEditorCellId, (cell) => ({
      ...cell,
      pendingRequestId: "",
      status: "success",
      statusText: "已复用资源管理器中的图片，仅作用于当前格子",
      error: "",
      record: clonedRecord,
    }));
    setStoryboardLibraryPickerOpen(false);
  }

  function handleToggleStoryboardLibraryPicker() {
    if (storyboardLibraryPickerPending) {
      return;
    }

    if (storyboardLibraryPickerTimeoutRef.current) {
      window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      storyboardLibraryPickerTimeoutRef.current = null;
    }

    if (storyboardLibraryPickerOpen) {
      setStoryboardLibraryPickerOpen(false);
      setStoryboardLibraryPickerPending(false);
      return;
    }

    setStoryboardLibraryPickerPending(true);
    void ensureGenerationLibraryLoaded()
      .then(() => {
        storyboardLibraryPickerTimeoutRef.current = window.setTimeout(() => {
          setStoryboardLibraryPickerOpen(true);
          setStoryboardLibraryPickerPending(false);
          storyboardLibraryPickerTimeoutRef.current = null;
        }, 220);
      })
      .catch((error) => {
        setStudioError(error instanceof Error ? error.message : "资源管理器图片加载失败");
        setStoryboardLibraryPickerPending(false);
      });
  }

  async function handleCopyStoryboardShare() {
    if (!storyboardShareText) {
      return;
    }

    try {
      await copyTextToClipboard(storyboardShareText);
      setStoryboardShareCopyState("success");
    } catch (error) {
      console.warn("Copy storyboard share failed:", error);
      setStoryboardShareCopyState("error");
    }

    if (storyboardShareCopyResetTimeoutRef.current) {
      window.clearTimeout(storyboardShareCopyResetTimeoutRef.current);
    }

    storyboardShareCopyResetTimeoutRef.current = window.setTimeout(() => {
      setStoryboardShareCopyState("idle");
      storyboardShareCopyResetTimeoutRef.current = null;
    }, 1800);
  }

  async function executeStoryboardCellTask({
    editorCell,
    modelId,
    requestedPromptValue,
    storyboardAspectRatio,
    storyboardImageSize,
    globalReferenceImageRecords,
  }) {
    if (!editorCell || !activePw) {
      return;
    }

    const cellId = editorCell.id;
    const previousRecord = editorCell.record || null;
    const requestRecord = upsertRequestTask({
      requestId: createClientRequestId(),
      type: "storyboard",
      mode: "professional",
      canRetry: true,
      promptSnapshot: requestedPromptValue,
      storyboardCellId: cellId,
      storyboardCellLabel: editorCell.label,
      storyboardCellCoordinate: editorCell.coordinateLabel,
      createdAt: new Date().toISOString(),
      status: "accepted",
      stage: "accepted",
      message: `${editorCell.label} 请求已提交，等待后端接收...`,
    });

    if (requestRecord?.requestId) {
      setRequestTaskRetryHandler(requestRecord.requestId, async () => {
        await executeStoryboardCellTask({
          editorCell,
          modelId,
          requestedPromptValue,
          storyboardAspectRatio,
          storyboardImageSize,
          globalReferenceImageRecords,
        });
      });
    }

    updateStoryboardCell(cellId, (cell) => ({
      ...cell,
      pendingRequestId: requestRecord?.requestId || "",
      status: "loading",
      statusText: "banana 正在生图...",
      error: "",
    }));
    const releaseTaskRecoveryPause = beginTaskRecoveryPause();
    const requestAbortController = new AbortController();

    if (requestRecord?.requestId) {
      registerRequestAbortController(requestRecord.requestId, requestAbortController);
    }

    try {
      const mergedReferenceImages = [
        ...buildProfessionalReferenceImages(globalReferenceImageRecords, 1, "style"),
        ...buildProfessionalReferenceImages(
          editorCell.referenceImages,
          STORYBOARD_CELL_REFERENCE_LIMIT,
          "content",
        ),
      ];
      const data = await requestProfessionalGeneration(
        activePw,
        {
          ...buildProfessionalGenerationPayload({
            modelId,
            prompt: requestedPromptValue,
            aspectRatio: storyboardAspectRatio,
            imageSize: storyboardImageSize,
            imageCount: 1,
            layoutRows: 1,
            layoutColumns: 1,
            referenceImages: mergedReferenceImages,
          }),
          clientRequestId: requestRecord?.requestId,
        },
        {
          signal: requestAbortController.signal,
          onStatus: (eventPayload) => {
            if (!eventPayload?.message) {
              if (requestRecord?.requestId) {
                const nextTaskProgress = normalizeRequestTaskProgress({
                  ...requestRecord,
                  ...eventPayload,
                });

                if (nextTaskProgress) {
                  updateRequestTask(requestRecord.requestId, nextTaskProgress);
                }
              }

              return;
            }

            updateStoryboardCell(cellId, (cell) => ({
              ...cell,
              pendingRequestId: requestRecord?.requestId || cell.pendingRequestId,
              statusText: eventPayload.message,
            }));

            if (requestRecord?.requestId) {
              const nextTaskProgress = normalizeRequestTaskProgress({
                ...requestRecord,
                ...eventPayload,
                message: `${editorCell.label} · ${eventPayload.message}`,
              });

              if (nextTaskProgress) {
                updateRequestTask(requestRecord.requestId, nextTaskProgress);
              }
            }
          },
        },
      );
      const nextResult = buildGeneratedImageRecord(data, {
        promptSnapshot: requestedPromptValue,
        storyboardCellId: cellId,
        storyboardCellLabel: editorCell.label,
        storyboardCellCoordinate: editorCell.coordinateLabel,
      });

      if (!nextResult) {
        throw new Error("banana 没有返回可用图片");
      }

      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        pendingRequestId: "",
        status: "success",
        statusText: "生成完成",
        error: "",
        record: nextResult,
      }));
      setCurrentGenerationSelection([nextResult], nextResult);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));
      updateRequestTask(requestRecord?.requestId, {
        status: "succeeded",
        stage: "result",
        message: `${editorCell.label} 生成完成`,
        error: "",
        queuePosition: 0,
        queueRateLimitWaitMs: 0,
      });

      try {
        await persistGeneratedRecord(nextResult);
      } catch (error) {
        console.warn("Persist storyboard cell result failed:", error);
        updateStoryboardCell(cellId, (cell) => ({
          ...cell,
          error: "图片已生成，但写入本地资源管理器失败",
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "banana 生图失败";

      if (isRequestCancelledError(error)) {
        updateRequestTask(
          requestRecord?.requestId,
          buildCancelledRequestTaskPatch(message || "任务已取消"),
        );
        updateStoryboardCell(cellId, (cell) => ({
          ...cell,
          pendingRequestId: "",
          status: previousRecord ? "success" : "idle",
          statusText: message || "任务已取消",
          error: "",
          record: previousRecord,
        }));
        return;
      }

      if (error?.status) {
        updateRequestTask(requestRecord?.requestId, {
          status: "failed",
          stage: "error",
          message: `${editorCell.label} 生成失败`,
          error: message,
        });
      } else {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(requestRecord);

          if (recoveryOutcome.state === "recovered" && recoveryOutcome.data?.result) {
            const recoveredResult = buildGeneratedImageRecord(recoveryOutcome.data.result, {
              promptSnapshot: requestedPromptValue,
              storyboardCellId: cellId,
              storyboardCellLabel: editorCell.label,
              storyboardCellCoordinate: editorCell.coordinateLabel,
            });

            if (recoveredResult) {
              updateStoryboardCell(cellId, (cell) => ({
                ...cell,
                status: "success",
                statusText: "已恢复上一次请求的图片结果",
                error: "",
                pendingRequestId: "",
                record: recoveredResult,
              }));
              return;
            }
          }

          if (recoveryOutcome.state === "failed" || recoveryOutcome.state === "missing") {
            updateStoryboardCell(cellId, (cell) => ({
              ...cell,
              status: previousRecord ? "success" : "idle",
              statusText: "",
              error: message,
              pendingRequestId: "",
              record: previousRecord,
            }));
            return;
          }
        } catch {
          updateRequestTask(requestRecord?.requestId, {
            status: "processing",
            stage: "processing",
            message: `${editorCell.label} 网络中断，等待自动恢复`,
          });
        }
      }

      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        pendingRequestId: !error?.status && requestRecord?.requestId ? requestRecord.requestId : "",
        status:
          !error?.status && requestRecord?.requestId
            ? "loading"
            : previousRecord
              ? "success"
              : "idle",
        statusText:
          !error?.status && requestRecord?.requestId
            ? "连接已中断，banana 正在后端继续生成，恢复联网后会自动取回结果。"
            : "",
        error: !error?.status && requestRecord?.requestId ? "" : message,
        record: previousRecord,
      }));
    } finally {
      unregisterRequestAbortController(requestRecord?.requestId, requestAbortController);
      releaseTaskRecoveryPause();
    }
  }

  async function handleStoryboardCellGenerate() {
    if (!storyboardEditorCell || !activePw) {
      return;
    }

    const editorCell = storyboardEditorCell;
    const cellId = editorCell.id;
    const promptValue = normalizeTextValue(editorCell.prompt);
    const requestedPromptValue = buildProfessionalStoryboardPrompt(
      professionalGlobalPrompt,
      promptValue,
    );

    if (!promptValue) {
      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        error: "请先填写这个格子的提示词",
      }));
      return;
    }

    if (!generationModelId) {
      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        error: "请先选择一个 banana 模型",
      }));
      return;
    }

    await executeStoryboardCellTask({
      editorCell,
      modelId: generationModelId,
      requestedPromptValue,
      storyboardAspectRatio: professionalStoryboardAspectRatioValue,
      storyboardImageSize: professionalStoryboardImageSizeValue,
      globalReferenceImageRecords: referenceImages,
    });
  }

  async function executeGenerationTask({
    mode,
    modelId,
    prompt,
    aspectRatio,
    imageSize,
    imageCount,
    layoutRows,
    layoutColumns,
    referenceImageRecords,
  }) {
    const isSimpleTask = mode === "simple";

    setStudioPending(true);
    setStudioError("");
    setStudioNotice("");
    const releaseBackendRequest = beginBackendRequest(
      "banana 正在生图...",
      secondsToEstimateMs(60),
    );
    const releaseTaskRecoveryPause = beginTaskRecoveryPause();
    const promptSnapshot = prompt;
    const requestRecord = upsertRequestTask({
      requestId: createClientRequestId(),
      type: "generation",
      mode: isSimpleTask ? "simple" : "professional",
      canRetry: true,
      promptSnapshot,
      createdAt: new Date().toISOString(),
      status: "accepted",
      stage: "accepted",
      message: "请求已提交，等待后端接收...",
    });

    if (requestRecord?.requestId) {
      setRequestTaskRetryHandler(requestRecord.requestId, async () => {
        await executeGenerationTask({
          mode,
          modelId,
          prompt,
          aspectRatio,
          imageSize,
          imageCount,
          layoutRows,
          layoutColumns,
          referenceImageRecords,
        });
      });
    }

    const requestAbortController = new AbortController();

    if (requestRecord?.requestId) {
      registerRequestAbortController(requestRecord.requestId, requestAbortController);
    }

    try {
      const payload = isSimpleTask
        ? {
            ...buildSimpleGenerationPayload({
              modelId,
              prompt,
              aspectRatio,
              imageSize,
              imageCount,
              referenceImages: buildProfessionalReferenceImages(
                referenceImageRecords,
                MAX_REFERENCE_IMAGES,
                "content",
              ),
            }),
            clientRequestId: requestRecord?.requestId,
          }
        : {
            ...buildProfessionalGenerationPayload({
              modelId,
              prompt,
              aspectRatio,
              imageSize,
              imageCount,
              layoutRows,
              layoutColumns,
              referenceImages: buildProfessionalReferenceImages(
                referenceImageRecords,
                PROFESSIONAL_STYLE_REFERENCE_LIMIT,
                "style",
              ),
            }),
            clientRequestId: requestRecord?.requestId,
          };

      const requestGenerate = isSimpleTask
        ? requestSimpleGeneration
        : requestProfessionalGeneration;

      const data = await requestGenerate(activePw, payload, {
        signal: requestAbortController.signal,
        onStatus: (eventPayload) => {
          if (eventPayload?.message) {
            setBackendBusyLabel(eventPayload.message);
          }

          if (requestRecord?.requestId) {
            const nextTaskProgress = normalizeRequestTaskProgress({
              ...requestRecord,
              ...eventPayload,
            });

            if (nextTaskProgress) {
              updateRequestTask(requestRecord.requestId, nextTaskProgress);
            }
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
        promptSnapshot,
      });

      if (nextResults.length === 0) {
        throw new Error("banana 没有返回可用图片");
      }

      setCurrentGenerationSelection(nextResults, nextResults[0]);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));
      setStudioNotice("");
      updateRequestTask(requestRecord?.requestId, {
        status: "succeeded",
        stage: "result",
        message: "生成完成",
        error: "",
        queuePosition: 0,
        queueRateLimitWaitMs: 0,
      });

      try {
        await persistGeneratedRecords(nextResults, nextResults[0].id);
      } catch (error) {
        console.warn("Persist generated result failed:", error);
        setStudioError("图片已生成，但写入本地资源管理器失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "banana 生图失败";

      if (isRequestCancelledError(error)) {
        setStudioError("");
        setStudioNotice(message || "任务已取消");
        updateRequestTask(
          requestRecord?.requestId,
          buildCancelledRequestTaskPatch(message || "任务已取消"),
        );
        return;
      }

      if (error?.status) {
        setStudioNotice("");
        setStudioError(message);
        updateRequestTask(requestRecord?.requestId, {
          status: "failed",
          stage: "error",
          message,
          error: message,
        });
      } else {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(requestRecord);

          if (recoveryOutcome.state === "recovered") {
            return;
          }

          if (recoveryOutcome.state === "failed" || recoveryOutcome.state === "missing") {
            return;
          }
        } catch {
          setStudioNotice("网络波动后已切换到自动恢复模式，恢复联网后会继续补取结果。");
        }

        setStudioError("连接已中断，banana 仍在后端继续生成。恢复联网后会自动取回结果。");
      }
    } finally {
      unregisterRequestAbortController(requestRecord?.requestId, requestAbortController);
      releaseTaskRecoveryPause();
      releaseBackendRequest();
      setStudioPending(false);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (isSimplePanelMode && !simplePrompt.trim()) {
      setStudioError("请输入你希望 banana 生成的画面要求");
      return;
    }

    if (!generationModelId) {
      setStudioError("请先选择一个 banana 模型");
      return;
    }

    await executeGenerationTask({
      mode: isSimplePanelMode ? "simple" : "professional",
      modelId: generationModelId,
      prompt: isSimplePanelMode ? simplePrompt : professionalGlobalPrompt,
      aspectRatio: generationAspectRatio,
      imageSize: generationImageSize,
      imageCount: generationImageCount,
      layoutRows: generationLayoutRows,
      layoutColumns: generationLayoutColumns,
      referenceImageRecords: isSimplePanelMode ? simpleReferenceImages : referenceImages,
    });
  }

  async function executeEnhancementTask({
    sourceGenerationRecord,
    promptSnapshot,
    targetImageSize,
  }) {
    if (!sourceGenerationRecord || !activePw) {
      return;
    }

    setEnhancePending(true);
    setStudioError("");
    setStudioNotice("");
    const releaseBackendRequest = beginBackendRequest(
      targetImageSize
        ? `正在提升到 ${targetImageSize}...`
        : "正在提升清晰度...",
      secondsToEstimateMs(60),
    );
    const releaseTaskRecoveryPause = beginTaskRecoveryPause();
    const requestRecord = upsertRequestTask({
      requestId: createClientRequestId(),
      type: "enhance",
      mode: "enhance",
      canRetry: true,
      promptSnapshot,
      createdAt: new Date().toISOString(),
      status: "accepted",
      stage: "accepted",
      message: "请求已提交，等待后端接收...",
    });

    if (requestRecord?.requestId) {
      setRequestTaskRetryHandler(requestRecord.requestId, async () => {
        await executeEnhancementTask({
          sourceGenerationRecord,
          promptSnapshot,
          targetImageSize,
        });
      });
    }

    const requestAbortController = new AbortController();

    if (requestRecord?.requestId) {
      registerRequestAbortController(requestRecord.requestId, requestAbortController);
    }

    try {
      const payload = {
        modelId: sourceGenerationRecord.bananaModelId,
        prompt: promptSnapshot,
        sourceImage: {
          name: `enhance-source-${sourceGenerationRecord.savedRecord?.id || "current"}.png`,
          mimeType: sourceGenerationRecord.mimeType,
          data: sourceGenerationRecord.imageBase64,
        },
        imageOptions: {
          aspectRatio: sourceGenerationRecord.aspectRatio || professionalDefaultCellAspectRatio,
          imageSize: targetImageSize,
          layoutRows: sourceGenerationRecord.layoutRows || professionalLayoutRows,
          layoutColumns: sourceGenerationRecord.layoutColumns || professionalLayoutColumns,
        },
        // Preserve panel structure through text instructions instead of sending the
        // local guide canvas, which can leak guide visuals into the final image.
        layoutGuideImage: null,
        clientRequestId: requestRecord?.requestId,
      };
      const data = await requestEnhancement(activePw, payload, {
        signal: requestAbortController.signal,
        onStatus: (eventPayload) => {
          if (eventPayload?.message) {
            setBackendBusyLabel(eventPayload.message);
          }

          if (requestRecord?.requestId) {
            const nextTaskProgress = normalizeRequestTaskProgress({
              ...requestRecord,
              ...eventPayload,
            });

            if (nextTaskProgress) {
              updateRequestTask(requestRecord.requestId, nextTaskProgress);
            }
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
          ...(sourceGenerationRecord || {}),
          ...data,
        },
        {
          promptSnapshot,
        },
      );

      const nextResult = nextResults[0];

      if (!nextResult) {
        throw new Error("banana 没有返回可用图片");
      }

      setCurrentGenerationSelection([nextResult], nextResult);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));
      setStudioNotice("");
      updateRequestTask(requestRecord?.requestId, {
        status: "succeeded",
        stage: "result",
        message: "提升完成",
        error: "",
        queuePosition: 0,
        queueRateLimitWaitMs: 0,
      });

      try {
        await persistGeneratedRecord(nextResult);
      } catch (error) {
        console.warn("Persist enhanced result failed:", error);
        setStudioError("图片已生成，但写入本地资源管理器失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "提升清晰度失败";

      if (isRequestCancelledError(error)) {
        setStudioError("");
        setStudioNotice(message || "任务已取消");
        updateRequestTask(
          requestRecord?.requestId,
          buildCancelledRequestTaskPatch(message || "任务已取消"),
        );
        return;
      }

      if (error?.status) {
        setStudioNotice("");
        setStudioError(message);
        updateRequestTask(requestRecord?.requestId, {
          status: "failed",
          stage: "error",
          message,
          error: message,
        });
      } else {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(requestRecord);

          if (recoveryOutcome.state === "recovered") {
            return;
          }

          if (recoveryOutcome.state === "failed" || recoveryOutcome.state === "missing") {
            return;
          }
        } catch {
          setStudioNotice("网络波动后已切换到自动恢复模式，恢复联网后会继续补取结果。");
        }

        setStudioError("连接已中断，后端仍在继续提升图片。恢复联网后会自动取回结果。");
      }
    } finally {
      unregisterRequestAbortController(requestRecord?.requestId, requestAbortController);
      releaseTaskRecoveryPause();
      releaseBackendRequest();
      setEnhancePending(false);
    }
  }

  async function handleEnhanceGeneration() {
    if (!generationResult || !canEnhanceGeneration || !activePw) {
      return;
    }

    await executeEnhancementTask({
      sourceGenerationRecord: generationResult,
      promptSnapshot: generationResult?.promptSnapshot || simplePrompt,
      targetImageSize: enhancementTargetImageSize,
    });
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
    if (resourceManagerOpen || resourceManagerPending) {
      return;
    }

    setResourceManagerPending(true);
    void ensureGenerationLibraryLoaded()
      .then(() => {
        setResourceManagerOpen(true);
      })
      .catch((error) => {
        setStudioError(error instanceof Error ? error.message : "资源管理器加载失败");
      })
      .finally(() => {
        setResourceManagerPending(false);
      });
  }

  function handlePreviewStoredRecord(record) {
    setCurrentGenerationSelection([record], record);
    void Promise.all([
      writeLastGenerationRecordId(record.id),
      writeLastGenerationRecord(record),
    ]);
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
                decoding="async"
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
            <img
              className="gate-hero-image"
              src="/bg/002.png"
              alt="Banana Studio 展示图"
              decoding="async"
            />
          </section>

          <section className="gate-panel">
            <img
              className="gate-panel-logo"
              src="/logo.png"
              alt="Banana Studio logo"
              decoding="async"
            />
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
        <div className="studio-brand">
          <img className="studio-brand-logo" src="/logo.png" alt="Banana Studio" decoding="async" />
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`resource-manager-trigger task-manager-trigger${taskManagerOpen ? " is-active" : ""}`}
            onClick={() => setTaskManagerOpen(true)}
            aria-label={activeRequestTaskCount > 0 ? `打开任务列表，当前有 ${activeRequestTaskCount} 个进行中的任务` : "打开任务列表"}
            title="任务列表"
          >
            <span
              className={`task-manager-indicator${activeRequestTaskCount > 0 ? " is-active" : ""}`}
              aria-hidden="true"
            >
              <span className="task-manager-indicator-core">
                {activeRequestTaskCount > 0 ? (
                  <span className="task-manager-indicator-count">{activeRequestTaskCount}</span>
                ) : (
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
                    <path d="M8 6h12" />
                    <path d="M8 12h12" />
                    <path d="M8 18h12" />
                    <path d="M4 6h.01" />
                    <path d="M4 12h.01" />
                    <path d="M4 18h.01" />
                  </svg>
                )}
              </span>
            </span>
            <span className="resource-manager-trigger-label" aria-hidden="true">
              任务
            </span>
          </button>
          <button
            type="button"
            className={`resource-manager-trigger${resourceManagerPending ? " is-pending" : ""}`}
            onClick={openResourceManager}
            aria-label={resourceManagerPending ? "资源管理器加载中" : "打开资源管理器"}
            aria-busy={resourceManagerPending ? "true" : undefined}
            title={resourceManagerPending ? "资源管理器加载中" : "资源管理器"}
            disabled={resourceManagerPending}
          >
            <span className="sr-only">资源管理器</span>
            {resourceManagerPending ? (
              <span className="resource-manager-trigger-spinner" aria-hidden="true" />
            ) : (
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
            )}
            <span className="resource-manager-trigger-label" aria-hidden="true">
              {resourceManagerPending ? "加载中" : "库"}
            </span>
          </button>
        </div>
      </header>

      <main className={`studio-layout${isProfessionalPanelMode ? " is-professional-layout" : ""}`}>
        {showResultPanel || showProfessionalExportPanel ? (
          <section className={`studio-panel result-panel${showProfessionalExportPanel ? " professional-export-panel" : ""}`}>
            {showResultPanel ? (
              <>
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
                          {generationResult.imageSize}
                          {generationResult.aspectRatio
                            ? ` · ${generationResult.aspectRatio}`
                            : isSimplePanelMode
                              ? " · 自动比例"
                              : ""}
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
                                  loading="lazy"
                                  decoding="async"
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
                        decoding="async"
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
                    <small>选好 banana 模型，写下要求后生成。</small>
                  </div>
                )}
              </>
            ) : null}

            {showProfessionalExportPanel ? (
              <>
                <div className="section-title">
                  <h2>专业模式导出预览</h2>
                  <p>下载时会由后端使用 Playwright 对下方表格截图并返回 PNG。</p>
                </div>

                <div className="professional-export-card" ref={setProfessionalExportCardElement}>
                  <div className="result-toolbar">
                    <span className="result-chip">
                      {professionalCanvasSizeOption.label} · {professionalLayoutRows} 行 × {professionalLayoutColumns} 列
                    </span>
                    <div className="result-toolbar-actions professional-export-toolbar-actions">
                      <input
                        ref={professionalSceneImportInputRef}
                        className="sr-only"
                        type="file"
                        accept="application/json,.json"
                        onChange={handleImportProfessionalSceneFileChange}
                      />
                      <button
                        type="button"
                        className="ghost-button professional-export-transfer-button"
                        onClick={handleOpenProfessionalSceneImport}
                        disabled={!professionalSceneTransferReady || professionalSceneTransferPending}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M10 3.8v8.8" />
                          <path d="m6.8 9.5 3.2 3.2 3.2-3.2" />
                          <path d="M4.2 14.8h11.6" />
                          <path d="M5.3 14.8v.8c0 .8.6 1.4 1.4 1.4h6.6c.8 0 1.4-.6 1.4-1.4v-.8" />
                        </svg>
                        <span>{professionalSceneTransferPending ? "处理中..." : "导入"}</span>
                      </button>
                      <button
                        type="button"
                        className="ghost-button professional-export-transfer-button"
                        onClick={handleExportProfessionalScene}
                        disabled={!professionalSceneTransferReady || professionalSceneTransferPending}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M10 16.2V7.4" />
                          <path d="m6.8 10.6 3.2-3.2 3.2 3.2" />
                          <path d="M4.2 5.2h11.6" />
                          <path d="M5.3 5.2v-.8c0-.8.6-1.4 1.4-1.4h6.6c.8 0 1.4.6 1.4 1.4v.8" />
                        </svg>
                        <span>{professionalSceneTransferPending ? "处理中..." : "导出"}</span>
                      </button>
                      <button
                        type="button"
                        className="ghost-button professional-export-toggle-button"
                        onClick={() =>
                          setProfessionalExportPreviewVisible((currentValue) => !currentValue)
                        }
                        aria-pressed={professionalExportPreviewVisible}
                        aria-label={professionalExportPreviewVisible ? "隐藏预览" : "显示预览"}
                        title={professionalExportPreviewVisible ? "隐藏预览" : "显示预览"}
                      >
                        {professionalExportPreviewVisible ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M1.8 10s3-5 8.2-5 8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" />
                            <circle cx="10" cy="10" r="2.7" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M1.8 10s3-5 8.2-5c1.8 0 3.3.6 4.5 1.4 2.3 1.7 3.7 3.6 3.7 3.6s-3 5-8.2 5c-2 0-3.8-.7-5.2-1.7C2.9 11.7 1.8 10 1.8 10Z" />
                            <circle cx="10" cy="10" r="2.7" />
                            <path d="M3.5 3.5 16.5 16.5" />
                          </svg>
                        )}
                        <span className="sr-only">
                          {professionalExportPreviewVisible ? "隐藏预览" : "显示预览"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`ghost-button storyboard-share-button${storyboardShareCopyState === "success" ? " is-success" : storyboardShareCopyState === "error" ? " is-error" : ""}`}
                        onClick={handleCopyStoryboardShare}
                        disabled={!storyboardShareText}
                        aria-label={
                          storyboardShareCopyState === "success"
                            ? "已复制分享"
                            : storyboardShareCopyState === "error"
                              ? "复制失败"
                              : "复制分享"
                        }
                        title={
                          storyboardShareCopyState === "success"
                            ? "已复制分享"
                            : storyboardShareCopyState === "error"
                              ? "复制失败"
                              : "复制分享"
                        }
                      >
                        {storyboardShareCopyState === "success" ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="m4.5 10.5 3.2 3.2 7.8-7.8" />
                          </svg>
                        ) : storyboardShareCopyState === "error" ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M10 5.2v5.8" />
                            <path d="M10 14.4h.01" />
                            <path d="M10 17.2a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M7 6.2V5.1c0-.9.7-1.6 1.6-1.6h6.3c.9 0 1.6.7 1.6 1.6v8.3c0 .9-.7 1.6-1.6 1.6H13" />
                            <path d="M5.1 6.4h6.3c.9 0 1.6.7 1.6 1.6v6.9c0 .9-.7 1.6-1.6 1.6H5.1c-.9 0-1.6-.7-1.6-1.6V8c0-.9.7-1.6 1.6-1.6Z" />
                          </svg>
                        )}
                        <span className="sr-only">
                          {storyboardShareCopyState === "success"
                            ? "已复制分享"
                            : storyboardShareCopyState === "error"
                              ? "复制失败"
                              : "复制分享"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {normalizeTextValue(professionalGlobalPrompt) ? (
                    <p className="professional-export-global-prompt">
                      全局提示词与画风参考图：{normalizeTextValue(professionalGlobalPrompt)}
                    </p>
                  ) : null}
                  {shouldRenderProfessionalExportPreview ? (
                    <div className="professional-export-stage">
                      <div className="professional-export-viewport" style={professionalExportViewportStyle}>
                        <div className="professional-export-sheet" style={professionalExportSheetStyle}>
                          <div
                            id="professional-export-preview-capture"
                            className="professional-export-grid"
                            style={professionalExportGridStyle}
                          >
                            {storyboardCellList.map((cell) => (
                              <div
                                key={cell.id}
                                className={`professional-export-cell${cell.record ? " has-image" : ""}${normalizeTextValue(cell.caption) ? " has-caption" : ""}`}
                              >
                                {cell.record ? (
                                  <img
                                    className="professional-export-cell-image"
                                    src={cell.record.previewUrl}
                                    alt={`${cell.label} 导出预览`}
                                    draggable="false"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="professional-export-placeholder">
                                    {normalizeTextValue(cell.prompt) || "待生成"}
                                  </div>
                                )}
                                {normalizeTextValue(cell.caption) ? (
                                  <span className="professional-export-cell-caption">
                                    <span className="professional-export-cell-caption-text">
                                      {normalizeTextValue(cell.caption)}
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="professional-export-stage professional-export-stage-placeholder">
                      <p>
                        {isMobilePerformanceMode
                          ? "移动端默认关闭导出预览，避免重复渲染整张大画布。需要时再手动展开。"
                          : "导出预览已隐藏，展开后会重新渲染整张导出画布。"}
                      </p>
                    </div>
                  )}
                  <div className="professional-export-download-row">
                    <button
                      type="button"
                      className="primary-button professional-export-download-button"
                      onClick={handleDownloadProfessionalExport}
                      disabled={professionalExportPending || !professionalExportHasRenderableContent}
                    >
                      {professionalExportPending ? "正在导出..." : "下载 PNG"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <section
          className={`studio-panel prompt-panel${isPromptFocusMode ? " is-focus-mode" : ""}`}
        >
          <form
            className={`prompt-form${isPromptFocusMode ? " is-focus-mode" : ""}${isSimplePanelMode ? " is-simple-panel" : ""}`}
            onSubmit={handleGenerate}
          >
            <div className="panel-mode-switcher" role="tablist" aria-label="右侧面板模式">
              <button
                type="button"
                role="tab"
                aria-selected={isSimplePanelMode}
                className={`panel-mode-button${isSimplePanelMode ? " is-active" : ""}`}
                onClick={() => setPanelMode(PANEL_MODE_SIMPLE)}
              >
                简易模式
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isProfessionalPanelMode}
                className={`panel-mode-button${isProfessionalPanelMode ? " is-active" : ""}`}
                onClick={() => setPanelMode(PANEL_MODE_PROFESSIONAL)}
              >
                专业模式
              </button>
            </div>
            {showPromptField ? (
              <>
                <div className="prompt-field-header">
                  <label className="field-label" htmlFor="prompt">
                    文本要求
                  </label>
                </div>
                <textarea
                  ref={promptTextareaRef}
                  id="prompt"
                  name="prompt"
                  rows={PROMPT_TEXTAREA_MIN_ROWS}
                  value={simplePrompt}
                  onChange={(event) => setSimplePrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (isPromptFocusMode && event.key === "Escape") {
                      event.preventDefault();
                      setPromptMode("simple");
                    }
                  }}
                  placeholder="描述你想要的 banana 画面、风格、镜头、材质、色调和构图"
                />

                {isPromptFocusMode ? (
                  <div className="focus-mode-note">按 `Esc` 也可以退出专注输入。</div>
                ) : null}

                <div
                  className={`storyboard-style-disclosure simple-reference-disclosure${simpleReferenceDisclosureOpen ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className={`storyboard-style-toggle${simpleReferenceDisclosureOpen ? " is-open" : ""}`}
                    aria-expanded={simpleReferenceDisclosureOpen}
                    aria-controls="simple-reference-controls"
                    onClick={() =>
                      setSimpleReferenceDisclosureOpen((currentValue) => !currentValue)
                    }
                  >
                    <span>简易模式参考图</span>
                    <span className="storyboard-style-toggle-meta">
                      {simpleStyleReference ? `已上传：${simpleStyleReference.name}` : "未设置，可选"}
                    </span>
                    <span className="storyboard-style-toggle-icon" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {simpleReferenceDisclosureOpen ? (
                    <div className="storyboard-style-controls-shell">
                      <div
                        id="simple-reference-controls"
                        className="simple-reference-panel"
                        aria-label="简易模式参考图设置"
                      >
                        <p className="simple-reference-note">
                          可选上传 1 张参考图。简易模式不会限制长宽比，交给模型自行判断更合适的画幅。
                        </p>

                        {simpleStyleReference ? (
                          <div className="professional-style-reference-card">
                            <div className="professional-style-reference-media">
                              <img
                                src={simpleStyleReference.previewUrl}
                                alt={simpleStyleReference.name}
                                draggable="false"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                            <div className="professional-style-reference-copy">
                              <strong title={simpleStyleReference.name}>
                                {simpleStyleReference.name}
                              </strong>
                              <span>这张图会作为简易模式的参考图，帮助模型理解主体和风格。</span>
                              {getReferenceImageOptimizationSummary(simpleStyleReference) ? (
                                <span>{getReferenceImageOptimizationSummary(simpleStyleReference)}</span>
                              ) : null}
                            </div>
                            <div className="professional-style-reference-actions">
                              <label
                                className="ghost-button professional-style-reference-action"
                                aria-label="更换简易模式参考图"
                                title="上传新图"
                              >
                                <svg viewBox="0 0 20 20" aria-hidden="true">
                                  <path d="M10 13V4.5" />
                                  <path d="m6.8 7.7 3.2-3.2 3.2 3.2" />
                                  <path d="M4.5 14.5v.6c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4v-.6" />
                                </svg>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleSimpleReferenceFileChange}
                                />
                              </label>
                              <button
                                type="button"
                                className="ghost-button professional-style-reference-action professional-style-reference-action-danger"
                                onClick={() => handleRemoveSimpleReferenceImage(simpleStyleReference.id)}
                                aria-label="移除简易模式参考图"
                                title="移除图片"
                              >
                                <svg viewBox="0 0 20 20" aria-hidden="true">
                                  <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
                                  <path d="M4 6h12" />
                                  <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
                                  <path d="M8 9v4.5" />
                                  <path d="M12 9v4.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label
                            className={`upload-box professional-style-upload${uploadDragActive ? " is-drag-active" : ""}`}
                            onDragOver={handleUploadDragOver}
                            onDragLeave={handleUploadDragLeave}
                            onDrop={handleSimpleReferenceUploadDrop}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleSimpleReferenceFileChange}
                            />
                            <span>上传简易模式参考图</span>
                            <small>支持点击选择或拖入图片，最多 1 张。超大图片会自动压缩后上传。</small>
                          </label>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {showProfessionalPanelControls ? (
              <>
                <div className="layout-config-card">
                  <div className="layout-control-row">
                    <div className="image-option-field layout-select-field canvas-size-full-row-field">
                      <label className="field-label" htmlFor="canvasSizeSelector">
                        常用场景
                      </label>
                      <div className="scenario-select-row">
                        <select
                          id="canvasSizeSelector"
                          name="canvasSizeSelector"
                          className="model-selector compact-selector scenario-compact-selector"
                          value={professionalCanvasSize}
                          onChange={(event) => handleProfessionalScenarioChange(event.target.value)}
                        >
                          {allCanvasScenarioOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="ghost-button scenario-manager-trigger"
                          onClick={openScenarioManager}
                          aria-label="打开常用场景管理面板"
                          title="管理常用场景"
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M4.5 5.5h11" />
                            <path d="M4.5 10h11" />
                            <path d="M4.5 14.5h11" />
                            <path d="M7 4.5v11" />
                            <path d="M13 4.5v11" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {isSimplePanelMode ? (
                      <label className="image-option-field image-count-field" htmlFor="imageCountSelector">
                        <span className="field-label">生成张数</span>
                        <select
                          id="imageCountSelector"
                          name="imageCountSelector"
                          className="model-selector compact-selector"
                          value={professionalSelectedImageCount}
                          onChange={(event) =>
                            setProfessionalSelectedImageCount(
                              normalizeImageCountValue(event.target.value),
                            )
                          }
                        >
                          {IMAGE_COUNT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                  </div>

                  <div className="professional-storyboard-global-panel">
                    <label className="field-label" htmlFor="professionalGlobalPrompt">
                      全局提示词与画风参考图
                    </label>
                    <textarea
                      className="professional-global-prompt-textarea"
                      id="professionalGlobalPrompt"
                      name="professionalGlobalPrompt"
                      rows={2}
                      value={professionalGlobalPrompt}
                      onChange={(event) => setProfessionalGlobalPrompt(event.target.value)}
                      placeholder="补充所有分镜共享的人物设定、画风、服装一致性、镜头语言和整体氛围"
                    />

                    <div className="professional-style-reference-panel">
                      {professionalStyleReference ? (
                        <div className="professional-style-reference-card">
                          <div className="professional-style-reference-media">
                            <img
                              src={professionalStyleReference.previewUrl}
                              alt={professionalStyleReference.name}
                              draggable="false"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="professional-style-reference-copy">
                            <strong title={professionalStyleReference.name}>
                              {professionalStyleReference.name}
                            </strong>
                            <span>这张图会自动附加到每个格子的生图请求里。</span>
                            {getReferenceImageOptimizationSummary(professionalStyleReference) ? (
                              <span>{getReferenceImageOptimizationSummary(professionalStyleReference)}</span>
                            ) : null}
                          </div>
                          <div className="professional-style-reference-actions">
                            <label
                              className="ghost-button professional-style-reference-action"
                              aria-label="更换整体画风参考图"
                              title="上传新图"
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M10 13V4.5" />
                                <path d="m6.8 7.7 3.2-3.2 3.2 3.2" />
                                <path d="M4.5 14.5v.6c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4v-.6" />
                              </svg>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                              />
                            </label>
                            <button
                              type="button"
                              className="ghost-button professional-style-reference-action professional-style-reference-action-danger"
                              onClick={() => handleRemoveReferenceImage(professionalStyleReference.id)}
                              aria-label="移除整体画风参考图"
                              title="移除图片"
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
                                <path d="M4 6h12" />
                                <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
                                <path d="M8 9v4.5" />
                                <path d="M12 9v4.5" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label
                          className={`upload-box professional-style-upload${uploadDragActive ? " is-drag-active" : ""}`}
                          onDragOver={handleUploadDragOver}
                          onDragLeave={handleUploadDragLeave}
                          onDrop={handleUploadDrop}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                          <span>上传整体画风参考图</span>
                          <small>支持点击选择或拖入图片，最多 1 张。超大图片会自动压缩后上传。</small>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="layout-preview-toolbar">
                    <div className="section-title-inline">
                      <strong>分镜表格</strong>
                      <span>刷新后会自动恢复已填写内容和已生成图片。</span>
                    </div>
                    <div className="layout-preview-toolbar-actions">
                      <button
                        type="button"
                        className="ghost-button storyboard-clear-button"
                        onClick={openStoryboardClearConfirm}
                        disabled={!storyboardHasContent || storyboardHasLoadingCells}
                      >
                        清空表格
                      </button>
                    </div>
                  </div>

                  <div className="layout-preview-shell">
                    <div className="layout-preview-square" style={storyboardShellStyle}>
                      <DndContext
                        sensors={storyboardDragSensors}
                        collisionDetection={resolveStoryboardCollisionDetection}
                        onDragStart={handleStoryboardDragStart}
                        onDragCancel={handleStoryboardDragCancel}
                        onDragEnd={handleStoryboardDragEnd}
                      >
                        <SortableContext
                          items={storyboardSortableIds}
                          strategy={rectSwappingStrategy}
                        >
                          <div
                            className={`storyboard-grid${activeStoryboardDragId ? " is-sorting" : ""}`}
                            style={storyboardGridStyle}
                            role="grid"
                            aria-label="专业模式分镜表格，可拖拽调整格子顺序"
                          >
                            {storyboardCellList.map((cell) => (
                              <SortableStoryboardCell
                                key={cell.id}
                                cell={cell}
                                dragDisabled={cell.status === "loading"}
                                dragHandleOnly={isMobilePerformanceMode}
                                onOpen={handleStoryboardCellOpen}
                                onClear={openStoryboardCellClearConfirm}
                              />
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay dropAnimation={null}>
                          {activeStoryboardDragCell ? (
                            <div
                              className={buildStoryboardCellClassName(activeStoryboardDragCell, {
                                isOverlay: true,
                              })}
                              aria-hidden="true"
                            >
                              <StoryboardCellContent cell={activeStoryboardDragCell} />
                            </div>
                          ) : null}
                        </DragOverlay>
                      </DndContext>
                    </div>
                  </div>

                  <div
                    className={`storyboard-style-disclosure professional-storyboard-disclosure${storyboardImageControlsCollapsed ? "" : " is-open"}`}
                  >
                    <button
                      type="button"
                      className={`storyboard-style-toggle${storyboardImageControlsCollapsed ? "" : " is-open"}`}
                      aria-expanded={!storyboardImageControlsCollapsed}
                      aria-controls="storyboard-image-controls"
                      onClick={() =>
                        setStoryboardImageControlsCollapsed((currentValue) => !currentValue)
                      }
                    >
                      <span>图片设置</span>
                      <span className="storyboard-style-toggle-meta">
                        底模 {selectedModel?.name || professionalSelectedModelId || "未选择"} · 比例 {professionalStoryboardAspectRatioValue} · 分辨率 {professionalStoryboardImageSizeValue}
                      </span>
                      <span className="storyboard-style-toggle-icon" aria-hidden="true">
                        ▾
                      </span>
                    </button>

                    {!storyboardImageControlsCollapsed ? (
                      <div className="storyboard-style-controls-shell">
                        <div
                          id="storyboard-image-controls"
                          className="layout-preview-controls storyboard-style-controls-panel"
                          aria-label="分镜表格图片设置"
                        >
                          <label
                            className="image-option-field storyboard-model-field"
                            htmlFor="bananaModelSelector"
                          >
                            <span className="field-label">底模选择</span>
                            <select
                              id="bananaModelSelector"
                              name="bananaModelSelector"
                              className="model-selector compact-selector"
                              value={professionalSelectedModelId}
                              onChange={(event) => setProfessionalSelectedModelId(event.target.value)}
                            >
                              {models.map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.name} · {model.priceLabel}
                                </option>
                              ))}
                            </select>
                            {selectedModel ? (
                              <small className="model-helper-text">{selectedModel.description}</small>
                            ) : null}
                          </label>

                          <label
                            className="image-option-field"
                            htmlFor="storyboardGlobalAspectRatio"
                          >
                            <span className="field-label-inline">
                              <span className="field-label">图片比例</span>
                              {recommendedStoryboardAspectRatio ? (
                                <small className="field-label-recommendation">
                                  推荐比例 {recommendedStoryboardAspectRatio.option.value}
                                  {recommendedStoryboardAspectRatio.option.value ===
                                  professionalStoryboardAspectRatioValue
                                    ? "（当前）"
                                    : ""}
                                </small>
                              ) : null}
                            </span>
                            <select
                              id="storyboardGlobalAspectRatio"
                              name="storyboardGlobalAspectRatio"
                              className="model-selector compact-selector"
                              value={professionalStoryboardAspectRatioValue}
                              onChange={(event) =>
                                setProfessionalStoryboardAspectRatio(
                                  normalizeAspectRatioValue(event.target.value),
                                )
                              }
                            >
                              {availableAspectRatioOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {recommendedStoryboardAspectRatio ? (
                              <div className="field-helper-row">
                                <small className="field-helper-text">
                                  按当前分镜单格的实际长宽比计算，选择{" "}
                                  {recommendedStoryboardAspectRatio.option.label} 时预计裁剪最少
                                  （约 {formatCropPercentValue(recommendedStoryboardAspectRatio.cropFraction)}）。
                                </small>
                                {canApplyRecommendedStoryboardAspectRatio ? (
                                  <button
                                    type="button"
                                    className="ghost-button field-helper-action"
                                    onClick={() =>
                                      setProfessionalStoryboardAspectRatio(
                                        recommendedStoryboardAspectRatio.option.value,
                                      )
                                    }
                                  >
                                    一键应用
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </label>

                          <label
                            className="image-option-field"
                            htmlFor="storyboardGlobalImageSize"
                          >
                            <span className="field-label">分辨率</span>
                            <select
                              id="storyboardGlobalImageSize"
                              name="storyboardGlobalImageSize"
                              className="model-selector compact-selector"
                              value={professionalStoryboardImageSizeValue}
                              onChange={(event) =>
                                setProfessionalStoryboardImageSize(
                                  normalizeImageSizeValue(event.target.value),
                                )
                              }
                            >
                              {availableImageSizeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`storyboard-style-disclosure professional-storyboard-disclosure${storyboardStyleControlsCollapsed ? "" : " is-open"}`}
                  >
                    <button
                      type="button"
                      className={`storyboard-style-toggle${storyboardStyleControlsCollapsed ? "" : " is-open"}`}
                      aria-expanded={!storyboardStyleControlsCollapsed}
                      aria-controls="storyboard-style-controls"
                      onClick={() =>
                        setStoryboardStyleControlsCollapsed((currentValue) => !currentValue)
                      }
                    >
                      <span>表格样式设置</span>
                      <span className="storyboard-style-toggle-meta">
                        布局 {professionalLayoutRows} × {professionalLayoutColumns} · 分割线 {professionalStoryboardDividerWidthPx}px · 配文字号 {professionalStoryboardCaptionFontSizePercent}%
                      </span>
                      <span className="storyboard-style-toggle-icon" aria-hidden="true">
                        ▾
                      </span>
                    </button>

                    {!storyboardStyleControlsCollapsed ? (
                      <div className="storyboard-style-controls-shell">
                        <div
                          id="storyboard-style-controls"
                          className="layout-preview-controls storyboard-style-controls-panel"
                          aria-label="分镜表格样式设置"
                        >
                          <label className="image-option-field layout-track-field" htmlFor="layoutRows">
                            <span className="field-label">行数</span>
                            <select
                              id="layoutRows"
                              name="layoutRows"
                              className="model-selector compact-selector"
                              value={professionalLayoutRows}
                              onChange={(event) => {
                                const nextRows = clampLayoutTrack(event.target.value);
                                const nextRecommendedAspectRatio =
                                  findRecommendedStoryboardAspectRatioForLayout({
                                    options: availableAspectRatioOptions,
                                    canvasWidth: professionalCanvasSizeOption.width,
                                    canvasHeight: professionalCanvasSizeOption.height,
                                    rows: nextRows,
                                    columns: professionalLayoutColumns,
                                  });

                                setProfessionalLayoutRows(nextRows);

                                if (nextRecommendedAspectRatio?.option?.value) {
                                  setProfessionalStoryboardAspectRatio(
                                    nextRecommendedAspectRatio.option.value,
                                  );
                                }
                              }}
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
                              value={professionalLayoutColumns}
                              onChange={(event) => {
                                const nextColumns = clampLayoutTrack(event.target.value);
                                const nextRecommendedAspectRatio =
                                  findRecommendedStoryboardAspectRatioForLayout({
                                    options: availableAspectRatioOptions,
                                    canvasWidth: professionalCanvasSizeOption.width,
                                    canvasHeight: professionalCanvasSizeOption.height,
                                    rows: professionalLayoutRows,
                                    columns: nextColumns,
                                  });

                                setProfessionalLayoutColumns(nextColumns);

                                if (nextRecommendedAspectRatio?.option?.value) {
                                  setProfessionalStoryboardAspectRatio(
                                    nextRecommendedAspectRatio.option.value,
                                  );
                                }
                              }}
                            >
                              {LAYOUT_TRACK_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label
                            className="image-option-field compact-range-field"
                            htmlFor="storyboardDividerWidth"
                          >
                            <span className="field-label">
                              分割线
                              <strong>{professionalStoryboardDividerWidthPx}px</strong>
                            </span>
                            <input
                              id="storyboardDividerWidth"
                              name="storyboardDividerWidth"
                              type="range"
                              min={MIN_STORYBOARD_DIVIDER_WIDTH_PX}
                              max={MAX_STORYBOARD_DIVIDER_WIDTH_PX}
                              step="1"
                              value={professionalStoryboardDividerWidthPx}
                              onChange={(event) =>
                                setProfessionalStoryboardDividerWidthPx(
                                  normalizeStoryboardDividerWidthPx(event.target.value),
                                )
                              }
                            />
                          </label>

                          <label
                            className="image-option-field compact-range-field"
                            htmlFor="storyboardCaptionFontSize"
                          >
                            <span className="field-label">
                              配文字号
                              <strong>{professionalStoryboardCaptionFontSizePercent}%</strong>
                            </span>
                            <input
                              id="storyboardCaptionFontSize"
                              name="storyboardCaptionFontSize"
                              type="range"
                              min={MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT}
                              max={MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT}
                              step="5"
                              value={professionalStoryboardCaptionFontSizePercent}
                              onChange={(event) =>
                                setProfessionalStoryboardCaptionFontSizePercent(
                                  normalizeStoryboardCaptionFontSizePercent(event.target.value),
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {studioError ? <p className="error-text">{studioError}</p> : null}
            {studioNotice ? <p className="info-text">{studioNotice}</p> : null}

            {showSimplePanelSubmit ? (
              <>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={studioPending || !generationModelId}
                >
                  {studioPending ? "banana 正在生图..." : "开始生成"}
                </button>
              </>
            ) : null}
            {showProfessionalPanelControls && remainingQuota !== null ? (
              <p className="quota-hint">剩余{remainingQuota}张额度</p>
            ) : null}
          </form>
        </section>
      </main>
      {taskManagerOpen ? (
        <div
          className="task-manager-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="任务列表"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setTaskManagerOpen(false);
            }
          }}
        >
          <section className="task-manager-panel">
            <div className="scenario-manager-windowbar">
              <span className="finder-window-spacer" aria-hidden="true" />
              <strong>任务列表</strong>
              <button
                type="button"
                className="finder-close-button"
                onClick={() => setTaskManagerOpen(false)}
                aria-label="关闭任务列表"
                title="关闭"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="task-manager-body">
              <div className="finder-browser-toolbar task-manager-toolbar">
                <div className="finder-browser-title">
                  <strong>当前与历史任务</strong>
                  <span>这里会显示正在请求中的任务，以及断网后恢复过的任务状态。</span>
                </div>
                <div className="finder-browser-meta">
                  <span>活跃 {activeRequestTaskCount}</span>
                  <span>总计 {sortedRequestTasks.length}</span>
                  <button
                    type="button"
                    className="ghost-button task-manager-clear-button"
                    onClick={() => clearTerminalRequestTasks()}
                    disabled={clearableRequestTaskCount === 0}
                  >
                    清理历史
                  </button>
                </div>
              </div>

              {sortedRequestTasks.length > 0 ? (
                <div className="task-manager-list">
                  {sortedRequestTasks.map((task) => (
                    <article key={task.requestId} className={`task-manager-item is-${task.status}`}>
                      <div className="task-manager-item-header">
                        <div className="task-manager-item-copy">
                          <strong>{buildRequestTaskMeta(task)}</strong>
                          <span>{task.message || "等待状态更新..."}</span>
                        </div>
                        <span className={`task-manager-status-badge is-${task.status}`}>
                          {getRequestTaskStatusLabel(task)}
                        </span>
                      </div>
                      {buildRequestTaskQueueSummary(task) ? (
                        <p className="task-manager-queue-note">{buildRequestTaskQueueSummary(task)}</p>
                      ) : null}
                      {task.error ? <p className="error-text task-manager-error">{task.error}</p> : null}
                      {canRetryRequestTask(task) || !isRequestTaskTerminal(task) ? (
                        <div className="task-manager-actions">
                          {!isRequestTaskTerminal(task) ? (
                            cancellingRequestTaskIds[task.requestId] ? (
                              <button
                                type="button"
                                className="ghost-button task-manager-retry-button"
                                disabled
                              >
                                取消中...
                              </button>
                            ) : requestTaskCancelConfirmId === task.requestId ? (
                              <>
                                <button
                                  type="button"
                                  className="primary-button storyboard-confirm-danger task-manager-retry-button"
                                  onClick={handleConfirmCancelRequestTask}
                                >
                                  确认取消任务
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button task-manager-retry-button"
                                  onClick={closeRequestTaskCancelConfirm}
                                >
                                  放弃取消任务
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="ghost-button task-manager-retry-button"
                                onClick={() => openRequestTaskCancelConfirm(task.requestId)}
                              >
                                取消任务
                              </button>
                            )
                          ) : null}
                          {canRetryRequestTask(task) ? (
                            <button
                              type="button"
                              className="ghost-button task-manager-retry-button"
                              onClick={() => handleRetryRequestTask(task)}
                              disabled={Boolean(retryingRequestTaskIds[task.requestId])}
                            >
                              {retryingRequestTaskIds[task.requestId] ? "重试中..." : "重试"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state task-manager-empty-state">
                  <p>还没有任务。</p>
                  <small>发起一次生图或提升清晰度后，这里会实时显示任务状态。</small>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {scenarioManagerOpen ? (
        <div
          className="scenario-manager-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="常用场景管理"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeScenarioManager();
            }
          }}
        >
          <section className="scenario-manager-panel">
            <div className="scenario-manager-windowbar">
              <span className="finder-window-spacer" aria-hidden="true" />
              <strong>常用场景管理</strong>
              <button
                type="button"
                className="finder-close-button"
                onClick={closeScenarioManager}
                aria-label="关闭常用场景管理"
                title="关闭"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="scenario-manager-layout">
              <aside className="scenario-manager-sidebar">
                <div className="scenario-manager-section">
                  <div className="section-title-inline">
                    <strong>系统场景</strong>
                    <span>内置预设可直接使用，不支持删除。</span>
                  </div>
                  <div className="scenario-manager-list">
                    {CANVAS_SIZE_OPTIONS.map((scenario) => (
                      <button
                        key={scenario.value}
                        type="button"
                        className={`scenario-manager-item scenario-manager-item-button${scenarioManagerSelectedType === "system" && scenarioManagerSelectedId === scenario.value ? " is-active" : ""}`}
                        onClick={() => handleScenarioManagerSelectSystem(scenario.value)}
                      >
                        <span className="scenario-manager-item-copy">
                          <strong>{scenario.label}</strong>
                          <span>
                            {scenario.layoutRows} 行 × {scenario.layoutColumns} 列
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="scenario-manager-section">
                  <div className="scenario-manager-section-header">
                    <div className="section-title-inline">
                      <strong>自定义场景</strong>
                      <span>支持新增、修改、删除，保存后会出现在下拉里。</span>
                    </div>
                    <button
                      type="button"
                      className="ghost-button scenario-manager-add-button"
                      onClick={handleScenarioManagerCreate}
                    >
                      新建
                    </button>
                  </div>

                  {professionalCustomScenarios.length > 0 ? (
                    <div className="scenario-manager-list">
                      {professionalCustomScenarios.map((scenario) => (
                        <button
                          key={scenario.value}
                          type="button"
                          className={`scenario-manager-item scenario-manager-item-button${scenarioManagerSelectedId === scenario.value ? " is-active" : ""}`}
                          onClick={() => handleScenarioManagerSelect(scenario.value)}
                        >
                          <span className="scenario-manager-item-copy">
                            <strong>{scenario.label}</strong>
                            <span>
                              {scenario.width} × {scenario.height} · {scenario.layoutRows} 行 × {scenario.layoutColumns} 列
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state scenario-manager-empty-state">
                      <p>还没有自定义场景。</p>
                      <small>点右上角“新建”即可创建一个可复用场景。</small>
                    </div>
                  )}
                </div>
              </aside>

              <section className="scenario-manager-editor">
                <div className="section-title-inline">
                  <strong>
                    {scenarioManagerSelectedType === "system"
                      ? "查看系统场景"
                      : scenarioManagerSelectedId
                        ? "编辑自定义场景"
                        : "新建自定义场景"}
                  </strong>
                  <span>
                    {scenarioManagerSelectedType === "system"
                      ? "系统场景仅支持查看和使用，不支持修改或删除。"
                      : "场景会同时保存画板尺寸、行、列设置。"}
                  </span>
                </div>

                {scenarioManagerSelectedType === "system" ? (
                  <>
                    <div className="scenario-manager-preview">
                      <strong>{scenarioManagerDraft.label}</strong>
                      <span>
                        {scenarioManagerDraft.width} × {scenarioManagerDraft.height} · {scenarioManagerDraft.layoutRows} 行 × {scenarioManagerDraft.layoutColumns} 列
                      </span>
                    </div>

                    <div className="scenario-manager-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={closeScenarioManager}
                      >
                        关闭
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                          handleProfessionalScenarioChange(scenarioManagerSelectedId);
                          closeScenarioManager();
                        }}
                      >
                        使用这个场景
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="image-option-field" htmlFor="scenarioManagerLabel">
                      <span className="field-label">场景名称</span>
                      <input
                        id="scenarioManagerLabel"
                        name="scenarioManagerLabel"
                        type="text"
                        value={scenarioManagerDraft.label}
                        onChange={(event) => handleScenarioManagerDraftLabelChange(event.target.value)}
                        placeholder="例如：四宫格故事封面"
                      />
                    </label>

                    <div className="scenario-manager-form-grid">
                      <label className="image-option-field" htmlFor="scenarioManagerWidth">
                        <span className="field-label">宽度 px</span>
                        <input
                          id="scenarioManagerWidth"
                          name="scenarioManagerWidth"
                          type="number"
                          step="1"
                          inputMode="numeric"
                          value={scenarioManagerDraft.width}
                          onChange={(event) =>
                            handleScenarioManagerDraftDimensionChange("width", event.target.value)
                          }
                        />
                      </label>

                      <label className="image-option-field" htmlFor="scenarioManagerHeight">
                        <span className="field-label">高度 px</span>
                        <input
                          id="scenarioManagerHeight"
                          name="scenarioManagerHeight"
                          type="number"
                          step="1"
                          inputMode="numeric"
                          value={scenarioManagerDraft.height}
                          onChange={(event) =>
                            handleScenarioManagerDraftDimensionChange("height", event.target.value)
                          }
                        />
                      </label>

                      <label className="image-option-field" htmlFor="scenarioManagerRows">
                        <span className="field-label">行</span>
                        <select
                          id="scenarioManagerRows"
                          name="scenarioManagerRows"
                          className="model-selector compact-selector"
                          value={scenarioManagerDraft.layoutRows}
                          onChange={(event) =>
                            handleScenarioManagerDraftLayoutChange("layoutRows", event.target.value)
                          }
                        >
                          {LAYOUT_TRACK_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="image-option-field" htmlFor="scenarioManagerColumns">
                        <span className="field-label">列</span>
                        <select
                          id="scenarioManagerColumns"
                          name="scenarioManagerColumns"
                          className="model-selector compact-selector"
                          value={scenarioManagerDraft.layoutColumns}
                          onChange={(event) =>
                            handleScenarioManagerDraftLayoutChange("layoutColumns", event.target.value)
                          }
                        >
                          {LAYOUT_TRACK_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="scenario-manager-preview">
                      <strong>预览</strong>
                      <span>
                        {scenarioManagerDraft.width} × {scenarioManagerDraft.height} · {scenarioManagerDraft.layoutRows} 行 × {scenarioManagerDraft.layoutColumns} 列
                      </span>
                    </div>

                    <div className="scenario-manager-actions">
                      {scenarioManagerSelectedId ? (
                        <button
                          type="button"
                          className="ghost-button scenario-manager-delete-button"
                          onClick={() => handleScenarioManagerDelete(scenarioManagerSelectedId)}
                        >
                          删除
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={closeScenarioManager}
                      >
                        关闭
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={handleScenarioManagerSave}
                      >
                        {scenarioManagerSelectedId ? "保存修改" : "保存场景"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
      {storyboardEditorOpen && storyboardEditorCell ? (
        <div
          className="storyboard-editor-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${storyboardEditorCell.label} 输入面板`}
        >
          <section className="storyboard-editor-panel">
            <div className="storyboard-editor-windowbar">
              <span className="storyboard-editor-windowbar-spacer" aria-hidden="true" />
              <strong>
                {storyboardEditorCell.label} · 行 {storyboardEditorCell.row} / 列 {storyboardEditorCell.column}
              </strong>
              <button
                type="button"
                className="finder-close-button"
                onClick={closeStoryboardEditor}
                aria-label="关闭输入面板"
                title="关闭"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10" />
                  <path d="M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="storyboard-editor-mode-row">
              <div className="storyboard-editor-mode-switcher" role="tablist" aria-label="当前格子编辑模式">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isStoryboardEditorGenerateMode}
                  className={`storyboard-editor-mode-button${isStoryboardEditorGenerateMode ? " is-active" : ""}`}
                  onClick={() => setStoryboardEditorMode(STORYBOARD_EDITOR_MODE_GENERATE)}
                >
                  传统生图
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isStoryboardEditorAssetMode}
                  className={`storyboard-editor-mode-button${isStoryboardEditorAssetMode ? " is-active" : ""}`}
                  onClick={() => setStoryboardEditorMode(STORYBOARD_EDITOR_MODE_ASSET)}
                >
                  选择图片
                </button>
              </div>
            </div>

            <div className="storyboard-editor-layout has-preview">
              <div className="storyboard-editor-form">
                <p className="storyboard-editor-mode-note">
                  当前模式只会修改这个格子，不会影响其它格子。
                </p>

                {isStoryboardEditorGenerateMode ? (
                  <>
                    <label className="field-label" htmlFor="storyboardCellPrompt">
                      当前格子提示词
                    </label>
                    <textarea
                      className="storyboard-editor-prompt-textarea"
                      id="storyboardCellPrompt"
                      name="storyboardCellPrompt"
                      rows={6}
                      value={storyboardEditorCell.prompt}
                      onChange={(event) => handleStoryboardPromptChange(event.target.value)}
                      placeholder="描述这个格子的主体、镜头、动作、光线、材质和氛围"
                    />
                    <div className="storyboard-reference-panel">
                      <div className="storyboard-reference-panel-header">
                        <div className="section-title-inline">
                          <strong>当前格子的参考图</strong>
                          <span>只影响这个格子，生成时会继续叠加整体画风参考图。弹窗打开时支持 Ctrl/Command + V 粘贴剪贴板图片。</span>
                        </div>
                        {professionalStyleReference ? (
                          <span className="storyboard-reference-parent-hint">
                            已继承整体画风参考图
                          </span>
                        ) : null}
                      </div>

                      {storyboardEditorCell.referenceImages?.[0] ? (
                        <div className="professional-style-reference-card storyboard-reference-card">
                          <div className="professional-style-reference-media storyboard-reference-media">
                            <img
                              src={storyboardEditorCell.referenceImages[0].previewUrl}
                              alt={storyboardEditorCell.referenceImages[0].name}
                              draggable="false"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="professional-style-reference-copy">
                            <strong title={storyboardEditorCell.referenceImages[0].name}>
                              {storyboardEditorCell.referenceImages[0].name}
                            </strong>
                            <span>这张图会作为当前格子的额外参考，不会影响其它格子。</span>
                            {getReferenceImageOptimizationSummary(
                              storyboardEditorCell.referenceImages[0],
                            ) ? (
                              <span>
                                {getReferenceImageOptimizationSummary(
                                  storyboardEditorCell.referenceImages[0],
                                )}
                              </span>
                            ) : null}
                          </div>
                          <div className="professional-style-reference-actions">
                            <label
                              className="ghost-button professional-style-reference-action"
                              aria-label="更换当前格子的参考图"
                              title="上传新图"
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M10 13V4.5" />
                                <path d="m6.8 7.7 3.2-3.2 3.2 3.2" />
                                <path d="M4.5 14.5v.6c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4v-.6" />
                              </svg>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleStoryboardReferenceFileChange}
                              />
                            </label>
                            <button
                              type="button"
                              className="ghost-button professional-style-reference-action professional-style-reference-action-danger"
                              onClick={() =>
                                handleRemoveStoryboardReferenceImage(
                                  storyboardEditorCell.referenceImages[0].id,
                                )
                              }
                              aria-label="移除当前格子的参考图"
                              title="移除图片"
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
                                <path d="M4 6h12" />
                                <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
                                <path d="M8 9v4.5" />
                                <path d="M12 9v4.5" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="upload-box professional-style-upload storyboard-reference-upload">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleStoryboardReferenceFileChange}
                          />
                          <span>上传当前格子的参考图</span>
                          <small>支持 1 张图片，只作用于这个格子。超大图片会自动压缩后上传。</small>
                        </label>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="storyboard-editor-asset-panel">
                    <div className="section-title-inline">
                      <strong>当前格子图片</strong>
                      <span>可从本地上传，或从资源管理器选择一张图片放进当前格子。弹窗打开时也支持 Ctrl/Command + V 粘贴剪贴板图片。</span>
                    </div>

                    {storyboardEditorCell.record ? (
                      <div className="storyboard-editor-selected-asset-card">
                        <span className="storyboard-editor-selected-asset-media">
                          <img
                            src={storyboardEditorCell.record.previewUrl}
                            alt={storyboardEditorCell.record.downloadName || `${storyboardEditorCell.label} 当前图片`}
                            draggable="false"
                            loading="lazy"
                            decoding="async"
                          />
                        </span>
                        <span className="storyboard-editor-selected-asset-copy">
                          <strong
                            title={
                              storyboardEditorCell.record.downloadName ||
                              `${storyboardEditorCell.label} 当前图片`
                            }
                          >
                            {storyboardEditorCell.record.downloadName ||
                              `${storyboardEditorCell.label} 当前图片`}
                          </strong>
                          <span>
                            {storyboardEditorCell.record.imageSize === "本地导入"
                              ? storyboardEditorCell.statusText || "已导入当前格子的本地图片"
                              : storyboardEditorCell.statusText ===
                                    "已复用资源管理器中的图片，仅作用于当前格子"
                                ? storyboardEditorCell.statusText
                                : "当前格子正在使用这张图片。"}
                          </span>
                        </span>
                      </div>
                    ) : null}

                    <label className="upload-box storyboard-editor-asset-upload">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStoryboardLocalImageFileChange}
                        disabled={storyboardEditorCell.status === "loading"}
                      />
                      <span>上传本地图片到当前格子</span>
                      <small>只替换这个格子的图片，不会影响其它格子。</small>
                    </label>

                    <button
                      type="button"
                      className={`ghost-button storyboard-editor-library-button${storyboardLibraryPickerPending ? " is-pending" : ""}`}
                      onClick={handleToggleStoryboardLibraryPicker}
                      disabled={storyboardEditorCell.status === "loading" || storyboardLibraryPickerPending}
                    >
                      {storyboardLibraryPickerPending ? (
                        <>
                          <span className="storyboard-editor-library-spinner" aria-hidden="true" />
                          历史图片加载中...
                        </>
                      ) : storyboardLibraryPickerOpen ? (
                        "收起资源管理器图片"
                      ) : (
                        "从资源管理器选择图片"
                      )}
                    </button>

                    {storyboardLibraryPickerOpen ? (
                      generationLibrary.length > 0 ? (
                        <div className="storyboard-library-picker" role="list" aria-label="资源管理器图片列表">
                          {generationLibrary.map((record) => {
                            const isSelected = storyboardEditorCell.record?.id === record.id;
                            const fileTitle = record.downloadName || `banana-${record.id}.png`;

                            return (
                              <button
                                key={record.id}
                                type="button"
                                role="listitem"
                                className={`storyboard-library-item${isSelected ? " is-selected" : ""}`}
                                onClick={() => handleSelectStoryboardLibraryRecord(record)}
                              >
                                <span className="storyboard-library-item-media">
                                  <img
                                    src={record.previewUrl}
                                    alt={fileTitle}
                                    draggable="false"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </span>
                                <span className="storyboard-library-item-copy">
                                  <strong title={fileTitle}>{fileTitle}</strong>
                                  <span>
                                    {record.imageSize || "已保存"}
                                    {record.aspectRatio ? ` · ${record.aspectRatio}` : ""}
                                  </span>
                                  <small>{formatPersistedAt(record.persistedAt)}</small>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-state storyboard-library-empty-state">
                          <p>资源管理器里还没有图片。</p>
                          <small>先生成一张图，之后就可以在这里复用。</small>
                        </div>
                      )
                    ) : null}
                  </div>
                )}
                <div className="storyboard-caption-field">
                  <div className="storyboard-caption-field-header">
                    <label className="field-label" htmlFor="storyboardCellCaption">
                      配文
                    </label>
                    <span className="storyboard-caption-field-hint">
                      支持回车换行，导出会保留排版
                    </span>
                  </div>
                  <textarea
                    ref={storyboardCaptionTextareaRef}
                    id="storyboardCellCaption"
                    name="storyboardCellCaption"
                    className="storyboard-caption-textarea"
                    rows={2}
                    value={storyboardEditorCell.caption || ""}
                    onChange={(event) => handleStoryboardCaptionChange(event.target.value)}
                    placeholder={"输入要显示在格子底部的文案\n例如：原神启动"}
                  />
                </div>
                {storyboardEditorCell.statusText ? (
                  <p className="storyboard-editor-status">{storyboardEditorCell.statusText}</p>
                ) : null}
                {storyboardEditorCell.error ? (
                  <p className="error-text">{storyboardEditorCell.error}</p>
                ) : null}
                <div className="storyboard-editor-actions">
                  <button
                    type="button"
                    className="ghost-button storyboard-clear-button"
                    onClick={() => openStoryboardCellClearConfirm(storyboardEditorCell.id)}
                    disabled={
                      storyboardEditorCell.status === "loading" ||
                      !doesStoryboardCellHaveContent(storyboardEditorCell)
                    }
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
                      <path d="M4 6h12" />
                      <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
                      <path d="M8 9v4.5" />
                      <path d="M12 9v4.5" />
                    </svg>
                    <span>清空当前格子</span>
                  </button>
                  {isStoryboardEditorGenerateMode && storyboardEditorCell.status === "loading" ? (
                    storyboardEditorCell.pendingRequestId &&
                    requestTaskCancelConfirmId === storyboardEditorCell.pendingRequestId &&
                    !cancellingRequestTaskIds[storyboardEditorCell.pendingRequestId] ? (
                      <div className="inline-confirm-actions">
                        <button
                          type="button"
                          className="primary-button storyboard-confirm-danger"
                          onClick={handleConfirmCancelRequestTask}
                        >
                          确认取消任务
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={closeRequestTaskCancelConfirm}
                        >
                          放弃取消任务
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ghost-button storyboard-clear-button"
                        onClick={() =>
                          openRequestTaskCancelConfirm(storyboardEditorCell.pendingRequestId)
                        }
                        disabled={
                          !storyboardEditorCell.pendingRequestId ||
                          Boolean(cancellingRequestTaskIds[storyboardEditorCell.pendingRequestId])
                        }
                      >
                        <span>
                          {storyboardEditorCell.pendingRequestId &&
                          cancellingRequestTaskIds[storyboardEditorCell.pendingRequestId]
                            ? "取消中..."
                            : "取消当前任务"}
                        </span>
                      </button>
                    )
                  ) : null}
                  {isStoryboardEditorGenerateMode ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleStoryboardCellGenerate}
                      disabled={storyboardEditorCell.status === "loading" || !generationModelId}
                    >
                      {storyboardEditorCell.status === "loading"
                        ? "banana 正在生图..."
                        : storyboardEditorCell.record
                          ? "重新生成图片"
                          : "生成图片"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                className={`storyboard-editor-preview-card${storyboardEditorCell.status === "loading" && storyboardEditorCell.record ? " is-refreshing" : ""}`}
              >
                {storyboardEditorCell.record ? (
                  <button
                    type="button"
                    className="storyboard-editor-preview-button"
                    onClick={() => openImagePreview(storyboardEditorCell.record)}
                    aria-label="查看这个格子的图片"
                  >
                    <img
                      src={storyboardEditorCell.record.previewUrl}
                      alt={`${storyboardEditorCell.label} 生成结果`}
                      draggable="false"
                      decoding="async"
                    />
                  </button>
                ) : (
                  <div className="storyboard-editor-preview-empty">
                    <strong>当前还没有图片</strong>
                    <span>
                      {isStoryboardEditorAssetMode
                        ? "可以从本地上传，或从资源管理器里挑一张图片放进当前格子。"
                        : "填写提示词后直接生成，也可以补一张当前格子的参考图。"}
                    </span>
                  </div>
                )}
                <div className="storyboard-editor-preview-meta">
                  <strong>
                    {storyboardEditorCell.record
                      ? isStoryboardEditorAssetMode
                        ? "当前图片"
                        : "已生成图片"
                      : "图片预览区"}
                  </strong>
                  <span>
                    {storyboardEditorCell.record
                      ? `${storyboardEditorCell.record.imageSize || professionalStoryboardImageSizeValue}${
                          storyboardEditorCell.record.aspectRatio
                            ? ` · ${storyboardEditorCell.record.aspectRatio}`
                            : ` · ${professionalStoryboardAspectRatioValue}`
                        }`
                      : `目标生成规格 · ${professionalStoryboardImageSizeValue} · ${professionalStoryboardAspectRatioValue}`}
                  </span>
                </div>
              </div>
            </div>
            <div className="storyboard-editor-footer">
              <div className="storyboard-editor-pager" aria-label="切换分镜格子">
                <button
                  type="button"
                  className="ghost-button storyboard-editor-nav-button"
                  onClick={() => navigateStoryboardEditor("previous")}
                  disabled={!previousStoryboardEditorCell}
                >
                  上一格
                </button>
                <span className="storyboard-editor-pager-status">
                  第 {storyboardEditorCell.index} 格 / 共 {storyboardCellList.length} 格
                </span>
                <button
                  type="button"
                  className="ghost-button storyboard-editor-nav-button"
                  onClick={() => navigateStoryboardEditor("next")}
                  disabled={!nextStoryboardEditorCell}
                >
                  下一格
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {storyboardClearConfirmOpen ? (
        <div
          className="storyboard-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="确认清空分镜表格"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeStoryboardClearConfirm();
            }
          }}
        >
          <section className="storyboard-confirm-panel">
            <strong>确认清空表格？</strong>
            <p>这个操作会清掉当前表格里的提示词和已生成图片，刷新后也无法恢复。</p>
            <div className="storyboard-confirm-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={closeStoryboardClearConfirm}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-button storyboard-confirm-danger"
                onClick={handleClearStoryboard}
              >
                确认清空
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {storyboardCellClearConfirmCell ? (
        <div
          className="storyboard-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`确认清空${storyboardCellClearConfirmCell.label}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeStoryboardCellClearConfirm();
            }
          }}
        >
          <section className="storyboard-confirm-panel">
            <strong>确认清空 {storyboardCellClearConfirmCell.label}？</strong>
            <p>这个操作会清掉当前格子的提示词、配文、参考图和已生成图片，刷新后也无法恢复。</p>
            <div className="storyboard-confirm-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={closeStoryboardCellClearConfirm}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-button storyboard-confirm-danger"
                onClick={handleConfirmClearStoryboardCell}
              >
                确认清空
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
              decoding="async"
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
      {isProfessionalPanelMode ? backendBusyOverlay : null}
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
  const isE2eStudioRoute =
    import.meta.env.DEV &&
    normalizeTextValue(readSearchParam("e2e")) === "1";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminApp />;
  }

  if (pathname === "/" || pathname === "") {
    return <RouteRedirect to={LOGIN_PATH} />;
  }

  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return <BananaStudioApp routeMode={isE2eStudioRoute ? "studio" : "login"} />;
  }

  if (pathname === STUDIO_PATH || pathname.startsWith(`${STUDIO_PATH}/`)) {
    return <BananaStudioApp routeMode="studio" />;
  }

  return <RouteRedirect to={LOGIN_PATH} />;
}

export default App;
