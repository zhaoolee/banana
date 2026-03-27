import { useEffect } from "react";

function ensureDevMetricsStore() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  if (!window.__bananaDevMetrics) {
    window.__bananaDevMetrics = {
      counters: {},
      logs: [],
      tools: {},
      reset() {
        this.counters = {};
        this.logs = [];
      },
      snapshot() {
        return {
          counters: { ...this.counters },
          logs: this.logs.map((entry) => ({ ...entry })),
          tools: this.tools,
        };
      },
    };
  }

  return window.__bananaDevMetrics;
}

export function bumpDevMetric(name, amount = 1) {
  const store = ensureDevMetricsStore();

  if (!store || !name) {
    return 0;
  }

  const nextValue = (store.counters[name] || 0) + amount;
  store.counters[name] = nextValue;
  return nextValue;
}

export function recordDevMetric(name, value) {
  const store = ensureDevMetricsStore();

  if (!store || !name) {
    return value;
  }

  store.counters[name] = value;
  return value;
}

export function appendDevLog(type, detail = {}) {
  const store = ensureDevMetricsStore();

  if (!store || !type) {
    return;
  }

  store.logs.push({
    type,
    detail,
    recordedAt: new Date().toISOString(),
  });

  if (store.logs.length > 200) {
    store.logs.splice(0, store.logs.length - 200);
  }
}

export function exposeDevTool(name, tool) {
  const store = ensureDevMetricsStore();

  if (!store || !name) {
    return;
  }

  if (tool) {
    store.tools[name] = tool;
    return;
  }

  delete store.tools[name];
}

export function resetDevMetrics() {
  const store = ensureDevMetricsStore();
  store?.reset();
}

export function getDevMetricsSnapshot() {
  return ensureDevMetricsStore()?.snapshot() || {
    counters: {},
    logs: [],
    tools: {},
  };
}

export function useDevRenderMetric(name, key = "") {
  useEffect(() => {
    const metricName = key ? `render:${name}:${key}` : `render:${name}`;
    bumpDevMetric(metricName);
    bumpDevMetric(`render:${name}:__total`);
  });
}
