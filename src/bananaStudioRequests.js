import * as constants from "./bananaStudioConstants.js";
import * as core from "./bananaStudioCore.jsx";
import * as persistence from "./bananaStudioPersistence.jsx";

const {
  SSE_CONNECT_TIMEOUT_MS,
  SSE_INACTIVITY_TIMEOUT_MS,
} = constants;

const {
  createPersistedRecordId,
  normalizeTextValue,
  optimizeReferenceImageFile,
  readFileAsDataUrl,
} = core;

const {
  buildDownloadNameWithOptions,
  restorePersistedGenerationResultRecord,
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
