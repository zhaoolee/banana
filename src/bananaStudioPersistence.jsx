import * as constants from "./bananaStudioConstants.js";
import * as core from "./bananaStudioCore.jsx";

const {
  LOGIN_PATH,
  STUDIO_PATH,
  PANEL_MODE_STORAGE_KEY,
  LEGACY_SELECTED_MODEL_STORAGE_KEY,
  LEGACY_SELECTED_ASPECT_RATIO_STORAGE_KEY,
  LEGACY_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
  LEGACY_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
  LEGACY_SELECTED_IMAGE_SIZE_STORAGE_KEY,
  LEGACY_SELECTED_IMAGE_COUNT_STORAGE_KEY,
  LEGACY_PROMPT_STORAGE_KEY,
  PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY,
  PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY,
  PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY,
  PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY,
  PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY,
  PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY,
  PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
  PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY,
  PROFESSIONAL_SELECTED_IMAGE_SIZE_STORAGE_KEY,
  PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_CELLS_STORAGE_KEY,
  PROFESSIONAL_REFERENCE_IMAGES_STORAGE_KEY,
  SIMPLE_REFERENCE_IMAGES_STORAGE_KEY,
  SIMPLE_PROMPT_STORAGE_KEY,
  LAST_GENERATION_DB_NAME,
  LAST_GENERATION_STORE_NAME,
  LAST_GENERATION_RECORD_KEY,
  GENERATION_LIBRARY_RECORDS_KEY,
  LAST_GENERATION_RECORD_ID_KEY,
  MAX_REFERENCE_IMAGES,
  MAX_LAYOUT_TRACKS,
  VERTEX_INLINE_IMAGE_MAX_BYTES,
  REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES,
  REFERENCE_IMAGE_MAX_LONG_EDGE_PX,
  REFERENCE_IMAGE_MIN_LONG_EDGE_PX,
  REFERENCE_IMAGE_JPEG_QUALITY_STEPS,
  REFERENCE_IMAGE_RESIZE_STEPS,
  PROMPT_TEXTAREA_MIN_ROWS,
  PROMPT_TEXTAREA_MAX_ROWS,
  PROMPT_STORAGE_WRITE_DEBOUNCE_MS,
  PANEL_MODE_SIMPLE,
  PANEL_MODE_PROFESSIONAL,
  CUSTOM_CANVAS_SIZE_VALUE,
  STORYBOARD_EDITOR_MODE_GENERATE,
  STORYBOARD_EDITOR_MODE_ASSET,
  PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO,
  PROFESSIONAL_STYLE_REFERENCE_LIMIT,
  STORYBOARD_CELL_REFERENCE_LIMIT,
  PROFESSIONAL_SCENE_ARCHIVE_KIND,
  PROFESSIONAL_SCENE_ARCHIVE_VERSION,
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
  STORYBOARD_DRAG_ACTIVATION_DISTANCE_PX,
  STORYBOARD_MOBILE_DRAG_ACTIVATION_DELAY_MS,
  STORYBOARD_MOBILE_DRAG_TOLERANCE_PX,
  STORYBOARD_DRAG_CLICK_SUPPRESSION_MS,
  SIMPLE_PANEL_DEFAULTS,
  ASPECT_RATIO_OPTIONS,
  CANVAS_SIZE_OPTIONS,
  REQUEST_TASK_RECOVERY_STALE_AFTER_MS,
  SUPPORTED_ASPECT_RATIO_VALUES,
  SUPPORTED_CANVAS_SIZE_VALUES,
  IMAGE_SIZE_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  LAYOUT_TRACK_OPTIONS,
  SUPPORTED_IMAGE_SIZE_VALUES,
  SUPPORTED_IMAGE_COUNT_VALUES,
  MIN_PREVIEW_SCALE,
  MAX_PREVIEW_SCALE,
  SSE_CONNECT_TIMEOUT_MS,
  SSE_INACTIVITY_TIMEOUT_MS,
  generationResultStorage,
} = constants;

const {
  createPersistedRecordId,
  createClientRequestId,
  normalizeAspectRatioValue,
  normalizePanelModeValue,
  normalizeImageSizeValue,
  normalizeImageCountValue,
  normalizeCanvasDimensionValue,
  normalizeStoryboardCaptionFontSizePercent,
  normalizeStoryboardDividerWidthPx,
  normalizeStoryboardCaptionBackgroundAlphaPercent,
  getAspectRatioOrientation,
  getLayoutOrientation,
  getRecommendedAspectRatiosForLayout,
  clampPreviewScale,
  getPointerDistance,
  getModelAspectRatioOptions,
  getModelImageSizeOptions,
  clampLayoutTrack,
  normalizeTextValue,
  normalizeRemainingCredits,
  resolveSimplePanelModelId,
  resolveCanvasSizeFromLegacyAspectRatio,
  getCanvasSizeOption,
  getCanvasScenarioOption,
  normalizeCanvasScenarioValue,
  buildLayoutCells,
  buildStoryboardCellDefinitions,
  createStoryboardCellState,
  findStoryboardCellIdByPendingRequestId,
  shouldPreserveRuntimeStoryboardCell,
  mergeHydratedStoryboardCells,
  buildStoryboardCellTaskPatch,
  doesStoryboardCellHaveContent,
  buildStoryboardCellContentSnapshot,
  swapStoryboardCellContent,
  normalizeStoryboardCells,
  formatStoryboardPromptPreview,
  getAspectRatioNumber,
  calculateCoverCropFraction,
  findRecommendedStoryboardAspectRatioOption,
  findRecommendedStoryboardAspectRatioForLayout,
  formatCropPercentValue,
  buildStoryboardCellClassName,
  buildStoryboardCellTransformStyle,
  resolveStoryboardCollisionDetection,
  StoryboardCellContent,
  areStoryboardCellContentPropsEqual,
  SortableStoryboardCell,
  areSortableStoryboardCellPropsEqual,
  ProfessionalStoryboardGridSection,
  areProfessionalStoryboardGridSectionPropsEqual,
  parseAspectRatio,
  formatAspectRatioCssValue,
  formatCanvasSizeAspectRatioValue,
  buildProfessionalExportCssVariables,
  resizePromptTextarea,
  roundRectPath,
  drawLayoutGuide,
  buildCanvasReferenceImage,
  readSearchParam,
  detectMobilePerformanceMode,
  reorderReferenceImages,
  readLocalValue,
  writeLocalValue,
  sanitizeProfessionalCustomScenarios,
  readStoredProfessionalCustomScenarios,
  buildPersistedProfessionalCustomScenarios,
  formatPersistedAt,
  getRequestTaskTypeLabel,
  getRequestTaskStatusLabel,
  buildRequestTaskMeta,
  buildRequestTaskQueueSummary,
  parseRequestTaskTimeMs,
  isOrphanedPendingRequestTask,
  buildOrphanedRequestTaskPatch,
  buildMissingRecoverableRequestTaskPatch,
  isRequestTaskRecoveryStale,
  buildGalleryDateKey,
  isSameLocalDay,
  isWithinRecentDays,
  isCurrentMonth,
  getFinderFilterDefinitions,
  estimateBase64Size,
  formatBytes,
  getReferenceImageOptimizationSummary,
  buildReferenceUploadFileName,
  ensureClipboardImageFileName,
  getImageFilesFromClipboardData,
  readFileAsDataUrl,
  loadImageElementFromUrl,
  canvasToBlob,
  getScaledDimensions,
  secondsToEstimateMs,
  formatStreamPreviewText,
} = core;

export function buildDownloadName() {
  return buildDownloadNameWithOptions();
}

export function getFileExtensionFromMimeType(mimeType) {
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

export function buildDownloadNameWithOptions({ mimeType = "image/png", suffix = "" } = {}) {
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

export function buildProfessionalSceneArchiveBaseName() {
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

  return `banana-${datePart}-${timePart}-professional-scene`;
}

export function sanitizeExportFileBaseName(value, fallbackValue = "banana-export") {
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

export function buildProfessionalSceneArchiveDownloadName(baseName = buildProfessionalSceneArchiveBaseName()) {
  return `${sanitizeExportFileBaseName(baseName, buildProfessionalSceneArchiveBaseName())}.json`;
}

export function buildProfessionalSceneArchiveZipDownloadName(
  baseName = buildProfessionalSceneArchiveBaseName(),
) {
  return `${sanitizeExportFileBaseName(baseName, buildProfessionalSceneArchiveBaseName())}.zip`;
}

export function buildZipCrc32Table() {
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

export const ZIP_CRC32_TABLE = buildZipCrc32Table();

export function computeZipCrc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = ZIP_CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeBase64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function createStoredZipBlob(entries) {
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
          ? encoder.encode(entry.data)
          : entry?.data instanceof Uint8Array
            ? entry.data
            : null;

      if (!dataBytes) {
        return null;
      }

      return {
        path: normalizedPath,
        pathBytes: encoder.encode(normalizedPath),
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
    const localHeader = new ArrayBuffer(30);
    const localHeaderView = new DataView(localHeader);

    localHeaderView.setUint32(0, 0x04034b50, true);
    localHeaderView.setUint16(4, 20, true);
    localHeaderView.setUint16(6, generalPurposeBitFlag, true);
    localHeaderView.setUint16(8, 0, true);
    localHeaderView.setUint16(10, dosTime, true);
    localHeaderView.setUint16(12, dosDate, true);
    localHeaderView.setUint32(14, crc32, true);
    localHeaderView.setUint32(18, entry.dataBytes.length, true);
    localHeaderView.setUint32(22, entry.dataBytes.length, true);
    localHeaderView.setUint16(26, entry.pathBytes.length, true);
    localHeaderView.setUint16(28, 0, true);

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
    const centralHeader = new ArrayBuffer(46);
    const centralHeaderView = new DataView(centralHeader);

    centralHeaderView.setUint32(0, 0x02014b50, true);
    centralHeaderView.setUint16(4, 20, true);
    centralHeaderView.setUint16(6, 20, true);
    centralHeaderView.setUint16(8, entry.generalPurposeBitFlag, true);
    centralHeaderView.setUint16(10, 0, true);
    centralHeaderView.setUint16(12, entry.dosTime, true);
    centralHeaderView.setUint16(14, entry.dosDate, true);
    centralHeaderView.setUint32(16, entry.crc32, true);
    centralHeaderView.setUint32(20, entry.dataLength, true);
    centralHeaderView.setUint32(24, entry.dataLength, true);
    centralHeaderView.setUint16(28, entry.pathBytes.length, true);
    centralHeaderView.setUint16(30, 0, true);
    centralHeaderView.setUint16(32, 0, true);
    centralHeaderView.setUint16(34, 0, true);
    centralHeaderView.setUint16(36, 0, true);
    centralHeaderView.setUint32(38, 0, true);
    centralHeaderView.setUint32(42, entry.offset, true);

    chunks.push(centralHeader, entry.pathBytes);
    offset += 46 + entry.pathBytes.length;
  });

  const endOfCentralDirectory = new ArrayBuffer(22);
  const endOfCentralDirectoryView = new DataView(endOfCentralDirectory);

  endOfCentralDirectoryView.setUint32(0, 0x06054b50, true);
  endOfCentralDirectoryView.setUint16(4, 0, true);
  endOfCentralDirectoryView.setUint16(6, 0, true);
  endOfCentralDirectoryView.setUint16(8, centralDirectoryEntries.length, true);
  endOfCentralDirectoryView.setUint16(10, centralDirectoryEntries.length, true);
  endOfCentralDirectoryView.setUint32(12, offset - centralDirectoryOffset, true);
  endOfCentralDirectoryView.setUint32(16, centralDirectoryOffset, true);
  endOfCentralDirectoryView.setUint16(20, 0, true);

  chunks.push(endOfCentralDirectory);

  return new Blob(chunks, {
    type: "application/zip",
  });
}

export function buildProfessionalSceneAssetPackage(archive, baseName) {
  const safeBaseName = sanitizeExportFileBaseName(
    baseName,
    buildProfessionalSceneArchiveBaseName(),
  );
  const normalizedArchive = JSON.parse(JSON.stringify(archive || {}));
  const assetEntries = [];
  const extractedAt = new Date().toISOString();

  normalizedArchive.package = {
    format: "zip-with-assets",
    extractedAt,
    assetRoot: "images",
  };

  normalizedArchive.state = normalizedArchive.state || {};
  normalizedArchive.state.referenceImages = Array.isArray(normalizedArchive.state.referenceImages)
    ? normalizedArchive.state.referenceImages.map((image, index) => {
        if (!image?.data || !image?.mimeType) {
          return image;
        }

        const assetPath = `images/reference/reference-${index + 1}.${getFileExtensionFromMimeType(image.mimeType)}`;
        const { data: _data, ...imageWithoutInlineData } = image;

        assetEntries.push({
          path: assetPath,
          data: encodeBase64ToBytes(image.data),
        });

        return {
          ...imageWithoutInlineData,
          assetPath,
        };
      })
    : [];

  normalizedArchive.state.storyboardCells =
    normalizedArchive.state.storyboardCells &&
    typeof normalizedArchive.state.storyboardCells === "object" &&
    !Array.isArray(normalizedArchive.state.storyboardCells)
      ? Object.fromEntries(
          Object.entries(normalizedArchive.state.storyboardCells).map(([cellId, cell]) => {
            const safeCellFolderName = sanitizeExportFileBaseName(cellId, "cell");
            const cellReferenceImages = Array.isArray(cell?.referenceImages)
              ? cell.referenceImages.map((image, index) => {
                  if (!image?.data || !image?.mimeType) {
                    return image;
                  }

                  const assetPath = `images/storyboard/${safeCellFolderName}/reference-${index + 1}.${getFileExtensionFromMimeType(image.mimeType)}`;
                  const { data: _data, ...imageWithoutInlineData } = image;

                  assetEntries.push({
                    path: assetPath,
                    data: encodeBase64ToBytes(image.data),
                  });

                  return {
                    ...imageWithoutInlineData,
                    assetPath,
                  };
                })
              : [];
            const record =
              cell?.record?.imageBase64 && cell?.record?.mimeType
                ? (() => {
                    const assetPath = `images/storyboard/${safeCellFolderName}/result.${getFileExtensionFromMimeType(cell.record.mimeType)}`;
                    const { imageBase64: _imageBase64, ...recordWithoutInlineData } = cell.record;

                    assetEntries.push({
                      path: assetPath,
                      data: encodeBase64ToBytes(cell.record.imageBase64),
                    });

                    return {
                      ...recordWithoutInlineData,
                      assetPath,
                    };
                  })()
                : cell?.record || null;

            return [
              cellId,
              {
                ...cell,
                referenceImages: cellReferenceImages,
                record,
              },
            ];
          }),
        )
      : {};

  const zipEntries = [
    {
      path: `${safeBaseName}/${safeBaseName}.json`,
      data: JSON.stringify(normalizedArchive, null, 2),
    },
    ...assetEntries.map((entry) => ({
      path: `${safeBaseName}/${entry.path}`,
      data: entry.data,
    })),
  ];

  return {
    blob: createStoredZipBlob(zipEntries),
    filename: buildProfessionalSceneArchiveZipDownloadName(safeBaseName),
  };
}

export function ReferenceCard({ image, index, onRemove, isDragging = false }) {
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

export function buildSimpleGenerationPayload({
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

export function buildProfessionalGenerationPayload({
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

export function buildProfessionalReferenceImages(
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

export function buildProfessionalStoryboardPrompt(globalPrompt, cellPrompt) {
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

export function buildProfessionalExportPayload({
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

export function getNextImageSize(currentSize, supportedSizes) {
  const availableSizes = IMAGE_SIZE_OPTIONS
    .map((option) => option.value)
    .filter((value) => supportedSizes.includes(value));
  const currentIndex = availableSizes.indexOf(currentSize);

  if (currentIndex === -1) {
    return availableSizes[0] || "";
  }

  return availableSizes[currentIndex + 1] || "";
}

export function buildPersistedGenerationResultRecord(generationResult) {
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

export function restorePersistedGenerationResultRecord(record) {
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

export function cloneGenerationResultRecord(record) {
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

export function getGeneratedResponseImages(data) {
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

export function buildGeneratedImageRecords(data, extraFields = {}) {
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

export function buildGeneratedImageRecord(data, extraFields = {}) {
  return buildGeneratedImageRecords(data, extraFields)[0] || null;
}

export function buildPersistedStoryboardCells(cells) {
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

export function buildProfessionalSceneArchive({
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

export function resolveProfessionalSceneArchiveState(input) {
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

export function buildPersistedReferenceImage(image) {
  if (!image?.data || !image?.mimeType) {
    return null;
  }

  const { previewUrl: _previewUrl, ...persistedImage } = image;
  return persistedImage;
}

export function restorePersistedReferenceImage(image) {
  if (!image?.data || !image?.mimeType) {
    return null;
  }

  return {
    ...image,
    previewUrl: image.previewUrl || `data:${image.mimeType};base64,${image.data}`,
  };
}

export function restorePersistedStoryboardCells(cells) {
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

export async function readPersistedGenerationLibrary() {
  const persistedRecords = await generationResultStorage.getItem(GENERATION_LIBRARY_RECORDS_KEY);

  if (!Array.isArray(persistedRecords)) {
    return [];
  }

  return persistedRecords
    .map(restorePersistedGenerationResultRecord)
    .filter(Boolean);
}

export async function writePersistedGenerationLibrary(records) {
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

export async function readPersistedStoryboardCells() {
  const persistedCells = await generationResultStorage.getItem(
    PROFESSIONAL_STORYBOARD_CELLS_STORAGE_KEY,
  );

  return restorePersistedStoryboardCells(persistedCells);
}

export async function writePersistedStoryboardCells(cells) {
  const persistedCells = buildPersistedStoryboardCells(cells);
  await generationResultStorage.setItem(PROFESSIONAL_STORYBOARD_CELLS_STORAGE_KEY, persistedCells);
}

export async function readPersistedReferenceImages() {
  const persistedImages = await generationResultStorage.getItem(
    PROFESSIONAL_REFERENCE_IMAGES_STORAGE_KEY,
  );

  if (!Array.isArray(persistedImages)) {
    return [];
  }

  return persistedImages.map(restorePersistedReferenceImage).filter(Boolean);
}

export async function readPersistedSimpleReferenceImages() {
  const persistedImages = await generationResultStorage.getItem(
    SIMPLE_REFERENCE_IMAGES_STORAGE_KEY,
  );

  if (!Array.isArray(persistedImages)) {
    return [];
  }

  return persistedImages.map(restorePersistedReferenceImage).filter(Boolean);
}

export async function writePersistedReferenceImages(images) {
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

export async function writePersistedSimpleReferenceImages(images) {
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

export async function readPersistedCurrentGenerationRecord() {
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

export function ResourceCard({ record, onPreview, onDelete }) {
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

export function FinderSidebarItem({ item, isActive, onSelect }) {
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
