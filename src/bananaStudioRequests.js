import * as constants from "./bananaStudioConstants.js";
import * as core from "./bananaStudioCore.jsx";
import * as persistence from "./bananaStudioPersistence.jsx";

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

const {
  buildDownloadName,
  getFileExtensionFromMimeType,
  buildDownloadNameWithOptions,
  buildProfessionalSceneArchiveBaseName,
  sanitizeExportFileBaseName,
  buildProfessionalSceneArchiveDownloadName,
  buildProfessionalSceneArchiveZipDownloadName,
  buildZipCrc32Table,
  ZIP_CRC32_TABLE,
  computeZipCrc32,
  encodeBase64ToBytes,
  createStoredZipBlob,
  buildProfessionalSceneAssetPackage,
  ReferenceCard,
  buildSimpleGenerationPayload,
  buildProfessionalGenerationPayload,
  buildProfessionalReferenceImages,
  buildProfessionalStoryboardPrompt,
  buildProfessionalExportPayload,
  getNextImageSize,
  buildPersistedGenerationResultRecord,
  restorePersistedGenerationResultRecord,
  cloneGenerationResultRecord,
  getGeneratedResponseImages,
  buildGeneratedImageRecords,
  buildGeneratedImageRecord,
  buildPersistedStoryboardCells,
  buildProfessionalSceneArchive,
  resolveProfessionalSceneArchiveState,
  buildPersistedReferenceImage,
  restorePersistedReferenceImage,
  restorePersistedStoryboardCells,
  readPersistedGenerationLibrary,
  writePersistedGenerationLibrary,
  readPersistedStoryboardCells,
  writePersistedStoryboardCells,
  readPersistedReferenceImages,
  readPersistedSimpleReferenceImages,
  writePersistedReferenceImages,
  writePersistedSimpleReferenceImages,
  readPersistedCurrentGenerationRecord,
  ResourceCard,
  FinderSidebarItem,
} = persistence;

export function createRequestCancelledError() {
  const error = new Error("任务已取消");
  error.code = "BANANA_TASK_CANCELLED";
  return error;
}

export function isRequestCancelledError(error) {
  return (
    error?.code === "BANANA_TASK_CANCELLED" ||
    normalizeTextValue(error?.message) === "任务已取消" ||
    normalizeTextValue(error?.message) === "请求已取消"
  );
}

export function buildCancelledRequestTaskPatch(message = "任务已取消") {
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

export async function readFileAsReferenceImage(file) {
  return readFileAsImagePayload(file, { optimize: true });
}

export async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsText(file);
  });
}

export async function readFileAsGenerationResultRecord(file) {
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

export function buildPwHeaders(password) {
  const normalizedPassword = normalizeTextValue(password);

  if (!normalizedPassword) {
    return {};
  }

  return {
    "X-Banana-Pw": normalizedPassword,
  };
}

export async function fetchBananaModels(password) {
  const response = await fetch("/api/models", {
    headers: buildPwHeaders(password),
    cache: "no-store",
  });

  return parseJsonResponse(response);
}

export async function verifyPassword(password) {
  const response = await fetch("/api/access/session", {
    headers: buildPwHeaders(password),
    cache: "no-store",
  });

  return parseJsonResponse(response);
}

export async function fetchRecoverableGenerationRequest(password, requestId) {
  const response = await fetch(`/api/generations/${encodeURIComponent(requestId)}`, {
    headers: buildPwHeaders(password),
    cache: "no-store",
  });

  return parseJsonResponse(response);
}

export async function fetchRetryableGenerationRequest(password, requestId) {
  const response = await fetch(`/api/generations/${encodeURIComponent(requestId)}/retry`, {
    method: "POST",
    headers: buildPwHeaders(password),
  });

  return parseJsonResponse(response);
}

export async function fetchCancelableGenerationRequest(password, requestId) {
  const response = await fetch(`/api/generations/${encodeURIComponent(requestId)}/cancel`, {
    method: "POST",
    headers: buildPwHeaders(password),
  });

  return parseJsonResponse(response);
}

export function createSseBufferDrainer(handleSseEvent) {
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

export function subscribeTaskStatusStream(password, requestIds, handlers = {}) {
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

export async function requestSimpleGeneration(password, payload, handlers) {
  try {
    return await requestSseJsonStream(password, "/api/generate/simple/stream", payload, handlers);
  } catch (error) {
    if (error?.status !== 404 && error?.status !== 405) {
      throw error;
    }

    return requestSseJsonStream(password, "/api/generate/stream", payload, handlers);
  }
}

export async function requestProfessionalGeneration(password, payload, handlers) {
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

export async function requestEnhancement(password, payload, handlers) {
  return requestSseJsonStream(password, "/api/enhance/stream", payload, handlers);
}

export function parseResponseFilename(response) {
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

export async function requestProfessionalExportPreview(password, payload) {
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

export async function saveBlobFile(blob, filename) {
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

export function downloadTextFile(filename, text, mimeType = "application/json") {
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
