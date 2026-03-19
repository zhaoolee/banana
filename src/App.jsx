import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

const ACCESS_TOKEN_STORAGE_KEY = "banana.accessToken";
const ACCESS_EXPIRES_STORAGE_KEY = "banana.accessExpiresAt";
const SELECTED_MODEL_STORAGE_KEY = "banana.selectedModelId";
const SELECTED_ASPECT_RATIO_STORAGE_KEY = "banana.selectedAspectRatio";
const SELECTED_LAYOUT_ROWS_STORAGE_KEY = "banana.selectedLayoutRows";
const SELECTED_LAYOUT_COLUMNS_STORAGE_KEY = "banana.selectedLayoutColumns";
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

function normalizeAspectRatioValue(value) {
  return SUPPORTED_ASPECT_RATIO_VALUES.has(value) ? value : "1:1";
}

function getModelAspectRatioOptions(model) {
  const allowedValues = new Set(
    Array.isArray(model?.supportedAspectRatios) && model.supportedAspectRatios.length > 0
      ? model.supportedAspectRatios
      : ASPECT_RATIO_OPTIONS.map((option) => option.value),
  );

  return ASPECT_RATIO_OPTIONS.filter((option) => allowedValues.has(option.value));
}

function clampLayoutTrack(value) {
  const parsedValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return 1;
  }

  return Math.min(Math.max(parsedValue, 1), MAX_LAYOUT_TRACKS);
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

function readSessionValue(key) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(key) || "";
}

function writeSessionValue(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  if (!value) {
    window.sessionStorage.removeItem(key);
    return;
  }

  window.sessionStorage.setItem(key, value);
}

function buildDownloadName() {
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

  return `banana-${datePart}-${timePart}.png`;
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

async function fetchAccessSession(accessToken) {
  const response = await fetch("/api/access/session", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseJsonResponse(response);
}

async function fetchBananaModels(accessToken) {
  const response = await fetch("/api/models", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseJsonResponse(response);
}

async function verifyPassword(password) {
  const response = await fetch("/api/access/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  return parseJsonResponse(response);
}

async function requestGeneration(accessToken, payload) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
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

function App() {
  const [password, setPassword] = useState(() => readSearchParam("pw"));
  const [accessToken, setAccessToken] = useState(() =>
    readSessionValue(ACCESS_TOKEN_STORAGE_KEY),
  );
  const [accessExpiresAt, setAccessExpiresAt] = useState(() =>
    readSessionValue(ACCESS_EXPIRES_STORAGE_KEY),
  );
  const [sessionState, setSessionState] = useState(() =>
    readSessionValue(ACCESS_TOKEN_STORAGE_KEY) ? "checking" : "locked",
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
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState([]);
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [studioError, setStudioError] = useState("");
  const [studioPending, setStudioPending] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [referenceDragActive, setReferenceDragActive] = useState(false);
  const layoutCanvasRef = useRef(null);
  const promptTextareaRef = useRef(null);
  const referenceGridRef = useRef(null);
  const hasLayoutValues = Boolean(selectedAspectRatio && layoutRows > 0 && layoutColumns > 0);

  useEffect(() => {
    if (!accessToken) {
      setSessionState("locked");
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      try {
        const data = await fetchAccessSession(accessToken);

        if (cancelled) {
          return;
        }

        setSessionState("ready");
        setAccessExpiresAt(String(data.expiresAt || ""));
      } catch {
        if (cancelled) {
          return;
        }

        writeSessionValue(ACCESS_TOKEN_STORAGE_KEY, "");
        writeSessionValue(ACCESS_EXPIRES_STORAGE_KEY, "");
        setAccessToken("");
        setAccessExpiresAt("");
        setSessionState("locked");
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (sessionState !== "ready" || !accessToken) {
      return;
    }

    let cancelled = false;

    async function loadModels() {
      try {
        const data = await fetchBananaModels(accessToken);

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
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [accessToken, sessionState]);

  const selectedModel = useMemo(() => {
    return models.find((item) => item.id === selectedModelId) || null;
  }, [models, selectedModelId]);

  const availableAspectRatioOptions = useMemo(() => {
    return getModelAspectRatioOptions(selectedModel);
  }, [selectedModel]);

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
    resizePromptTextarea(promptTextareaRef.current);
  }, [prompt]);

  async function handleVerifySubmit(event) {
    event.preventDefault();
    setAuthPending(true);
    setAuthError("");

    try {
      const data = await verifyPassword(password);
      writeSessionValue(ACCESS_TOKEN_STORAGE_KEY, data.accessToken || "");
      writeSessionValue(ACCESS_EXPIRES_STORAGE_KEY, String(data.expiresAt || ""));
      setAccessToken(data.accessToken || "");
      setAccessExpiresAt(String(data.expiresAt || ""));
      setSessionState("ready");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "提取码校验失败");
      setSessionState("locked");
    } finally {
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

  function handleLogout() {
    writeSessionValue(ACCESS_TOKEN_STORAGE_KEY, "");
    writeSessionValue(ACCESS_EXPIRES_STORAGE_KEY, "");
    setAccessToken("");
    setAccessExpiresAt("");
    setSessionState("locked");
    setGenerationResult(null);
    setStudioError("");
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

    try {
      const payload = {
        modelId: selectedModelId,
        prompt,
        imageOptions: {
          aspectRatio: selectedAspectRatio,
          layoutRows,
          layoutColumns,
        },
        layoutGuideImage: buildCanvasReferenceImage(layoutCanvasRef.current),
        referenceImages: referenceImages.map((image) => ({
          name: image.name,
          mimeType: image.mimeType,
          data: image.data,
        })),
      };

      const data = await requestGeneration(accessToken, payload);
      setGenerationResult({
        ...data,
        downloadName: buildDownloadName(),
        previewUrl: `data:${data.mimeType};base64,${data.imageBase64}`,
      });
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "banana 生图失败");
    } finally {
      setStudioPending(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <div className="page-shell">
        <main className="status-card">
          <p className="eyebrow">BANANA ACCESS</p>
          <h1>正在恢复访问状态</h1>
          <p>如果提取凭证仍有效，会自动进入 banana 工作台。</p>
        </main>
      </div>
    );
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
          <button type="button" className="ghost-button" onClick={handleLogout}>
            退出
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
              <img
                className="result-image"
                src={generationResult.previewUrl}
                alt="Banana generated result"
              />
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

        <section className="studio-panel">

          <form className="prompt-form" onSubmit={handleGenerate}>
            <label className="field-label" htmlFor="prompt">
              文本要求
            </label>
            <textarea
              ref={promptTextareaRef}
              id="prompt"
              name="prompt"
              rows={PROMPT_TEXTAREA_MIN_ROWS}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述你想要的 banana 画面、风格、镜头、材质、色调和构图"
            />

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
              <span>点击或拖拽上传参考图片</span>
              <small>支持多图上传</small>
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

                <div className="layout-control-grid">
                  <label className="image-option-field" htmlFor="layoutRows">
                    <span className="field-label">行数</span>
                    <input
                      id="layoutRows"
                      name="layoutRows"
                      type="number"
                      min="1"
                      max={String(MAX_LAYOUT_TRACKS)}
                      value={layoutRows}
                      onChange={(event) =>
                        setLayoutRows(clampLayoutTrack(event.target.value))
                      }
                    />
                  </label>

                  <label className="image-option-field" htmlFor="layoutColumns">
                    <span className="field-label">列数</span>
                    <input
                      id="layoutColumns"
                      name="layoutColumns"
                      type="number"
                      min="1"
                      max={String(MAX_LAYOUT_TRACKS)}
                      value={layoutColumns}
                      onChange={(event) =>
                        setLayoutColumns(clampLayoutTrack(event.target.value))
                      }
                    />
                  </label>
                </div>
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

            {studioError ? <p className="error-text">{studioError}</p> : null}

            <button
              type="submit"
              className="primary-button"
              disabled={studioPending || !selectedModelId}
            >
              {studioPending ? "banana 正在生图..." : "开始生成"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;
