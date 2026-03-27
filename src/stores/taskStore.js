import { create } from "zustand";
import { appendDevLog, bumpDevMetric } from "../devMetrics.js";

const REQUEST_TASKS_STORAGE_KEY = "banana.requestTasks";
const LEGACY_PENDING_GENERATION_REQUEST_STORAGE_KEY = "banana.pendingGenerationRequest";
const MAX_REQUEST_TASKS = 40;

const requestTaskRetryHandlers = new Map();

function normalizeTextValue(value) {
  return typeof value === "string" ? value.trim() : "";
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

export function normalizeRequestTaskStatus(value) {
  const normalizedValue = normalizeTextValue(value);

  if (
    normalizedValue === "queued" ||
    normalizedValue === "accepted" ||
    normalizedValue === "processing" ||
    normalizedValue === "saving" ||
    normalizedValue === "cancelled" ||
    normalizedValue === "succeeded" ||
    normalizedValue === "recovered" ||
    normalizedValue === "failed"
  ) {
    return normalizedValue;
  }

  return "accepted";
}

function resolveRequestTaskStatus(value = {}) {
  const explicitStatus = normalizeTextValue(value?.status);
  const stage = normalizeTextValue(value?.stage);
  const error = normalizeTextValue(value?.error);

  if (explicitStatus === "cancelled" || stage === "cancelled") {
    return "cancelled";
  }

  if (explicitStatus === "failed" || stage === "error" || stage === "stale") {
    return "failed";
  }

  if (explicitStatus === "recovered") {
    return "recovered";
  }

  if (explicitStatus === "succeeded" || stage === "result") {
    return "succeeded";
  }

  if (stage === "queued_google" || stage === "queued_google_rate_limited" || stage === "queued") {
    return "queued";
  }

  if (stage === "accepted") {
    return "accepted";
  }

  if (stage === "saving") {
    return "saving";
  }

  if (
    explicitStatus === "queued" ||
    explicitStatus === "accepted" ||
    explicitStatus === "processing" ||
    explicitStatus === "saving"
  ) {
    return explicitStatus;
  }

  if (error) {
    return "failed";
  }

  return "accepted";
}

export function normalizeRequestTask(value) {
  const requestId = normalizeTextValue(value?.requestId);

  if (!requestId) {
    return null;
  }

  const queuePosition = Number.parseInt(String(value?.queuePosition ?? 0), 10);
  const queueActiveCount = Number.parseInt(String(value?.queueActiveCount ?? 0), 10);
  const queuePendingCount = Number.parseInt(String(value?.queuePendingCount ?? 0), 10);
  const queueConcurrency = Number.parseInt(String(value?.queueConcurrency ?? 0), 10);
  const queueRateLimitWaitMs = Number.parseInt(String(value?.queueRateLimitWaitMs ?? 0), 10);

  return {
    requestId,
    type: normalizeTextValue(value?.type) || "generation",
    mode: normalizeTextValue(value?.mode) || "professional",
    canRetry: value?.canRetry !== false,
    promptSnapshot: normalizeTextValue(value?.promptSnapshot),
    storyboardCellId: normalizeTextValue(value?.storyboardCellId),
    storyboardCellLabel: normalizeTextValue(value?.storyboardCellLabel),
    storyboardCellCoordinate: normalizeTextValue(value?.storyboardCellCoordinate),
    createdAt: normalizeTextValue(value?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeTextValue(value?.updatedAt) || new Date().toISOString(),
    status: resolveRequestTaskStatus(value),
    stage: normalizeTextValue(value?.stage) || "accepted",
    message: normalizeTextValue(value?.message),
    error: normalizeTextValue(value?.error),
    queuePosition: Number.isFinite(queuePosition) ? Math.max(queuePosition, 0) : 0,
    queueActiveCount: Number.isFinite(queueActiveCount) ? Math.max(queueActiveCount, 0) : 0,
    queuePendingCount: Number.isFinite(queuePendingCount) ? Math.max(queuePendingCount, 0) : 0,
    queueConcurrency: Number.isFinite(queueConcurrency) ? Math.max(queueConcurrency, 0) : 0,
    queueRateLimitWaitMs: Number.isFinite(queueRateLimitWaitMs)
      ? Math.max(queueRateLimitWaitMs, 0)
      : 0,
    queueRateLimitedUntil: normalizeTextValue(value?.queueRateLimitedUntil),
  };
}

export function isRequestTaskTerminal(task) {
  return (
    task?.status === "cancelled" ||
    task?.status === "succeeded" ||
    task?.status === "recovered" ||
    task?.status === "failed"
  );
}

export function normalizeRequestTaskProgress(value = {}) {
  return normalizeRequestTask({
    ...value,
    status: resolveRequestTaskStatus({
      ...value,
      status: value?.status || "processing",
    }),
    updatedAt: new Date().toISOString(),
  });
}

function readStoredRequestTasks() {
  const rawValue = readLocalValue(REQUEST_TASKS_STORAGE_KEY);

  if (rawValue) {
    try {
      const parsedValue = JSON.parse(rawValue);
      const normalizedTasks = Array.isArray(parsedValue)
        ? parsedValue.map(normalizeRequestTask).filter(Boolean)
        : [];

      if (normalizedTasks.length > 0) {
        return normalizedTasks.slice(0, MAX_REQUEST_TASKS);
      }
    } catch {
      writeLocalValue(REQUEST_TASKS_STORAGE_KEY, "");
    }
  }

  const legacyValue = readLocalValue(LEGACY_PENDING_GENERATION_REQUEST_STORAGE_KEY);

  if (!legacyValue) {
    return [];
  }

  try {
    const migratedTask = normalizeRequestTask(JSON.parse(legacyValue));

    if (!migratedTask) {
      return [];
    }

    const nextTasks = [migratedTask];
    writeStoredRequestTasks(nextTasks);
    writeLocalValue(LEGACY_PENDING_GENERATION_REQUEST_STORAGE_KEY, "");
    return nextTasks;
  } catch {
    writeLocalValue(LEGACY_PENDING_GENERATION_REQUEST_STORAGE_KEY, "");
    return [];
  }
}

function writeStoredRequestTasks(tasks) {
  const normalizedTasks = (Array.isArray(tasks) ? tasks : [])
    .map(normalizeRequestTask)
    .filter(Boolean)
    .slice(0, MAX_REQUEST_TASKS);

  if (normalizedTasks.length === 0) {
    writeLocalValue(REQUEST_TASKS_STORAGE_KEY, "");
    return [];
  }

  writeLocalValue(REQUEST_TASKS_STORAGE_KEY, JSON.stringify(normalizedTasks));
  return normalizedTasks;
}

export function setRequestTaskRetryHandler(requestId, handler) {
  if (!requestId) {
    return;
  }

  if (typeof handler !== "function") {
    requestTaskRetryHandlers.delete(requestId);
    return;
  }

  requestTaskRetryHandlers.set(requestId, handler);
}

export function getRequestTaskRetryHandler(requestId) {
  return requestId ? requestTaskRetryHandlers.get(requestId) || null : null;
}

export function canRetryRequestTask(task) {
  return task?.status === "failed" && task?.canRetry !== false;
}

export const useTaskStore = create((set) => ({
  requestTasks: readStoredRequestTasks(),
  taskManagerOpen: false,
  retryingRequestTaskIds: {},
  cancellingRequestTaskIds: {},
  setTaskManagerOpen(open) {
    set({ taskManagerOpen: Boolean(open) });
  },
  commitRequestTasks(nextTasksOrUpdater) {
    set((state) => {
      const nextTasks =
        typeof nextTasksOrUpdater === "function"
          ? nextTasksOrUpdater(state.requestTasks)
          : nextTasksOrUpdater;

      const normalizedTasks = (Array.isArray(nextTasks) ? nextTasks : [])
        .map(normalizeRequestTask)
        .filter(Boolean)
        .slice(0, MAX_REQUEST_TASKS);

      return {
        requestTasks: writeStoredRequestTasks(normalizedTasks),
      };
    });
  },
  upsertRequestTask(taskValue) {
    const normalizedTask = normalizeRequestTask(taskValue);

    if (!normalizedTask) {
      return null;
    }

    set((state) => {
      const currentIndex = state.requestTasks.findIndex(
        (task) => task.requestId === normalizedTask.requestId,
      );

      const nextTasks =
        currentIndex === -1
          ? [normalizedTask, ...state.requestTasks]
          : state.requestTasks.map((task, index) =>
              index === currentIndex ? normalizeRequestTask({ ...task, ...normalizedTask }) : task,
            );

      return {
        requestTasks: writeStoredRequestTasks(nextTasks),
      };
    });

    bumpDevMetric("taskStore:upsertRequestTask");
    appendDevLog("taskStore:upsertRequestTask", {
      requestId: normalizedTask.requestId,
      status: normalizedTask.status,
      stage: normalizedTask.stage,
      storyboardCellId: normalizedTask.storyboardCellId,
    });

    return normalizedTask;
  },
  updateRequestTask(requestId, patchValue) {
    if (!requestId) {
      return;
    }

    set((state) => {
      const nextTasks = state.requestTasks.map((task) => {
        if (task.requestId !== requestId) {
          return task;
        }

        const nextPatch =
          typeof patchValue === "function" ? patchValue(task) : patchValue;

        return normalizeRequestTask({
          ...task,
          ...nextPatch,
          updatedAt: new Date().toISOString(),
        });
      });

      return {
        requestTasks: writeStoredRequestTasks(nextTasks),
      };
    });

    bumpDevMetric("taskStore:updateRequestTask");
  },
  startRetryingRequestTask(requestId) {
    if (!requestId) {
      return;
    }

    set((state) => ({
      retryingRequestTaskIds: {
        ...state.retryingRequestTaskIds,
        [requestId]: true,
      },
    }));
  },
  finishRetryingRequestTask(requestId) {
    if (!requestId) {
      return;
    }

    set((state) => {
      const nextRetryingRequestTaskIds = { ...state.retryingRequestTaskIds };
      delete nextRetryingRequestTaskIds[requestId];

      return {
        retryingRequestTaskIds: nextRetryingRequestTaskIds,
      };
    });
  },
  startCancellingRequestTask(requestId) {
    if (!requestId) {
      return;
    }

    set((state) => ({
      cancellingRequestTaskIds: {
        ...state.cancellingRequestTaskIds,
        [requestId]: true,
      },
    }));
  },
  finishCancellingRequestTask(requestId) {
    if (!requestId) {
      return;
    }

    set((state) => {
      const nextCancellingRequestTaskIds = { ...state.cancellingRequestTaskIds };
      delete nextCancellingRequestTaskIds[requestId];

      return {
        cancellingRequestTaskIds: nextCancellingRequestTaskIds,
      };
    });
  },
  clearTerminalRequestTasks() {
    set((state) => {
      const clearedRequestIds = state.requestTasks
        .filter((task) => isRequestTaskTerminal(task))
        .map((task) => task.requestId);

      clearedRequestIds.forEach((requestId) => {
        requestTaskRetryHandlers.delete(requestId);
      });

      const nextTasks = state.requestTasks.filter((task) => !isRequestTaskTerminal(task));

      return {
        requestTasks: writeStoredRequestTasks(nextTasks),
      };
    });
  },
}));
