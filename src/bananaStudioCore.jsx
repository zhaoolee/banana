import { DndContext, DragOverlay, closestCenter, pointerWithin } from "@dnd-kit/core";
import { SortableContext, rectSwappingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import { isRequestTaskTerminal } from "./stores/taskStore.js";
import { getProfessionalExportLayoutMetrics } from "../shared/professionalExportLayout.js";
import { PROFESSIONAL_EXPORT_FONT_FAMILY } from "../shared/professionalExportTheme.js";
import * as constants from "./bananaStudioConstants.js";
import { useDevRenderMetric } from "./devMetrics.js";

const {
  PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY,
  MAX_LAYOUT_TRACKS,
  VERTEX_INLINE_IMAGE_MAX_BYTES,
  REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES,
  REFERENCE_IMAGE_MAX_LONG_EDGE_PX,
  REFERENCE_IMAGE_MIN_LONG_EDGE_PX,
  REFERENCE_IMAGE_JPEG_QUALITY_STEPS,
  REFERENCE_IMAGE_RESIZE_STEPS,
  PROMPT_TEXTAREA_MIN_ROWS,
  PROMPT_TEXTAREA_MAX_ROWS,
  PANEL_MODE_SIMPLE,
  PANEL_MODE_PROFESSIONAL,
  CUSTOM_CANVAS_SIZE_VALUE,
  STORYBOARD_CELL_REFERENCE_LIMIT,
  DEFAULT_CUSTOM_CANVAS_WIDTH,
  DEFAULT_CUSTOM_CANVAS_HEIGHT,
  DEFAULT_STORYBOARD_DIVIDER_WIDTH_PX,
  MIN_STORYBOARD_DIVIDER_WIDTH_PX,
  MAX_STORYBOARD_DIVIDER_WIDTH_PX,
  DEFAULT_STORYBOARD_CAPTION_FONT_SIZE_PERCENT,
  MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT,
  MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT,
  DEFAULT_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT,
  MIN_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT,
  MAX_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT,
  SIMPLE_PANEL_DEFAULTS,
  ASPECT_RATIO_OPTIONS,
  CANVAS_SIZE_OPTIONS,
  REQUEST_TASK_RECOVERY_STALE_AFTER_MS,
  SUPPORTED_ASPECT_RATIO_VALUES,
  SUPPORTED_CANVAS_SIZE_VALUES,
  IMAGE_SIZE_OPTIONS,
  SUPPORTED_IMAGE_SIZE_VALUES,
  SUPPORTED_IMAGE_COUNT_VALUES,
  MIN_PREVIEW_SCALE,
  MAX_PREVIEW_SCALE,
} = constants;

export function createPersistedRecordId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createClientRequestId() {
  return createPersistedRecordId();
}

export function normalizeAspectRatioValue(value) {
  return SUPPORTED_ASPECT_RATIO_VALUES.has(value) ? value : "1:1";
}

export function normalizePanelModeValue(value) {
  return value === PANEL_MODE_SIMPLE || value === PANEL_MODE_PROFESSIONAL
    ? value
    : PANEL_MODE_PROFESSIONAL;
}

export function normalizeImageSizeValue(value) {
  return SUPPORTED_IMAGE_SIZE_VALUES.has(value) ? value : "1K";
}

export function normalizeImageCountValue(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return SUPPORTED_IMAGE_COUNT_VALUES.has(parsedValue) ? parsedValue : 1;
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

export function normalizeCanvasDimensionValue(value, fallbackValue) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.min(Math.max(parsedValue, 64), 10000);
}

export function normalizeStoryboardCaptionFontSizePercent(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_STORYBOARD_CAPTION_FONT_SIZE_PERCENT;
  }

  return Math.min(
    Math.max(parsedValue, MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT),
    MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT,
  );
}

export function normalizeStoryboardDividerWidthPx(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_STORYBOARD_DIVIDER_WIDTH_PX;
  }

  return Math.min(
    Math.max(parsedValue, MIN_STORYBOARD_DIVIDER_WIDTH_PX),
    MAX_STORYBOARD_DIVIDER_WIDTH_PX,
  );
}

export function normalizeStoryboardCaptionBackgroundAlphaPercent(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT;
  }

  return Math.min(
    Math.max(parsedValue, MIN_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT),
    MAX_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT,
  );
}

export function getAspectRatioOrientation(value) {
  const { width, height } = parseAspectRatio(value);

  if (width === height) {
    return "square";
  }

  return width > height ? "landscape" : "portrait";
}

export function getLayoutOrientation(rows, columns) {
  if (rows === columns) {
    return "square";
  }

  return columns > rows ? "landscape" : "portrait";
}

export function getRecommendedAspectRatiosForLayout(rows, columns) {
  const layoutOrientation = getLayoutOrientation(rows, columns);

  if (layoutOrientation === "landscape") {
    return ["4:1", "16:9", "21:9", "4:3"];
  }

  if (layoutOrientation === "portrait") {
    return ["1:4", "9:16", "3:4", "4:5"];
  }

  return ["1:1", "4:5", "5:4"];
}

export function clampPreviewScale(value) {
  return Math.min(Math.max(value, MIN_PREVIEW_SCALE), MAX_PREVIEW_SCALE);
}

export function getPointerDistance(firstPointer, secondPointer) {
  return Math.hypot(
    secondPointer.x - firstPointer.x,
    secondPointer.y - firstPointer.y,
  );
}

export function getModelAspectRatioOptions(model) {
  const allowedValues = new Set(
    Array.isArray(model?.supportedAspectRatios) && model.supportedAspectRatios.length > 0
      ? model.supportedAspectRatios
      : ASPECT_RATIO_OPTIONS.map((option) => option.value),
  );

  return ASPECT_RATIO_OPTIONS.filter((option) => allowedValues.has(option.value));
}

export function getModelImageSizeOptions(model) {
  const allowedValues = new Set(
    Array.isArray(model?.supportedImageSizes) && model.supportedImageSizes.length > 0
      ? model.supportedImageSizes
      : ["1K"],
  );

  return IMAGE_SIZE_OPTIONS.filter((option) => allowedValues.has(option.value));
}

export function clampLayoutTrack(value) {
  const parsedValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return 1;
  }

  return Math.min(Math.max(parsedValue, 1), MAX_LAYOUT_TRACKS);
}

export function normalizeTextValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeRemainingCredits(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

export function resolveSimplePanelModelId(models, fallbackModelId) {
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

export function resolveCanvasSizeFromLegacyAspectRatio(aspectRatioValue) {
  return aspectRatioValue === "3:4" ? "xiaohongshu-cover" : "programmer-lv1-lv7";
}

export function getCanvasSizeOption(
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

export function getCanvasScenarioOption(value, customScenarios = []) {
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

export function normalizeCanvasScenarioValue(value, customScenarios = []) {
  const customScenarioIds = new Set(customScenarios.map((scenario) => scenario.value));

  return SUPPORTED_CANVAS_SIZE_VALUES.has(value) ||
    customScenarioIds.has(value)
    ? value
    : CANVAS_SIZE_OPTIONS[0].value;
}

export function buildLayoutCells(rows, columns) {
  return Array.from({ length: rows * columns }, (_value, index) => index + 1);
}

export function buildStoryboardCellDefinitions(rows, columns) {
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

export function createStoryboardCellState(definition) {
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

export function findStoryboardCellIdByPendingRequestId(cells, requestId) {
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

export function shouldPreserveRuntimeStoryboardCell(cell) {
  return Boolean(
    cell?.record ||
      normalizeTextValue(cell?.pendingRequestId) ||
      cell?.status === "loading" ||
      normalizeTextValue(cell?.statusText) ||
      normalizeTextValue(cell?.error),
  );
}

export function mergeHydratedStoryboardCells(persistedCells, currentCells, rows, columns) {
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

export function buildStoryboardCellTaskPatch(task, currentCell) {
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

export function doesStoryboardCellHaveContent(cell) {
  return Boolean(
    normalizeTextValue(cell?.prompt) ||
      normalizeTextValue(cell?.caption) ||
      (Array.isArray(cell?.referenceImages) && cell.referenceImages.length > 0) ||
      cell?.record,
  );
}

export function buildStoryboardCellContentSnapshot(cell) {
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

export function swapStoryboardCellContent(currentCells, sourceCellId, targetCellId) {
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

export function normalizeStoryboardCells(currentCells, rows, columns) {
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

export function formatStoryboardPromptPreview(value) {
  const text = normalizeTextValue(value);

  if (!text) {
    return "点击填写分镜提示词";
  }

  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

export function getAspectRatioNumber(value) {
  const { width, height } = parseAspectRatio(value);
  return width / height;
}

export function calculateCoverCropFraction(imageAspectRatio, frameAspectRatio) {
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

export function findRecommendedStoryboardAspectRatioOption(options, frameAspectRatio) {
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

export function findRecommendedStoryboardAspectRatioForLayout({
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

export function formatCropPercentValue(value) {
  const safeValue = Math.max(0, value) * 100;

  if (safeValue >= 10) {
    return `${safeValue.toFixed(0)}%`;
  }

  if (safeValue >= 1) {
    return `${safeValue.toFixed(1)}%`;
  }

  return `${safeValue.toFixed(2)}%`;
}

export function buildStoryboardCellClassName(
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

export function buildStoryboardCellTransformStyle(transform, transition) {
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

export function resolveStoryboardCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  return closestCenter(args);
}

export const StoryboardCellContent = memo(function StoryboardCellContent({ cell }) {
  useDevRenderMetric("StoryboardCellContent", cell.id);

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
}, areStoryboardCellContentPropsEqual);

export function areStoryboardCellContentPropsEqual(previousProps, nextProps) {
  return previousProps.cell === nextProps.cell;
}

export const SortableStoryboardCell = memo(function SortableStoryboardCell({
  cell,
  dragDisabled = false,
  dragHandleOnly = false,
  interactionRef,
}) {
  useDevRenderMetric("SortableStoryboardCell", cell.id);

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
        onClick={() => interactionRef.current.open(cell.id)}
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
            interactionRef.current.clear(cell.id);
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
}, areSortableStoryboardCellPropsEqual);

export function areSortableStoryboardCellPropsEqual(previousProps, nextProps) {
  return previousProps.cell === nextProps.cell &&
    previousProps.dragDisabled === nextProps.dragDisabled &&
    previousProps.dragHandleOnly === nextProps.dragHandleOnly &&
    previousProps.interactionRef === nextProps.interactionRef;
}

export const ProfessionalStoryboardGridSection = memo(function ProfessionalStoryboardGridSection({
  clearButtonDisabled = false,
  actionRef,
  storyboardShellStyle,
  storyboardDragSensors,
  storyboardGridStyle,
  isSorting = false,
  storyboardSortableIds,
  storyboardCellList,
  isMobilePerformanceMode = false,
  interactionRef,
  activeStoryboardDragCell,
}) {
  useDevRenderMetric("ProfessionalStoryboardGridSection");

  return (
    <>
      <div className="layout-preview-toolbar">
        <div className="section-title-inline">
          <strong>分镜表格</strong>
          <span>刷新后会自动恢复已填写内容和已生成图片。</span>
        </div>
        <div className="layout-preview-toolbar-actions">
          <button
            type="button"
            className="ghost-button storyboard-clear-button"
            onClick={() => actionRef.current.openClearConfirm()}
            disabled={clearButtonDisabled}
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
            onDragStart={(event) => actionRef.current.onDragStart(event)}
            onDragCancel={() => actionRef.current.onDragCancel()}
            onDragEnd={(event) => actionRef.current.onDragEnd(event)}
          >
            <SortableContext
              items={storyboardSortableIds}
              strategy={rectSwappingStrategy}
            >
              <div
                className={`storyboard-grid${isSorting ? " is-sorting" : ""}`}
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
                    interactionRef={interactionRef}
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
    </>
  );
}, areProfessionalStoryboardGridSectionPropsEqual);

export function areProfessionalStoryboardGridSectionPropsEqual(previousProps, nextProps) {
  return previousProps.clearButtonDisabled === nextProps.clearButtonDisabled &&
    previousProps.actionRef === nextProps.actionRef &&
    previousProps.storyboardShellStyle === nextProps.storyboardShellStyle &&
    previousProps.storyboardDragSensors === nextProps.storyboardDragSensors &&
    previousProps.storyboardGridStyle === nextProps.storyboardGridStyle &&
    previousProps.isSorting === nextProps.isSorting &&
    previousProps.storyboardSortableIds === nextProps.storyboardSortableIds &&
    previousProps.storyboardCellList === nextProps.storyboardCellList &&
    previousProps.isMobilePerformanceMode === nextProps.isMobilePerformanceMode &&
    previousProps.interactionRef === nextProps.interactionRef &&
    previousProps.activeStoryboardDragCell === nextProps.activeStoryboardDragCell;
}

export function parseAspectRatio(value) {
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

export function formatAspectRatioCssValue(value) {
  const { width, height } = parseAspectRatio(value);
  return `${width} / ${height}`;
}

export function formatCanvasSizeAspectRatioValue(canvasSizeOption) {
  if (!canvasSizeOption) {
    return "1:1";
  }

  return `${canvasSizeOption.width}:${canvasSizeOption.height}`;
}

export function buildProfessionalExportCssVariables(
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
    "--professional-export-font-family": PROFESSIONAL_EXPORT_FONT_FAMILY,
    "--professional-export-caption-font-scale": String(captionFontScale),
    "--professional-export-caption-background-alpha": String(captionBackgroundAlpha),
  };
}

export function resizePromptTextarea(textarea) {
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

export function roundRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

export function drawLayoutGuide(canvas, { aspectRatio, rows, columns }) {
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

export function buildCanvasReferenceImage(canvas) {
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
export function readSearchParam(key) {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(key) || "";
}

export function detectMobilePerformanceMode() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches;
}

export function reorderReferenceImages(items, startIndex, endIndex) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(startIndex, 1);
  nextItems.splice(endIndex, 0, movedItem);
  return nextItems;
}

export function readLocalValue(key) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) || "";
}

export function writeLocalValue(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
}

export function sanitizeProfessionalCustomScenarios(items) {
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

export function readStoredProfessionalCustomScenarios() {
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

export function buildPersistedProfessionalCustomScenarios(scenarios) {
  return scenarios.map((scenario) => ({
    value: scenario.value,
    label: scenario.label,
    width: scenario.width,
    height: scenario.height,
    layoutRows: scenario.layoutRows,
    layoutColumns: scenario.layoutColumns,
  }));
}

export function formatPersistedAt(value) {
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

export function getRequestTaskTypeLabel(task) {
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

export function getRequestTaskStatusLabel(task) {
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

export function buildRequestTaskMeta(task) {
  const parts = [
    getRequestTaskTypeLabel(task),
    task?.requestId ? `ID ${task.requestId.slice(0, 8)}` : "",
    formatPersistedAt(task?.updatedAt || task?.createdAt),
  ].filter(Boolean);

  return parts.join(" · ");
}

export function buildRequestTaskQueueSummary(task) {
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

export function parseRequestTaskTimeMs(value) {
  const timeMs = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(timeMs) ? timeMs : 0;
}

export function isOrphanedPendingRequestTask(task, backendStartedAt) {
  if (isRequestTaskTerminal(task)) {
    return false;
  }

  const taskCreatedAtMs = parseRequestTaskTimeMs(task?.createdAt);
  const backendStartedAtMs = parseRequestTaskTimeMs(backendStartedAt);

  return taskCreatedAtMs > 0 && backendStartedAtMs > taskCreatedAtMs;
}

export function buildOrphanedRequestTaskPatch(task) {
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

export function buildMissingRecoverableRequestTaskPatch(
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

export function isRequestTaskRecoveryStale(task, referenceValue = "") {
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

export function buildGalleryDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(firstValue, secondValue) {
  return buildGalleryDateKey(firstValue) === buildGalleryDateKey(secondValue);
}

export function isWithinRecentDays(value, days) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return date >= start;
}

export function isCurrentMonth(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function getFinderFilterDefinitions(records) {
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

export function estimateBase64Size(base64 = "") {
  if (!base64) {
    return 0;
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function formatBytes(bytes) {
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

export function getReferenceImageOptimizationSummary(image) {
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

export function buildReferenceUploadFileName(name, mimeType) {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const safeBaseName = (trimmedName || "reference-image").replace(/\.[^./\\]+$/, "");
  return `${safeBaseName}.${getFileExtensionFromMimeType(mimeType)}`;
}

export function ensureClipboardImageFileName(file, index = 0) {
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

export function getImageFilesFromClipboardData(clipboardData) {
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

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function loadImageElementFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片解析失败，无法自动优化这张参考图"));
    image.decoding = "async";
    image.src = url;
  });
}

export function canvasToBlob(canvas, mimeType, quality) {
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

export function getScaledDimensions(width, height, scale) {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function optimizeReferenceImageFile(
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

export function secondsToEstimateMs(seconds) {
  return Math.max(1000, Math.round(seconds * 1000));
}

export function formatStreamPreviewText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "";
  }

  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}
