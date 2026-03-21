import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { GoogleAuth } from "google-auth-library";
import { chromium } from "playwright";
import { getProfessionalExportLayoutMetrics } from "../shared/professionalExportLayout.js";
import {
  DEFAULT_PW_CREDITS,
  addPwCredits,
  buildPwSummary,
  consumePwCredits,
  createPwRecord,
  ensureSeedPwRecord,
  findPwRecord,
  listPwRecords,
  normalizePwName,
  refundPwCredits,
} from "./pwStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const generationsDir = path.join(rootDir, "storage", "generations");
const logsDir = path.join(rootDir, "storage", "logs");
const pwStoreFilePath = path.join(rootDir, "storage", "pw-store.json");
const port = Number(process.env.PORT || 23001);
const ALL_SUPPORTED_ASPECT_RATIOS = [
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
const SUPPORTED_ASPECT_RATIOS = new Set(ALL_SUPPORTED_ASPECT_RATIOS);
const SUPPORTED_IMAGE_SIZES = new Set(["1K", "2K", "4K"]);
const STANDARD_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const MAX_LAYOUT_TRACKS = 8;
const MAX_IMAGE_COUNT = 4;
const GOOGLE_CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const BANANA_MODELS = [
  {
    id: "nano-banana",
    name: "Gemini 2.5 Flash Image",
    tone: "官方 Nano Banana / Gemini 2.5 Flash Image",
    description: "价格最低，适合通用图像生成与基础编辑。",
    priceLabel: "$0.039/张",
    priceNote: "标准 1K 参考价",
    providerModel:
      process.env.GEMINI_MODEL_NANO_BANANA?.trim() || "gemini-2.5-flash-image",
    promptBooster:
      "Use the capabilities of Gemini 2.5 Flash Image for versatile image generation and editing with solid prompt adherence.",
    supportedAspectRatios: STANDARD_ASPECT_RATIOS,
    supportedImageSizes: ["1K"],
    supportsImageSizeParam: false,
  },
  {
    id: "nano-banana-2",
    name: "Gemini 3.1 Flash Image Preview",
    tone: "官方 Nano Banana 2 / Gemini 3.1 Flash Image",
    description: "当前默认推荐，速度、质量和能力更均衡。",
    priceLabel: "$0.067/张",
    priceNote: "支持 1K / 2K / 4K",
    providerModel:
      process.env.GEMINI_MODEL_NANO_BANANA_2?.trim() ||
      process.env.GEMINI_IMAGE_MODEL?.trim() ||
      "gemini-3.1-flash-image-preview",
    promptBooster:
      "Use the latest Gemini 3.1 Flash Image generation and editing behavior for fast, strong all-around image output.",
    supportedAspectRatios: ALL_SUPPORTED_ASPECT_RATIOS,
    supportedImageSizes: ["1K", "2K", "4K"],
    supportsImageSizeParam: true,
  },
  {
    id: "nano-banana-pro",
    name: "Gemini 3 Pro Image Preview",
    tone: "官方 Nano Banana Pro / Gemini 3 Pro Image",
    description: "价格最高，适合复杂场景、高精度控制和更强文字遵循。",
    priceLabel: "$0.134/张起",
    priceNote: "支持 1K / 2K / 4K",
    providerModel:
      process.env.GEMINI_MODEL_NANO_BANANA_PRO?.trim() ||
      "gemini-3-pro-image-preview",
    promptBooster:
      "Use the advanced reasoning and precision of Gemini 3 Pro Image to maximize control, detail, and prompt fidelity.",
    supportedAspectRatios: STANDARD_ASPECT_RATIOS,
    supportedImageSizes: ["1K", "2K", "4K"],
    supportsImageSizeParam: true,
  },
];

let googleAuthClientPromise = null;
let googleAdcMetadataPromise = null;
let browserPromise = null;

function getAccessPassword() {
  return (process.env.ACCESS_PASSWORD || "").trim();
}

function getAdminTokenTtlMs() {
  const minutes = Number(process.env.ADMIN_TOKEN_TTL_MINUTES || 720);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 12 * 60 * 60 * 1000;
}

function getAdminUsername() {
  return (process.env.ADMIN_USERNAME || "").trim();
}

function getAdminPassword() {
  return (process.env.ADMIN_PASSWORD || "").trim();
}

function isAdminConfigured() {
  return Boolean(getAdminUsername() && getAdminPassword());
}

function getSigningSecret() {
  return (process.env.ACCESS_TOKEN_SECRET || `${getAccessPassword()}:banana-studio`).trim();
}

function encodeBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signValue(value) {
  return crypto.createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function createSignedToken(payload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.exp,
  };
}

function verifySignedToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".", 2);
  const expectedSignature = signValue(encodedPayload);

  if (!signature || signature.length !== expectedSignature.length) {
    return null;
  }

  if (
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));

    if (!payload?.exp || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function createAdminToken() {
  return createSignedToken({
    type: "admin",
    username: getAdminUsername(),
    exp: Date.now() + getAdminTokenTtlMs(),
  });
}

function verifyAdminToken(token) {
  const payload = verifySignedToken(token);

  if (!payload || payload.type !== "admin" || typeof payload.username !== "string") {
    return null;
  }

  return payload;
}

function safeEqualStrings(leftValue, rightValue) {
  const provided = Buffer.from(String(leftValue || ""));
  const expected = Buffer.from(String(rightValue || ""));

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

function getAccessTokenFromRequest(request) {
  const authorization = request.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function getPwFromRequest(request) {
  return normalizePrompt(
    request.get("x-banana-pw") || request.get("x-banana-password") || "",
  );
}

async function ensureAuthenticated(request, response, next) {
  const directPw = getPwFromRequest(request);

  if (!directPw) {
    response.status(401).json({
      error: "缺少 x-banana-pw 请求头，请重新输入提取码",
    });
    return;
  }

  let pwName = "";

  try {
    pwName = normalizePwName(directPw);
  } catch (error) {
    response.status(401).json({
      error: error instanceof Error ? error.message : "提取码格式不正确",
    });
    return;
  }

  const pwRecord = await findPwRecord({
    filePath: pwStoreFilePath,
    name: pwName,
  });

  if (!pwRecord) {
    response.status(401).json({
      error: "提取码已失效或不存在，请联系管理员",
    });
    return;
  }

  request.accessPayload = {
    type: "header-pw",
    pwName: pwRecord.name,
  };
  request.pwRecord = pwRecord;
  next();
}

function ensureAdminAuthenticated(request, response, next) {
  const payload = verifyAdminToken(getAccessTokenFromRequest(request));

  if (!payload) {
    response.status(401).json({
      error: "管理员会话无效或已过期，请重新登录",
    });
    return;
  }

  request.adminPayload = payload;
  next();
}

function normalizePrompt(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeReferenceImages(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.slice(0, 12).map((image, index) => {
    const mimeType = typeof image?.mimeType === "string" ? image.mimeType.trim() : "";
    const data = typeof image?.data === "string" ? image.data.trim() : "";
    const name = typeof image?.name === "string" ? image.name.trim() : `reference-${index + 1}`;

    if (!mimeType.startsWith("image/")) {
      throw new Error(`第 ${index + 1} 张参考图格式不正确`);
    }

    if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
      throw new Error(`第 ${index + 1} 张参考图内容无效`);
    }

    const estimatedBytes = Math.ceil((data.length * 3) / 4);

    if (estimatedBytes > 8 * 1024 * 1024) {
      throw new Error(`第 ${index + 1} 张参考图过大，请控制在 8MB 以内`);
    }

    return { mimeType, data, name };
  });
}

function sanitizeSourceImage(input) {
  const [sourceImage] = sanitizeReferenceImages(input ? [input] : []);
  return sourceImage || null;
}

function sanitizeLayoutGuideImage(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const mimeType = typeof input?.mimeType === "string" ? input.mimeType.trim() : "";
  const data = typeof input?.data === "string" ? input.data.trim() : "";
  const name = typeof input?.name === "string" ? input.name.trim() : "layout-guide.png";

  if (!mimeType.startsWith("image/")) {
    throw new Error("布局参考图格式不正确");
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
    throw new Error("布局参考图内容无效");
  }

  return { mimeType, data, name };
}

function sanitizeGeneratePayload(input, mode = "professional") {
  const prompt = normalizePrompt(input?.prompt);
  const bananaModel = resolveBananaModel(input?.modelId);

  if (mode === "simple") {
    const imageOptions = sanitizeImageOptions(
      {
        aspectRatio: input?.imageOptions?.aspectRatio,
        imageSize: input?.imageOptions?.imageSize,
        imageCount: input?.imageOptions?.imageCount,
        layoutRows: 1,
        layoutColumns: 1,
      },
      bananaModel,
    );

    return {
      prompt,
      bananaModel,
      referenceImages: [],
      layoutGuideImage: null,
      imageOptions,
    };
  }

  return {
    prompt,
    bananaModel,
    referenceImages: sanitizeReferenceImages(input?.referenceImages),
    layoutGuideImage: sanitizeLayoutGuideImage(input?.layoutGuideImage),
    imageOptions: sanitizeImageOptions(input?.imageOptions, bananaModel),
  };
}

function resolveBananaModel(modelId) {
  return BANANA_MODELS.find((item) => item.id === modelId) || BANANA_MODELS[0];
}

function normalizeGoogleAuthMode(value) {
  const normalizedValue = normalizePrompt(value).toLowerCase();

  if (
    !normalizedValue ||
    normalizedValue === "api" ||
    normalizedValue === "api-key" ||
    normalizedValue === "apikey"
  ) {
    return "api-key";
  }

  if (
    normalizedValue === "vertex" ||
    normalizedValue === "vertex-ai" ||
    normalizedValue === "vertex-adc" ||
    normalizedValue === "vertexadc" ||
    normalizedValue === "adc" ||
    normalizedValue === "application-default" ||
    normalizedValue === "application-default-credentials"
  ) {
    return "vertex-adc";
  }

  throw new Error(`不支持的 GEMINI_AUTH_MODE: ${value}`);
}

function getGoogleGenerationAuthMode() {
  return normalizeGoogleAuthMode(process.env.GEMINI_AUTH_MODE || process.env.GOOGLE_AUTH_MODE || "");
}

function getGoogleCloudProject() {
  return normalizePrompt(
    process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      "",
  );
}

function getGoogleCloudLocation() {
  return normalizePrompt(process.env.GOOGLE_CLOUD_LOCATION || "global") || "global";
}

function getGoogleCloudQuotaProject() {
  return normalizePrompt(
    process.env.GOOGLE_CLOUD_QUOTA_PROJECT ||
      process.env.GOOGLE_QUOTA_PROJECT ||
      getGoogleCloudProject(),
  );
}

function getConfiguredGoogleCredentialsPath() {
  return normalizePrompt(process.env.GOOGLE_APPLICATION_CREDENTIALS || "");
}

function getDefaultGoogleCloudSdkConfigDir() {
  const configuredDir = normalizePrompt(process.env.CLOUDSDK_CONFIG || "");
  return configuredDir || path.join(os.homedir(), ".config", "gcloud");
}

function getGoogleAdcCandidatePaths() {
  const configuredPath = getConfiguredGoogleCredentialsPath();
  const defaultCloudSdkAdcPath = path.join(
    getDefaultGoogleCloudSdkConfigDir(),
    "application_default_credentials.json",
  );

  return [...new Set([
    configuredPath,
    "/app/.config/gcloud/application_default_credentials.json",
    defaultCloudSdkAdcPath,
  ].filter(Boolean))];
}

async function getGoogleAdcMetadata() {
  if (!googleAdcMetadataPromise) {
    googleAdcMetadataPromise = (async () => {
      const configuredPath = getConfiguredGoogleCredentialsPath();
      const candidatePaths = getGoogleAdcCandidatePaths();

      for (const credentialsPath of candidatePaths) {
        try {
          const raw = await fs.readFile(credentialsPath, "utf8");
          const parsed = JSON.parse(raw);

          return {
            path: credentialsPath,
            type: normalizePrompt(parsed?.type),
            quotaProjectId: normalizePrompt(parsed?.quota_project_id),
            clientEmail: normalizePrompt(parsed?.client_email),
          };
        } catch (error) {
          if (error?.code === "ENOENT") {
            continue;
          }

          throw error;
        }
      }

      return {
        path: configuredPath || "",
        type: "",
        quotaProjectId: "",
        clientEmail: "",
      };
    })().catch((error) => {
      googleAdcMetadataPromise = null;
      throw error;
    });
  }

  return googleAdcMetadataPromise;
}

async function resolveGoogleCloudProject() {
  const configuredProject = getGoogleCloudProject();

  if (configuredProject) {
    return configuredProject;
  }

  const adcMetadata = await getGoogleAdcMetadata();
  return adcMetadata.quotaProjectId || "";
}

async function resolveGoogleCloudQuotaProject() {
  const configuredQuotaProject = getGoogleCloudQuotaProject();

  if (configuredQuotaProject) {
    return configuredQuotaProject;
  }

  const adcMetadata = await getGoogleAdcMetadata();
  return adcMetadata.quotaProjectId || (await resolveGoogleCloudProject());
}

async function getResolvedGoogleBackendSummary() {
  const authMode = getGoogleGenerationAuthMode();

  if (authMode === "api-key") {
    return {
      authMode,
      backend: "gemini-api",
      project: null,
      quotaProject: null,
      location: null,
      credentialsPath: null,
    };
  }

  const adcMetadata = await getGoogleAdcMetadata();
  const project = (await resolveGoogleCloudProject()) || null;
  const quotaProject = (await resolveGoogleCloudQuotaProject()) || null;

  return {
    authMode,
    backend: "vertex-ai",
    project,
    quotaProject,
    location: getGoogleCloudLocation(),
    credentialsPath: adcMetadata.path || getConfiguredGoogleCredentialsPath() || null,
  };
}

async function getPublicGoogleBackendSummary() {
  const summary = await getResolvedGoogleBackendSummary();

  return {
    authMode: summary.authMode,
    backend: summary.backend,
    location: summary.location,
    projectConfigured: Boolean(summary.project),
    quotaProjectConfigured: Boolean(summary.quotaProject),
    credentialsConfigured: Boolean(summary.credentialsPath),
  };
}

function getVertexApiHost(location) {
  return location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
}

async function getGoogleAuthClient() {
  if (!googleAuthClientPromise) {
    const auth = new GoogleAuth({
      scopes: [GOOGLE_CLOUD_PLATFORM_SCOPE],
    });

    googleAuthClientPromise = auth.getClient().catch((error) => {
      googleAuthClientPromise = null;
      throw error;
    });
  }

  return googleAuthClientPromise;
}

async function buildGoogleRequestConfig(providerModel) {
  const authMode = getGoogleGenerationAuthMode();

  if (authMode === "api-key") {
    const apiKey = normalizePrompt(process.env.GEMINI_API_KEY);

    if (!apiKey) {
      throw new Error("缺少 GEMINI_API_KEY，请先在 .env 中配置，或切换到 GEMINI_AUTH_MODE=vertex-adc");
    }

    return {
      authMode,
      backend: "gemini-api",
      project: null,
      location: null,
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${providerModel}:streamGenerateContent?alt=sse`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      targetLabel: `Google Gemini API · ${providerModel}`,
    };
  }

  const project = await resolveGoogleCloudProject();
  const location = getGoogleCloudLocation();

  if (!project) {
    throw new Error("缺少 GOOGLE_CLOUD_PROJECT；如果使用 Docker 挂载 ADC，请确认 application_default_credentials.json 里包含 quota_project_id");
  }

  const endpoint = `https://${getVertexApiHost(location)}/v1/projects/${project}/locations/${location}/publishers/google/models/${providerModel}:streamGenerateContent?alt=sse`;
  const authClient = await getGoogleAuthClient();
  const accessTokenResponse = await authClient.getAccessToken();
  const accessToken =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse?.token || "";

  if (!accessToken) {
    throw new Error("无法从 ADC 获取 Google 访问令牌，请重新执行 gcloud auth application-default login");
  }

  const quotaProject = await resolveGoogleCloudQuotaProject();

  return {
    authMode,
    backend: "vertex-ai",
    project,
    location,
    endpoint,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(quotaProject ? { "x-goog-user-project": quotaProject } : {}),
    },
    targetLabel: `Vertex AI · ${project}/${location} · ${providerModel}`,
  };
}

function tryParseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const RETRYABLE_GOOGLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleepWithSignal(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function cleanup() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
    }

    function handleAbort() {
      cleanup();
      reject(signal.reason instanceof Error ? signal.reason : new Error("请求已取消"));
    }

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }

      signal.addEventListener("abort", handleAbort, { once: true });
    }
  });
}

function buildGoogleApiErrorMessage({ status, apiMessage, backend }) {
  if (status === 429 && backend === "vertex-ai") {
    return "Vertex AI 当前配额或瞬时容量不足（429 Resource exhausted）。请稍后重试，或先把生成张数降到 1。";
  }

  if (status === 429) {
    return "Google 图像生成接口当前限流（429）。请稍后重试，或先把生成张数降到 1。";
  }

  return apiMessage || "Gemini 图像生成请求失败";
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function buildGenerationId() {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join("-");

  return `${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
}

function buildRequestId() {
  return crypto.randomBytes(6).toString("hex");
}

function getLogDateStamp(date = new Date()) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

function getLogFilePath(date = new Date()) {
  return path.join(logsDir, `backend-${getLogDateStamp(date)}.log`);
}

function summarizeForLog(value, seen = new WeakSet()) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => summarizeForLog(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);
    const entries = Object.entries(value).slice(0, 40).map(([key, entryValue]) => [
      key,
      summarizeForLog(entryValue, seen),
    ]);
    return Object.fromEntries(entries);
  }

  return String(value);
}

async function appendBackendLog(level, message, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    meta: summarizeForLog(meta),
  });

  await fs.mkdir(logsDir, { recursive: true });
  await fs.appendFile(getLogFilePath(), `${entry}\n`, "utf8");
}

async function logBackend(level, message, meta = {}) {
  const consoleMethod = level === "error" ? console.error : console.log;
  consoleMethod(`[backend:${level}] ${message}`, meta);

  try {
    await appendBackendLog(level, message, meta);
  } catch (logError) {
    console.error("[backend:error] Failed to write log entry", logError);
  }
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

async function saveGenerationArtifacts({
  bananaModel,
  imageOptions,
  userPrompt,
  geminiPrompt,
  modelOutputText,
  resultImageBase64,
  resultMimeType,
  requestId,
  resultImageIndex = 0,
  resultImageCount = 1,
}) {
  const generationId = buildGenerationId();
  const generationPath = path.join(generationsDir, generationId);
  const imageExtension = getFileExtensionFromMimeType(resultMimeType);
  const imageFilename = `result.${imageExtension}`;
  const imagePath = path.join(generationPath, imageFilename);
  const metadataPath = path.join(generationPath, "metadata.json");
  const userPromptPath = path.join(generationPath, "user-prompt.txt");
  const inputPromptPath = path.join(generationPath, "gemini-prompt.txt");
  const outputPromptPath = path.join(generationPath, "output-prompt.txt");

  await fs.mkdir(generationPath, { recursive: true });
  await fs.writeFile(imagePath, Buffer.from(resultImageBase64, "base64"));
  await fs.writeFile(userPromptPath, `${userPrompt}\n`, "utf8");
  await fs.writeFile(inputPromptPath, `${geminiPrompt}\n`, "utf8");
  await fs.writeFile(outputPromptPath, `${modelOutputText || ""}\n`, "utf8");
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        id: generationId,
        createdAt: new Date().toISOString(),
        requestId: requestId || "",
        bananaModel: {
          id: bananaModel.id,
          name: bananaModel.name,
          tone: bananaModel.tone,
          providerModel: bananaModel.providerModel,
          priceLabel: bananaModel.priceLabel,
          priceNote: bananaModel.priceNote,
        },
        imageOptions,
        imagePosition: {
          index: resultImageIndex,
          count: resultImageCount,
        },
        userPrompt,
        geminiPrompt,
        modelOutputText: modelOutputText || "",
        image: {
          filename: imageFilename,
          mimeType: resultMimeType,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    id: generationId,
    directory: generationPath,
    imagePath,
    metadataPath,
  };
}

async function saveGenerationArtifactsBatch({
  bananaModel,
  imageOptions,
  userPrompt,
  geminiPrompt,
  modelOutputText,
  resultImages,
  requestId,
}) {
  return Promise.all(
    resultImages.map((image, index) =>
      saveGenerationArtifacts({
        bananaModel,
        imageOptions,
        userPrompt,
        geminiPrompt,
        modelOutputText,
        resultImageBase64: image.imageBase64,
        resultMimeType: image.mimeType,
        requestId,
        resultImageIndex: index,
        resultImageCount: resultImages.length,
      }),
    ),
  );
}

function sanitizeImageOptions(input, bananaModel) {
  const allowedAspectRatios = Array.isArray(bananaModel?.supportedAspectRatios) && bananaModel.supportedAspectRatios.length > 0
    ? bananaModel.supportedAspectRatios
    : STANDARD_ASPECT_RATIOS;
  const allowedAspectRatioSet = new Set(allowedAspectRatios.filter((value) => SUPPORTED_ASPECT_RATIOS.has(value)));
  const fallbackAspectRatio = allowedAspectRatios[0] || "1:1";
  const aspectRatio =
    typeof input?.aspectRatio === "string" && allowedAspectRatioSet.has(input.aspectRatio)
      ? input.aspectRatio
      : fallbackAspectRatio;

  const layoutRows = Math.min(
    Math.max(Number.parseInt(String(input?.layoutRows || "1"), 10) || 1, 1),
    MAX_LAYOUT_TRACKS,
  );
  const layoutColumns = Math.min(
    Math.max(Number.parseInt(String(input?.layoutColumns || "1"), 10) || 1, 1),
    MAX_LAYOUT_TRACKS,
  );
  const allowedImageSizes = Array.isArray(bananaModel?.supportedImageSizes) && bananaModel.supportedImageSizes.length > 0
    ? bananaModel.supportedImageSizes.filter((value) => SUPPORTED_IMAGE_SIZES.has(value))
    : ["1K"];
  const fallbackImageSize = allowedImageSizes[0] || "1K";
  const imageSize =
    typeof input?.imageSize === "string" && allowedImageSizes.includes(input.imageSize)
      ? input.imageSize
      : fallbackImageSize;
  const imageCount = Math.min(
    Math.max(Number.parseInt(String(input?.imageCount || "1"), 10) || 1, 1),
    MAX_IMAGE_COUNT,
  );

  return {
    aspectRatio,
    layoutRows,
    layoutColumns,
    imageSize,
    imageCount,
  };
}

function buildGeminiPrompt({
  bananaModel,
  prompt,
  referenceImages,
  imageOptions,
  hasLayoutGuideImage,
  additionalInstructions = [],
}) {
  const referenceHint =
    referenceImages.length > 0
      ? `Use the uploaded reference images as visual guidance. Preserve important subject cues when it helps the request. The reference images are numbered in upload order. If the user mentions 图1, 图2, 1号图, 2号图, #1, or #2, map those references to the matching numbered image.`
      : prompt
        ? "No reference images were supplied, so compose the scene from the text request alone."
        : "No reference images were supplied.";
  const layoutGuideHint = hasLayoutGuideImage
    ? "A dedicated layout guide image is provided. Treat it as structural composition guidance for panel arrangement, not as a style reference."
    : "No separate layout guide image is provided.";
  const totalPanels = imageOptions.layoutRows * imageOptions.layoutColumns;
  const layoutRule =
    totalPanels > 1
      ? `Create exactly ${totalPanels} panels arranged in ${imageOptions.layoutRows} horizontal rows and ${imageOptions.layoutColumns} vertical columns. Rows run top-to-bottom. Columns run left-to-right. Do not transpose, rotate, or swap rows and columns.`
      : "Create a single-panel composition.";
  const imageCountRule =
    imageOptions.imageCount > 1
      ? `Return exactly ${imageOptions.imageCount} distinct final images as separate image outputs in a single response. Never merge multiple requested outputs into one contact sheet, one collage, one grid, one tiled image, or one composite canvas unless the user explicitly asks for that. Each returned image must independently satisfy the request.`
      : "Return exactly 1 final image.";
  const layoutCleanRule =
    totalPanels > 1
      ? "The final image must not reproduce any guide template, UI mockup, placeholder card, numbered box, row label, column label, beige planning canvas, or thick outer frame. Use the requested grid only as composition structure for the actual artwork."
      : "Do not add template frames, guide labels, placeholder cards, or planning overlays unless the user explicitly asks for them.";
  const userRequestRule = prompt
    ? `User request: ${prompt}`
    : referenceImages.length > 0
      ? "No explicit text request was provided. Infer the image intent from the uploaded reference images and the selected output settings."
      : "No explicit text request or reference images were provided. Create a polished, high-quality image that fits the selected output settings.";

  return [
    "You are Banana Studio, an image generation assistant.",
    "Return strong final image output that follows the request precisely.",
    bananaModel.promptBooster,
    referenceHint,
    layoutGuideHint,
    `Preferred aspect ratio: ${imageOptions.aspectRatio}.`,
    `Preferred output resolution: ${imageOptions.imageSize}.`,
    `Requested output count: ${imageOptions.imageCount}.`,
    `Preferred layout grid: ${imageOptions.layoutRows} rows by ${imageOptions.layoutColumns} columns.`,
    imageCountRule,
    layoutRule,
    layoutCleanRule,
    "When composing collages, panels, or multi-scene layouts, respect the requested grid structure exactly.",
    "Prefer coherent composition, clear focal subject, refined lighting, and high visual quality.",
    ...additionalInstructions,
    userRequestRule,
  ].join("\n");
}

function writeSseEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

const SSE_HEARTBEAT_INTERVAL_MS = 25 * 1000;

function startSseHeartbeat(response, getPayload) {
  return setInterval(() => {
    if (response.writableEnded || response.destroyed) {
      return;
    }

    writeSseEvent(response, "status", {
      stage: "heartbeat",
      ...(typeof getPayload === "function" ? getPayload() : {}),
    });
  }, SSE_HEARTBEAT_INTERVAL_MS);
}

async function parseSseResponseStream(stream, onMessage) {
  const decoder = new TextDecoder();
  let buffer = "";
  let eventCount = 0;

  function drainBuffer(flush = false) {
    let normalizedBuffer = buffer.replace(/\r\n/g, "\n");

    while (normalizedBuffer.includes("\n\n")) {
      const boundaryIndex = normalizedBuffer.indexOf("\n\n");
      const rawEvent = normalizedBuffer.slice(0, boundaryIndex);
      normalizedBuffer = normalizedBuffer.slice(boundaryIndex + 2);

      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) {
        continue;
      }

      const dataText = dataLines.join("\n");

      if (dataText === "[DONE]") {
        continue;
      }

      eventCount += 1;
      onMessage(JSON.parse(dataText));
    }

    if (flush && normalizedBuffer.trim()) {
      const dataLines = normalizedBuffer
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length > 0) {
        const dataText = dataLines.join("\n");

        if (dataText !== "[DONE]") {
          eventCount += 1;
          onMessage(JSON.parse(dataText));
        }
      }

      normalizedBuffer = "";
    }

    buffer = normalizedBuffer;
  }

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    drainBuffer();
  }

  buffer += decoder.decode();
  drainBuffer(true);

  return eventCount;
}

async function generateImageWithGemini({
  requestId,
  requestType,
  bananaModel,
  prompt,
  referenceImages,
  imageOptions,
  layoutGuideImage,
  additionalInstructions = [],
  onEvent,
  signal,
}) {
  const providerModel = bananaModel.providerModel;
  const googleRequestConfig = await buildGoogleRequestConfig(providerModel);
  const geminiPrompt = buildGeminiPrompt({
    bananaModel,
    prompt,
    referenceImages,
    imageOptions,
    hasLayoutGuideImage: Boolean(layoutGuideImage),
    additionalInstructions,
  });
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: geminiPrompt,
          },
          ...(layoutGuideImage
            ? [
                {
                  text: `Layout guide image. Follow this guide exactly. ${imageOptions.layoutRows} rows means ${imageOptions.layoutRows} stacked horizontal bands from top to bottom. ${imageOptions.layoutColumns} columns means ${imageOptions.layoutColumns} vertical slices from left to right. Never swap rows and columns.`,
                },
                {
                  inlineData: {
                    mimeType: layoutGuideImage.mimeType,
                    data: layoutGuideImage.data,
                  },
                },
              ]
            : []),
          ...referenceImages.flatMap((image, index) => [
            {
              text: `Reference image #${index + 1}. Uploaded filename: ${image.name}.`,
            },
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.data,
              },
            },
          ]),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: imageOptions.aspectRatio,
        ...(bananaModel.supportsImageSizeParam
          ? { imageSize: imageOptions.imageSize }
          : {}),
      },
    },
  };

  onEvent?.({
    type: "status",
    stage: "requesting_google",
    message: `已发送到 ${googleRequestConfig.targetLabel}`,
  });

  await logBackend("info", "Sending request to Google", {
    requestId,
    requestType,
    providerModel,
    googleAuthMode: googleRequestConfig.authMode,
    googleBackend: googleRequestConfig.backend,
    googleCloudProject: googleRequestConfig.project,
    googleCloudLocation: googleRequestConfig.location,
    bananaModelId: bananaModel.id,
    imageOptions,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 160),
    referenceImageCount: referenceImages.length,
    hasLayoutGuideImage: Boolean(layoutGuideImage),
  });
  const maxAttempts = googleRequestConfig.backend === "vertex-ai" ? 3 : 2;
  let geminiResponse = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    geminiResponse = await fetch(googleRequestConfig.endpoint, {
      method: "POST",
      headers: googleRequestConfig.headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    if (geminiResponse.ok) {
      break;
    }

    const responseText = await geminiResponse.text();
    const payload = tryParseJson(responseText) || {};
    const apiMessage =
      payload?.error?.message ||
      payload?.message ||
      responseText ||
      "Gemini 图像生成请求失败";
    const isRetryable = RETRYABLE_GOOGLE_STATUS_CODES.has(geminiResponse.status);
    const attemptsRemaining = maxAttempts - attempt;

    if (isRetryable && attemptsRemaining > 0) {
      const retryDelayMs = Math.min(8000, 1200 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 350);

      await logBackend("info", "Retrying Google request after transient failure", {
        requestId,
        requestType,
        providerModel,
        googleAuthMode: googleRequestConfig.authMode,
        googleBackend: googleRequestConfig.backend,
        googleCloudProject: googleRequestConfig.project,
        googleCloudLocation: googleRequestConfig.location,
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        apiMessage,
        attempt,
        attemptsRemaining,
        retryDelayMs,
      });

      onEvent?.({
        type: "status",
        stage: "retrying_google",
        message:
          geminiResponse.status === 429
            ? `Google 当前限流，${Math.ceil(retryDelayMs / 1000)} 秒后自动重试...`
            : `Google 请求暂时失败，${Math.ceil(retryDelayMs / 1000)} 秒后自动重试...`,
      });

      await sleepWithSignal(retryDelayMs, signal);
      continue;
    }

    await logBackend("error", "Google request failed", {
      requestId,
      requestType,
      providerModel,
      googleAuthMode: googleRequestConfig.authMode,
      googleBackend: googleRequestConfig.backend,
      googleCloudProject: googleRequestConfig.project,
      googleCloudLocation: googleRequestConfig.location,
      status: geminiResponse.status,
      statusText: geminiResponse.statusText,
      apiMessage,
      payload,
      attempt,
    });
    throw new Error(
      buildGoogleApiErrorMessage({
        status: geminiResponse.status,
        apiMessage,
        backend: googleRequestConfig.backend,
      }),
    );
  }

  if (!geminiResponse?.ok) {
    throw new Error("Gemini 图像生成请求失败");
  }

  if (!geminiResponse.body) {
    await logBackend("error", "Google response body missing", {
      requestId,
      requestType,
      providerModel,
      googleAuthMode: googleRequestConfig.authMode,
      googleBackend: googleRequestConfig.backend,
      googleCloudProject: googleRequestConfig.project,
      googleCloudLocation: googleRequestConfig.location,
    });
    throw new Error("Gemini 流式响应不可用");
  }

  await logBackend("info", "Google stream opened", {
    requestId,
    requestType,
    providerModel,
    googleAuthMode: googleRequestConfig.authMode,
    googleBackend: googleRequestConfig.backend,
    googleCloudProject: googleRequestConfig.project,
    googleCloudLocation: googleRequestConfig.location,
    status: geminiResponse.status,
  });

  const summarizeSafetyRatings = (safetyRatings) =>
    Array.isArray(safetyRatings)
      ? safetyRatings.map((rating) => ({
          category: rating?.category || null,
          probability: rating?.probability || null,
          blocked:
            typeof rating?.blocked === "boolean" ? rating.blocked : null,
          severity: rating?.severity || null,
        }))
      : [];

  const summarizePromptFeedback = (promptFeedback) => {
    if (!promptFeedback || typeof promptFeedback !== "object") {
      return null;
    }

    return {
      blockReason: promptFeedback?.blockReason || null,
      blockReasonMessage: promptFeedback?.blockReasonMessage || null,
      safetyRatings: summarizeSafetyRatings(promptFeedback?.safetyRatings),
    };
  };

  const summarizeCandidates = (candidates) =>
    Array.isArray(candidates)
      ? candidates.map((candidate, index) => ({
          index,
          finishReason: candidate?.finishReason || null,
          finishMessage: candidate?.finishMessage || null,
          tokenCount:
            typeof candidate?.tokenCount === "number" ? candidate.tokenCount : null,
          safetyRatings: summarizeSafetyRatings(candidate?.safetyRatings),
        }))
      : [];

  const imageParts = [];
  const textParts = [];
  let latestResponseId = "";
  let latestUsageMetadata = null;
  let latestPromptFeedback = null;
  let latestCandidateDiagnostics = [];
  let latestModelVersion = "";
  let streamEventCount = 0;
  let textChunkCount = 0;
  let imageChunkCount = 0;
  let firstChunkLogged = false;

  streamEventCount = await parseSseResponseStream(geminiResponse.body, (payload) => {
    if (!firstChunkLogged) {
      firstChunkLogged = true;
      void logBackend("info", "Received first Google SSE chunk", {
        requestId,
        requestType,
        providerModel,
        googleAuthMode: googleRequestConfig.authMode,
        googleBackend: googleRequestConfig.backend,
        googleCloudProject: googleRequestConfig.project,
        googleCloudLocation: googleRequestConfig.location,
      });
    }

    latestResponseId =
      typeof payload?.responseId === "string" ? payload.responseId : latestResponseId;
    latestUsageMetadata = payload?.usageMetadata || latestUsageMetadata;
    latestPromptFeedback =
      summarizePromptFeedback(payload?.promptFeedback) || latestPromptFeedback;
    latestModelVersion =
      typeof payload?.modelVersion === "string"
        ? payload.modelVersion
        : latestModelVersion;
    const candidateDiagnostics = summarizeCandidates(payload?.candidates);
    if (candidateDiagnostics.length > 0) {
      latestCandidateDiagnostics = candidateDiagnostics;
    }

    const parts =
      payload?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];

    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        const chunkText = part.text.trim();
        textParts.push(chunkText);
        textChunkCount += 1;
        onEvent?.({
          type: "text",
          stage: "streaming_text",
          text: chunkText,
          aggregatedText: textParts.join("\n"),
        });
      }

      if (part?.inlineData?.data) {
        imageParts.push({
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "image/png",
        });
        imageChunkCount += 1;
        onEvent?.({
          type: "status",
          stage: "image_ready",
          message:
            imageParts.length >= imageOptions.imageCount
              ? `已收到 ${imageParts.length} 张图片，正在整理输出...`
              : `已收到第 ${imageParts.length} 张图片，继续等待其余结果...`,
        });
      }
    }
  });

  if (imageParts.length === 0) {
    await logBackend("error", "Google stream completed without image", {
      requestId,
      requestType,
      providerModel,
      googleAuthMode: googleRequestConfig.authMode,
      googleBackend: googleRequestConfig.backend,
      googleCloudProject: googleRequestConfig.project,
      googleCloudLocation: googleRequestConfig.location,
      responseId: latestResponseId,
      streamEventCount,
      textChunkCount,
      usageMetadata: latestUsageMetadata,
      promptFeedback: latestPromptFeedback,
      candidates: latestCandidateDiagnostics,
      modelVersion: latestModelVersion || null,
    });
    throw new Error("Gemini 没有返回图片结果，请调整提示词后重试");
  }

  const normalizedImages = imageParts
    .slice(0, imageOptions.imageCount)
    .map((imagePart) => ({
      imageBase64: imagePart.data,
      mimeType: imagePart.mimeType || "image/png",
    }));

  await logBackend("info", "Google stream completed", {
    requestId,
    requestType,
    providerModel,
    googleAuthMode: googleRequestConfig.authMode,
    googleBackend: googleRequestConfig.backend,
    googleCloudProject: googleRequestConfig.project,
    googleCloudLocation: googleRequestConfig.location,
    responseId: latestResponseId,
    streamEventCount,
    textChunkCount,
    imageChunkCount,
    usageMetadata: latestUsageMetadata,
    promptFeedback: latestPromptFeedback,
    candidates: latestCandidateDiagnostics,
    modelVersion: latestModelVersion || null,
    requestedImageCount: imageOptions.imageCount,
    returnedImageCount: normalizedImages.length,
    mimeTypes: normalizedImages.map((image) => image.mimeType),
  });

  return {
    providerModel,
    googleAuthMode: googleRequestConfig.authMode,
    googleBackend: googleRequestConfig.backend,
    googleCloudProject: googleRequestConfig.project,
    googleCloudLocation: googleRequestConfig.location,
    geminiPrompt,
    images: normalizedImages,
    text: textParts.join("\n"),
    responseId: latestResponseId,
    usageMetadata: latestUsageMetadata,
  };
}

function buildSingleImageOptions(imageOptions) {
  return {
    ...imageOptions,
    imageCount: 1,
  };
}

function resolveVariantConcurrency(targetImageCount) {
  const rawValue =
    process.env.BANANA_GENERATE_VARIANT_CONCURRENCY ||
    process.env.VERTEX_GENERATE_VARIANT_CONCURRENCY ||
    "";
  const parsedValue = Number.parseInt(String(rawValue), 10);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return Math.min(parsedValue, targetImageCount);
  }

  return targetImageCount;
}

async function generateImagesWithGemini({
  requestId,
  requestType,
  bananaModel,
  prompt,
  referenceImages,
  imageOptions,
  layoutGuideImage,
  additionalInstructions = [],
  onEvent,
  signal,
}) {
  const targetImageCount = Math.min(
    Math.max(Number.parseInt(String(imageOptions?.imageCount || "1"), 10) || 1, 1),
    MAX_IMAGE_COUNT,
  );

  if (targetImageCount === 1) {
    return generateImageWithGemini({
      requestId,
      requestType,
      bananaModel,
      prompt,
      referenceImages,
      imageOptions: buildSingleImageOptions(imageOptions),
      layoutGuideImage,
      additionalInstructions,
      onEvent,
      signal,
    });
  }

  const collectedImages = [];
  const responseIds = [];
  const usageMetadataList = [];
  const textParts = [];
  let sharedGeminiPrompt = "";
  let sharedProviderModel = bananaModel.providerModel;
  let sharedGoogleAuthMode = "";
  let sharedGoogleBackend = "";
  let sharedGoogleCloudProject = null;
  let sharedGoogleCloudLocation = null;
  const variantConcurrency = resolveVariantConcurrency(targetImageCount);

  onEvent?.({
    type: "status",
    stage: "requesting_variants",
    message:
      variantConcurrency > 1
        ? `正在并发生成 ${targetImageCount} 张图片（并发 ${variantConcurrency}）...`
        : `正在依次生成 ${targetImageCount} 张图片...`,
  });

  onEvent?.({
    type: "status",
    stage: "requesting_google_batch",
    message:
      variantConcurrency > 1
        ? `将以并发 ${variantConcurrency} 发送 ${targetImageCount} 路请求到 Google...`
        : `将顺序发送 ${targetImageCount} 路请求到 Google...`,
  });

  let completedCount = 0;
  async function runVariant(index) {
    const result = await generateImageWithGemini({
      requestId: `${requestId}-${index + 1}`,
      requestType,
      bananaModel,
      prompt,
      referenceImages,
      imageOptions: buildSingleImageOptions(imageOptions),
      layoutGuideImage,
      additionalInstructions: [
        ...additionalInstructions,
        `This request is for output variant ${index + 1} of ${targetImageCount}. Return exactly one standalone image for this variant.`,
        "Do not combine multiple variants into one image.",
        "Keep the same user intent, but make this output a distinct variation rather than a near-duplicate.",
      ],
      onEvent(eventPayload) {
        if (!onEvent) {
          return;
        }

        if (eventPayload?.type === "status") {
          return;
        }

        if (typeof eventPayload?.message === "string") {
          onEvent({
            ...eventPayload,
            message: `[${index + 1}/${targetImageCount}] ${eventPayload.message}`,
          });
          return;
        }

        if (eventPayload?.type === "text" && typeof eventPayload.text === "string") {
          onEvent({
            ...eventPayload,
            text: `[${index + 1}/${targetImageCount}] ${eventPayload.text}`,
            aggregatedText:
              typeof eventPayload.aggregatedText === "string"
                ? `[${index + 1}/${targetImageCount}] ${eventPayload.aggregatedText}`
                : eventPayload.aggregatedText,
          });
          return;
        }

        onEvent(eventPayload);
      },
      signal,
    });

    if (Array.isArray(result.images) && result.images[0]) {
      completedCount += 1;
      onEvent?.({
        type: "status",
        stage: "variants_progress",
        message: `已完成 ${completedCount}/${targetImageCount} 张图片...`,
      });
    }

    return result;
  }

  const variantResults = new Array(targetImageCount);

  if (variantConcurrency <= 1) {
    for (let index = 0; index < targetImageCount; index += 1) {
      variantResults[index] = await runVariant(index);
    }
  } else {
    let nextIndex = 0;

    await Promise.all(
      Array.from({ length: variantConcurrency }, async () => {
        while (nextIndex < targetImageCount) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          variantResults[currentIndex] = await runVariant(currentIndex);
        }
      }),
    );
  }

  for (const result of variantResults) {

    if (!sharedGeminiPrompt) {
      sharedGeminiPrompt = result.geminiPrompt;
    }

    sharedProviderModel = result.providerModel || sharedProviderModel;
    sharedGoogleAuthMode = result.googleAuthMode || sharedGoogleAuthMode;
    sharedGoogleBackend = result.googleBackend || sharedGoogleBackend;
    sharedGoogleCloudProject = result.googleCloudProject || sharedGoogleCloudProject;
    sharedGoogleCloudLocation = result.googleCloudLocation || sharedGoogleCloudLocation;

    if (result.responseId) {
      responseIds.push(result.responseId);
    }

    if (result.usageMetadata) {
      usageMetadataList.push(result.usageMetadata);
    }

    if (result.text) {
      textParts.push(result.text);
    }

    if (Array.isArray(result.images) && result.images[0]) {
      collectedImages.push(result.images[0]);
    }
  }

  return {
    providerModel: sharedProviderModel,
    googleAuthMode: sharedGoogleAuthMode,
    googleBackend: sharedGoogleBackend,
    googleCloudProject: sharedGoogleCloudProject,
    googleCloudLocation: sharedGoogleCloudLocation,
    geminiPrompt: sharedGeminiPrompt,
    images: collectedImages,
    text: textParts.join("\n\n"),
    responseId: responseIds.join(","),
    usageMetadata: usageMetadataList,
  };
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  return browserPromise;
}

async function waitForPageAssets(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;

    const images = Array.from(document.images);
    await Promise.all(
      images.map((image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }),
    );
  });
}

async function waitForStableHeight(locator) {
  let previousHeight = -1;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const box = await locator.boundingBox();
    const currentHeight = Math.ceil(box?.height || 0);

    if (currentHeight > 0 && currentHeight === previousHeight) {
      return;
    }

    previousHeight = currentHeight;
    await locator.page().waitForTimeout(120);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStoryboardCaptionFontSizePercent(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return 100;
  }

  return Math.min(Math.max(parsedValue, 70), 160);
}

function normalizeStoryboardCaptionBackgroundAlphaPercent(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue)) {
    return 90;
  }

  return Math.min(Math.max(parsedValue, 72), 100);
}

function sanitizeProfessionalExportPayload(input) {
  const rawRows = Number.parseInt(String(input?.canvas?.rows || "1"), 10) || 1;
  const rawColumns = Number.parseInt(String(input?.canvas?.columns || "1"), 10) || 1;
  const rows = Math.min(Math.max(rawRows, 1), MAX_LAYOUT_TRACKS);
  const columns = Math.min(Math.max(rawColumns, 1), MAX_LAYOUT_TRACKS);
  const canvasWidth = Math.min(
    Math.max(Number.parseFloat(String(input?.canvas?.width || "1")) || 1, 1),
    10000,
  );
  const canvasHeight = Math.min(
    Math.max(Number.parseFloat(String(input?.canvas?.height || "1")) || 1, 1),
    10000,
  );
  const rawCells = Array.isArray(input?.cells) ? input.cells : [];
  const cellsByCoordinate = new Map();

  for (const rawCell of rawCells) {
    const row = Math.min(
      Math.max(Number.parseInt(String(rawCell?.row || "1"), 10) || 1, 1),
      rows,
    );
    const column = Math.min(
      Math.max(Number.parseInt(String(rawCell?.column || "1"), 10) || 1, 1),
      columns,
    );
    const prompt = normalizePrompt(rawCell?.prompt).slice(0, 600);
    const caption = normalizePrompt(rawCell?.caption).slice(0, 240);
    const [image] = sanitizeReferenceImages(rawCell?.image ? [rawCell.image] : []);

    cellsByCoordinate.set(`${row}-${column}`, {
      row,
      column,
      prompt,
      caption,
      image: image || null,
    });
  }

  const captionStyle = {
    fontSizePercent: normalizeStoryboardCaptionFontSizePercent(
      input?.captionStyle?.fontSizePercent,
    ),
    backgroundAlphaPercent: normalizeStoryboardCaptionBackgroundAlphaPercent(
      input?.captionStyle?.backgroundAlphaPercent,
    ),
  };
  const cells = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      const index = (row - 1) * columns + column;
      const cell = cellsByCoordinate.get(`${row}-${column}`) || null;

      cells.push({
        index,
        row,
        column,
        prompt: cell?.prompt || "",
        caption: normalizePrompt(cell?.caption).slice(0, 240),
        image: cell?.image || null,
      });
    }
  }

  return {
    title: normalizePrompt(input?.title).slice(0, 160),
    canvas: {
      label: normalizePrompt(input?.canvas?.label).slice(0, 80),
      width: canvasWidth,
      height: canvasHeight,
      rows,
      columns,
    },
    captionStyle,
    cells,
  };
}

function buildProfessionalExportFilename() {
  const now = new Date();
  const formatted = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
    padDatePart(now.getHours()),
    padDatePart(now.getMinutes()),
    padDatePart(now.getSeconds()),
  ].join("-");

  return `banana-professional-export-${formatted}.png`;
}

function renderProfessionalExportHtml(payload) {
  const { canvas, cells, captionStyle } = payload;
  const gridTemplateColumns = `repeat(${canvas.columns}, minmax(0, 1fr))`;
  const gridTemplateRows = `repeat(${canvas.rows}, minmax(0, 1fr))`;
  const captionFontScale =
    normalizeStoryboardCaptionFontSizePercent(captionStyle?.fontSizePercent) / 100;
  const captionBackgroundAlpha =
    normalizeStoryboardCaptionBackgroundAlphaPercent(
      captionStyle?.backgroundAlphaPercent,
    ) / 100;
  const {
    placeholderPadding,
    placeholderFontSize,
    captionInset,
    captionPaddingY,
    captionPaddingX,
    captionFontSize,
    captionRadius,
  } = getProfessionalExportLayoutMetrics({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    rows: canvas.rows,
    columns: canvas.columns,
  });
  const cellMarkup = cells
    .map((cell) => {
      const promptText = escapeHtml(cell.prompt || "待生成");
      const captionText = escapeHtml(cell.caption || "");
      const imageMarkup = cell.image
        ? `<img class="professional-export-cell-image" src="data:${cell.image.mimeType};base64,${cell.image.data}" alt="Cell ${cell.index}" />`
        : `<div class="professional-export-placeholder">${promptText}</div>`;

      return `
        <div class="professional-export-cell${cell.image ? " has-image" : ""}${cell.caption ? " has-caption" : ""}">
          ${imageMarkup}
          ${
            cell.caption
              ? `<span class="professional-export-cell-caption"><span class="professional-export-cell-caption-text">${captionText}</span></span>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(payload.title || "专业模式导出预览")}</title>
      <style>
        :root {
          color-scheme: light;
          font-family: "Avenir Next", "PingFang SC", "Helvetica Neue", sans-serif;
          line-height: 1.5;
          font-weight: 400;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          background: transparent;
        }
        body {
          width: ${canvas.width}px;
        }
        #professional-export-preview-capture {
          width: ${canvas.width}px;
          aspect-ratio: ${canvas.width} / ${canvas.height};
          display: grid;
          grid-template-columns: ${gridTemplateColumns};
          grid-template-rows: ${gridTemplateRows};
          gap: 1px;
          padding: 1px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 24px 60px rgba(79, 54, 7, 0.12);
        }
        .professional-export-cell {
          position: relative;
          overflow: hidden;
          min-width: 0;
          min-height: 0;
          background: linear-gradient(180deg, rgba(246, 239, 225, 0.96), rgba(241, 233, 217, 1));
        }
        .professional-export-cell.has-image {
          background: #f7f2e7;
        }
        .professional-export-cell-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .professional-export-placeholder {
          height: 100%;
          display: grid;
          place-items: center;
          padding: ${placeholderPadding}px;
          color: rgba(52, 35, 13, 0.78);
          font-size: ${placeholderFontSize}px;
          line-height: 1.55;
          text-align: center;
          font-weight: 700;
          word-break: break-word;
        }
        .professional-export-cell-caption {
          position: absolute;
          left: ${captionInset}px;
          right: ${captionInset}px;
          bottom: ${captionInset}px;
          z-index: 1;
          text-align: center;
          pointer-events: none;
        }
        .professional-export-cell-caption-text {
          display: inline;
          padding: ${captionPaddingY}px ${captionPaddingX}px ${captionPaddingY + 1}px;
          border-radius: ${captionRadius}px;
          background: rgba(94, 94, 96, ${captionBackgroundAlpha});
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
          font-size: ${captionFontSize * captionFontScale}px;
          line-height: 1.24;
          font-weight: 800;
          letter-spacing: -0.03em;
          text-shadow: 0 1px 1px rgba(0, 0, 0, 0.22);
          word-break: break-word;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <section id="professional-export-preview-capture">${cellMarkup}</section>
    </body>
  </html>`;
}

async function renderProfessionalExportPreviewPng(payload) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: Math.round(payload.canvas.width), height: Math.round(payload.canvas.height) },
  });

  try {
    await page.setContent(renderProfessionalExportHtml(payload), {
      waitUntil: "load",
    });
    await waitForPageAssets(page);

    const preview = page.locator("#professional-export-preview-capture");
    await preview.waitFor();
    await waitForStableHeight(preview);

    return await preview.screenshot({
      animations: "disabled",
      scale: "css",
      type: "png",
    });
  } finally {
    await page.close();
  }
}

async function hasDistIndex() {
  try {
    await fs.access(path.join(distDir, "index.html"));
    return true;
  } catch {
    return false;
  }
}

async function ensureBootstrapPwRecord() {
  const accessPassword = getAccessPassword();

  if (!accessPassword) {
    return null;
  }

  return ensureSeedPwRecord({
    filePath: pwStoreFilePath,
    name: accessPassword,
    initialCredits: DEFAULT_PW_CREDITS,
  });
}

function parsePositiveInteger(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsedValue) ? parsedValue : NaN;
}

const app = express();

app.use(express.json({ limit: "40mb" }));

app.get("/api/health", async (_request, response) => {
  response.json({
    ok: true,
    google: await getPublicGoogleBackendSummary(),
  });
});

app.get("/api/access/session", ensureAuthenticated, (request, response) => {
  response.json({
    ok: true,
    pw: buildPwSummary(request.pwRecord),
  });
});

app.post("/api/export/professional-preview", ensureAuthenticated, async (request, response) => {
  const requestId = buildRequestId();

  try {
    const exportPayload = sanitizeProfessionalExportPayload(request.body || {});

    await logBackend("info", "Professional export requested", {
      requestId,
      route: "/api/export/professional-preview",
      pwName: request.accessPayload?.pwName || "",
      canvas: exportPayload.canvas,
      cellCount: exportPayload.cells.length,
      imageCellCount: exportPayload.cells.filter((cell) => cell.image).length,
    });

    const pngBuffer = await renderProfessionalExportPreviewPng(exportPayload);
    const filename = buildProfessionalExportFilename();

    response.setHeader("Content-Type", "image/png");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.send(pngBuffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "专业模式导出预览失败";
    const isBrowserInstallError =
      message.includes("Executable doesn't exist") ||
      message.includes("Please run the following command");

    await logBackend("error", "Professional export failed", {
      requestId,
      route: "/api/export/professional-preview",
      error,
    });

    response.status(500).json({
      error: message,
      hint: isBrowserInstallError
        ? "Run `npx playwright install chromium` in this project."
        : undefined,
    });
  }
});

app.post("/api/admin/login", (request, response) => {
  if (!isAdminConfigured()) {
    response.status(503).json({
      error: "管理员账号未配置，请先设置 ADMIN_USERNAME 和 ADMIN_PASSWORD",
    });
    return;
  }

  const username = normalizePrompt(request.body?.username);
  const password = normalizePrompt(request.body?.password);

  if (!username || !password) {
    response.status(400).json({ error: "请输入管理员用户名和密码" });
    return;
  }

  if (
    !safeEqualStrings(username, getAdminUsername()) ||
    !safeEqualStrings(password, getAdminPassword())
  ) {
    response.status(401).json({ error: "管理员用户名或密码错误" });
    return;
  }

  const tokenBundle = createAdminToken();

  response.json({
    ok: true,
    adminToken: tokenBundle.token,
    expiresAt: tokenBundle.expiresAt,
    username: getAdminUsername(),
  });
});

app.get("/api/admin/session", ensureAdminAuthenticated, (request, response) => {
  response.json({
    ok: true,
    username: getAdminUsername(),
    expiresAt: request.adminPayload.exp,
  });
});

app.get("/api/admin/pws", ensureAdminAuthenticated, async (_request, response) => {
  try {
    await ensureBootstrapPwRecord();
    const records = await listPwRecords({ filePath: pwStoreFilePath });

    response.json({
      ok: true,
      passwords: records.map(buildPwSummary),
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "加载 pw 列表失败",
    });
  }
});

app.post("/api/admin/pws", ensureAdminAuthenticated, async (request, response) => {
  try {
    const name = normalizePrompt(request.body?.name);

    if (!name) {
      response.status(400).json({ error: "请输入 pw 名称" });
      return;
    }

    const createdRecord = await createPwRecord({
      filePath: pwStoreFilePath,
      name,
      initialCredits: DEFAULT_PW_CREDITS,
    });

    response.status(201).json({
      ok: true,
      pw: buildPwSummary(createdRecord),
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "创建 pw 失败",
    });
  }
});

app.post("/api/admin/pws/:name/credits", ensureAdminAuthenticated, async (request, response) => {
  try {
    const amount = parsePositiveInteger(request.body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      response.status(400).json({ error: "追加额度必须是大于 0 的整数" });
      return;
    }

    const updatedRecord = await addPwCredits({
      filePath: pwStoreFilePath,
      name: request.params.name,
      amount,
    });

    response.json({
      ok: true,
      pw: buildPwSummary(updatedRecord),
    });
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "追加额度失败",
    });
  }
});

app.get("/api/models", ensureAuthenticated, (_request, response) => {
  response.json({
    ok: true,
    models: BANANA_MODELS.map(({ promptBooster, ...model }) => model),
  });
});

function prepareSseResponse(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

async function consumePwQuotaOrThrow(pwName, amount = 1) {
  return consumePwCredits({
    filePath: pwStoreFilePath,
    name: pwName,
    amount,
  });
}

async function refundPwQuotaIfNeeded(pwName, amount = 1) {
  if (!amount || amount <= 0) {
    return null;
  }

  return refundPwCredits({
    filePath: pwStoreFilePath,
    name: pwName,
    amount,
  });
}

function createGenerateStreamHandler({ route, mode = "professional" }) {
  return async (request, response) => {
    prepareSseResponse(response);
    const abortController = new AbortController();
    const requestId = buildRequestId();
    const heartbeatTimer = startSseHeartbeat(response, () => ({ requestId }));
    let closed = false;
    let consumedQuotaAmount = 0;

    response.on("close", () => {
      if (response.writableEnded) {
        return;
      }

      closed = true;
      abortController.abort();
      void logBackend("info", "Client disconnected from generate stream", {
        requestId,
        route,
        mode,
      });
    });

    try {
      const {
        prompt,
        bananaModel,
        referenceImages,
        layoutGuideImage,
        imageOptions,
      } = sanitizeGeneratePayload(request.body, mode);

      if (mode === "simple" && !prompt) {
        await logBackend("info", "Rejected generate stream request: empty prompt", {
          requestId,
          route,
          mode,
        });
        writeSseEvent(response, "error", { error: "请输入生成要求" });
        response.end();
        return;
      }

      let quotaRecord = await consumePwQuotaOrThrow(
        request.accessPayload.pwName,
        imageOptions.imageCount,
      );

      consumedQuotaAmount = imageOptions.imageCount;

      await logBackend("info", "Accepted generate stream request", {
        requestId,
        route,
        mode,
        pwName: quotaRecord.name,
        remainingCredits: quotaRecord.remainingCredits,
        bananaModelId: bananaModel.id,
        providerModel: bananaModel.providerModel,
        imageOptions,
        referenceImageCount: referenceImages.length,
        hasLayoutGuideImage: Boolean(layoutGuideImage),
        promptLength: prompt.length,
      });

      writeSseEvent(response, "status", {
        stage: "accepted",
        message:
          imageOptions.imageCount > 1
            ? `请求已接收，准备生成 ${imageOptions.imageCount} 张图片...`
            : "请求已接收，正在整理提示词...",
        requestId,
        bananaModelId: bananaModel.id,
        imageSize: imageOptions.imageSize,
        imageCount: imageOptions.imageCount,
        quota: buildPwSummary(quotaRecord),
      });

      const result = await generateImagesWithGemini({
        requestId,
        requestType: mode === "simple" ? "generate-simple" : "generate-professional",
        bananaModel,
        prompt,
        referenceImages,
        imageOptions,
        layoutGuideImage,
        signal: abortController.signal,
        onEvent(eventPayload) {
          if (!closed) {
            writeSseEvent(response, eventPayload.type || "status", eventPayload);
          }
        },
      });

      if (closed) {
        return;
      }

      const missingImageQuota = Math.max(0, consumedQuotaAmount - result.images.length);

      if (missingImageQuota > 0) {
        quotaRecord =
          (await refundPwQuotaIfNeeded(request.accessPayload.pwName, missingImageQuota)) ||
          quotaRecord;
        consumedQuotaAmount -= missingImageQuota;
        await logBackend("info", "Refunded unused generate stream quota", {
          requestId,
          route,
          mode,
          refundedAmount: missingImageQuota,
          returnedImageCount: result.images.length,
          requestedImageCount: imageOptions.imageCount,
          refundedQuotaRecord: buildPwSummary(quotaRecord),
        });
      }

      writeSseEvent(response, "status", {
        stage: "saving",
        message:
          result.images.length > 1
            ? `正在保存 ${result.images.length} 张生成结果...`
            : "正在保存生成结果...",
        requestId,
      });

      const savedRecords = await saveGenerationArtifactsBatch({
        bananaModel,
        imageOptions,
        userPrompt: prompt,
        geminiPrompt: result.geminiPrompt,
        modelOutputText: result.text,
        resultImages: result.images,
        requestId,
      });

      await logBackend("info", "Saved generate result", {
        requestId,
        route,
        mode,
        savedRecordIds: savedRecords.map((record) => record.id),
        imagePaths: savedRecords.map((record) => record.imagePath),
        metadataPaths: savedRecords.map((record) => record.metadataPath),
        responseId: result.responseId,
        providerModel: result.providerModel,
        googleAuthMode: result.googleAuthMode,
        googleBackend: result.googleBackend,
        googleCloudProject: result.googleCloudProject,
        googleCloudLocation: result.googleCloudLocation,
        returnedImageCount: result.images.length,
      });

      if (closed) {
        return;
      }

      writeSseEvent(response, "result", {
        ok: true,
        mode,
        bananaModelId: bananaModel.id,
        bananaModelName: bananaModel.name,
        bananaModelTone: bananaModel.tone,
        bananaModelPriceLabel: bananaModel.priceLabel,
        bananaModelPriceNote: bananaModel.priceNote,
        providerModel: result.providerModel,
        googleAuthMode: result.googleAuthMode,
        googleBackend: result.googleBackend,
        googleCloudProject: result.googleCloudProject,
        googleCloudLocation: result.googleCloudLocation,
        responseId: result.responseId,
        aspectRatio: imageOptions.aspectRatio,
        imageSize: imageOptions.imageSize,
        layoutRows: imageOptions.layoutRows,
        layoutColumns: imageOptions.layoutColumns,
        imageCountRequested: imageOptions.imageCount,
        imageCountReturned: result.images.length,
        savedRecord: savedRecords[0] || null,
        savedRecords,
        mimeType: result.images[0]?.mimeType || "image/png",
        imageBase64: result.images[0]?.imageBase64 || "",
        images: result.images,
        text: result.text,
        quota: buildPwSummary(quotaRecord),
      });
    } catch (error) {
      if (consumedQuotaAmount > 0) {
        const refundAmount = consumedQuotaAmount;
        try {
          const refundedQuotaRecord = await refundPwQuotaIfNeeded(
            request.accessPayload?.pwName,
            refundAmount,
          );
          consumedQuotaAmount = 0;
          await logBackend("info", "Refunded generate stream quota", {
            requestId,
            route,
            mode,
            refundedAmount: refundAmount,
            refundedQuotaRecord: refundedQuotaRecord ? buildPwSummary(refundedQuotaRecord) : null,
          });
        } catch (refundError) {
          await logBackend("error", "Failed to refund generate stream quota", {
            requestId,
            route,
            mode,
            refundError,
          });
        }
      }

      if (closed && error?.name === "AbortError") {
        await logBackend("info", "Generate stream request aborted after client disconnect", {
          requestId,
          route,
          mode,
        });
      } else {
        await logBackend("error", "Generate stream request failed", {
          requestId,
          route,
          mode,
          error,
        });
      }

      if (!closed) {
        const message = error instanceof Error ? error.message : "banana 生图失败";
        writeSseEvent(response, "error", { error: message });
      }
    } finally {
      clearInterval(heartbeatTimer);
      if (!closed) {
        response.end();
      }
    }
  };
}

function createGenerateJsonHandler({ route, mode = "professional" }) {
  return async (request, response) => {
    const requestId = buildRequestId();
    let consumedQuotaAmount = 0;

    try {
      const {
        prompt,
        bananaModel,
        referenceImages,
        layoutGuideImage,
        imageOptions,
      } = sanitizeGeneratePayload(request.body, mode);

      if (mode === "simple" && !prompt) {
        await logBackend("info", "Rejected generate request: empty prompt", {
          requestId,
          route,
          mode,
        });
        response.status(400).json({ error: "请输入生成要求" });
        return;
      }

      let quotaRecord = await consumePwQuotaOrThrow(
        request.accessPayload.pwName,
        imageOptions.imageCount,
      );

      consumedQuotaAmount = imageOptions.imageCount;

      await logBackend("info", "Accepted generate request", {
        requestId,
        route,
        mode,
        pwName: quotaRecord.name,
        remainingCredits: quotaRecord.remainingCredits,
        bananaModelId: bananaModel.id,
        providerModel: bananaModel.providerModel,
        imageOptions,
        referenceImageCount: referenceImages.length,
        hasLayoutGuideImage: Boolean(layoutGuideImage),
        promptLength: prompt.length,
      });

      const result = await generateImagesWithGemini({
        requestId,
        requestType: mode === "simple" ? "generate-simple" : "generate-professional",
        bananaModel,
        prompt,
        referenceImages,
        imageOptions,
        layoutGuideImage,
      });
      const missingImageQuota = Math.max(0, consumedQuotaAmount - result.images.length);

      if (missingImageQuota > 0) {
        quotaRecord =
          (await refundPwQuotaIfNeeded(request.accessPayload.pwName, missingImageQuota)) ||
          quotaRecord;
        consumedQuotaAmount -= missingImageQuota;
        await logBackend("info", "Refunded unused generate quota", {
          requestId,
          route,
          mode,
          refundedAmount: missingImageQuota,
          returnedImageCount: result.images.length,
          requestedImageCount: imageOptions.imageCount,
          refundedQuotaRecord: buildPwSummary(quotaRecord),
        });
      }

      const savedRecords = await saveGenerationArtifactsBatch({
        bananaModel,
        imageOptions,
        userPrompt: prompt,
        geminiPrompt: result.geminiPrompt,
        modelOutputText: result.text,
        resultImages: result.images,
        requestId,
      });

      await logBackend("info", "Saved generate result", {
        requestId,
        route,
        mode,
        savedRecordIds: savedRecords.map((record) => record.id),
        imagePaths: savedRecords.map((record) => record.imagePath),
        metadataPaths: savedRecords.map((record) => record.metadataPath),
        responseId: result.responseId,
        providerModel: result.providerModel,
        googleAuthMode: result.googleAuthMode,
        googleBackend: result.googleBackend,
        googleCloudProject: result.googleCloudProject,
        googleCloudLocation: result.googleCloudLocation,
        returnedImageCount: result.images.length,
      });

      response.json({
        ok: true,
        mode,
        bananaModelId: bananaModel.id,
        bananaModelName: bananaModel.name,
        bananaModelTone: bananaModel.tone,
        bananaModelPriceLabel: bananaModel.priceLabel,
        bananaModelPriceNote: bananaModel.priceNote,
        providerModel: result.providerModel,
        googleAuthMode: result.googleAuthMode,
        googleBackend: result.googleBackend,
        googleCloudProject: result.googleCloudProject,
        googleCloudLocation: result.googleCloudLocation,
        responseId: result.responseId,
        aspectRatio: imageOptions.aspectRatio,
        imageSize: imageOptions.imageSize,
        layoutRows: imageOptions.layoutRows,
        layoutColumns: imageOptions.layoutColumns,
        imageCountRequested: imageOptions.imageCount,
        imageCountReturned: result.images.length,
        savedRecord: savedRecords[0] || null,
        savedRecords,
        mimeType: result.images[0]?.mimeType || "image/png",
        imageBase64: result.images[0]?.imageBase64 || "",
        images: result.images,
        text: result.text,
        quota: buildPwSummary(quotaRecord),
      });
    } catch (error) {
      if (consumedQuotaAmount > 0) {
        const refundAmount = consumedQuotaAmount;
        try {
          await refundPwQuotaIfNeeded(request.accessPayload?.pwName, refundAmount);
          consumedQuotaAmount = 0;
        } catch (refundError) {
          await logBackend("error", "Failed to refund generate quota", {
            requestId,
            route,
            mode,
            refundError,
          });
        }
      }

      const message = error instanceof Error ? error.message : "banana 生图失败";
      await logBackend("error", "Generate request failed", {
        requestId,
        route,
        mode,
        error,
      });
      response.status(500).json({ error: message });
    }
  };
}

app.post(
  "/api/generate/simple/stream",
  ensureAuthenticated,
  createGenerateStreamHandler({
    route: "/api/generate/simple/stream",
    mode: "simple",
  }),
);

app.post(
  "/api/generate/professional/stream",
  ensureAuthenticated,
  createGenerateStreamHandler({
    route: "/api/generate/professional/stream",
    mode: "professional",
  }),
);

app.post(
  "/api/generate/stream",
  ensureAuthenticated,
  createGenerateStreamHandler({
    route: "/api/generate/stream",
    mode: "professional",
  }),
);

app.post("/api/enhance/stream", ensureAuthenticated, async (request, response) => {
  prepareSseResponse(response);
  const abortController = new AbortController();
  const requestId = buildRequestId();
  const heartbeatTimer = startSseHeartbeat(response, () => ({ requestId }));
  let closed = false;
  let consumedQuotaAmount = 0;

  response.on("close", () => {
    if (response.writableEnded) {
      return;
    }

    closed = true;
    abortController.abort();
    void logBackend("info", "Client disconnected from enhance stream", {
      requestId,
      route: "/api/enhance/stream",
    });
  });

  try {
    const prompt = normalizePrompt(request.body?.prompt);

    if (!prompt) {
      await logBackend("info", "Rejected enhance stream request: missing prompt", {
        requestId,
        route: "/api/enhance/stream",
      });
      writeSseEvent(response, "error", { error: "缺少原始提示词，无法提升清晰度" });
      response.end();
      return;
    }

    const bananaModel = resolveBananaModel(request.body?.modelId);
    const sourceImage = sanitizeSourceImage(request.body?.sourceImage);

    if (!sourceImage) {
      await logBackend("info", "Rejected enhance stream request: missing source image", {
        requestId,
        route: "/api/enhance/stream",
      });
      writeSseEvent(response, "error", { error: "缺少原始结果图，无法提升清晰度" });
      response.end();
      return;
    }

    const layoutGuideImage = sanitizeLayoutGuideImage(request.body?.layoutGuideImage);
    const imageOptions = {
      ...sanitizeImageOptions(request.body?.imageOptions, bananaModel),
      imageCount: 1,
    };
    const quotaRecord = await consumePwQuotaOrThrow(request.accessPayload.pwName, 1);

    consumedQuotaAmount = 1;

    await logBackend("info", "Accepted enhance stream request", {
      requestId,
      route: "/api/enhance/stream",
      pwName: quotaRecord.name,
      remainingCredits: quotaRecord.remainingCredits,
      bananaModelId: bananaModel.id,
      providerModel: bananaModel.providerModel,
      imageOptions,
      hasLayoutGuideImage: Boolean(layoutGuideImage),
      promptLength: prompt.length,
      sourceImageMimeType: sourceImage.mimeType,
      sourceImageName: sourceImage.name,
    });

    writeSseEvent(response, "status", {
      stage: "accepted",
      message: `请求已接收，准备提升到 ${imageOptions.imageSize}...`,
      requestId,
      bananaModelId: bananaModel.id,
      imageSize: imageOptions.imageSize,
      quota: buildPwSummary(quotaRecord),
    });

    const result = await generateImagesWithGemini({
      requestId,
      requestType: "enhance",
      bananaModel,
      prompt,
      referenceImages: [sourceImage],
      imageOptions,
      layoutGuideImage,
      signal: abortController.signal,
      additionalInstructions: [
        "The uploaded reference image is the previously generated low-resolution result.",
        "Preserve the composition, panel layout, subject identity, perspective, scene structure, and text placement as closely as possible.",
        "Increase visual clarity, local detail, edge fidelity, and legibility only. Do not redesign the image or change the arrangement.",
      ],
      onEvent(eventPayload) {
        if (!closed) {
          writeSseEvent(response, eventPayload.type || "status", eventPayload);
        }
      },
    });

    if (closed) {
      return;
    }

    writeSseEvent(response, "status", {
      stage: "saving",
      message: "正在保存提升结果...",
      requestId,
    });

    const savedRecord = await saveGenerationArtifacts({
      bananaModel,
      imageOptions,
      userPrompt: prompt,
      geminiPrompt: result.geminiPrompt,
      modelOutputText: result.text,
      resultImageBase64: result.images[0].imageBase64,
      resultMimeType: result.images[0].mimeType,
      requestId,
    });

    await logBackend("info", "Saved enhance result", {
      requestId,
      route: "/api/enhance/stream",
      savedRecordId: savedRecord.id,
      imagePath: savedRecord.imagePath,
      metadataPath: savedRecord.metadataPath,
      responseId: result.responseId,
      providerModel: result.providerModel,
      googleAuthMode: result.googleAuthMode,
      googleBackend: result.googleBackend,
      googleCloudProject: result.googleCloudProject,
      googleCloudLocation: result.googleCloudLocation,
    });

    if (closed) {
      return;
    }

    writeSseEvent(response, "result", {
      ok: true,
      bananaModelId: bananaModel.id,
      bananaModelName: bananaModel.name,
      bananaModelTone: bananaModel.tone,
      bananaModelPriceLabel: bananaModel.priceLabel,
      bananaModelPriceNote: bananaModel.priceNote,
      providerModel: result.providerModel,
      googleAuthMode: result.googleAuthMode,
      googleBackend: result.googleBackend,
      googleCloudProject: result.googleCloudProject,
      googleCloudLocation: result.googleCloudLocation,
      responseId: result.responseId,
      aspectRatio: imageOptions.aspectRatio,
      imageSize: imageOptions.imageSize,
      layoutRows: imageOptions.layoutRows,
      layoutColumns: imageOptions.layoutColumns,
      imageCountRequested: 1,
      imageCountReturned: 1,
      savedRecord,
      savedRecords: [savedRecord],
      mimeType: result.images[0].mimeType,
      imageBase64: result.images[0].imageBase64,
      images: result.images,
      text: result.text,
      quota: buildPwSummary(quotaRecord),
    });
  } catch (error) {
    if (consumedQuotaAmount > 0) {
      try {
        const refundedQuotaRecord = await refundPwQuotaIfNeeded(
          request.accessPayload?.pwName,
          consumedQuotaAmount,
        );
        consumedQuotaAmount = 0;
        await logBackend("info", "Refunded enhance stream quota", {
          requestId,
          route: "/api/enhance/stream",
          refundedQuotaRecord: refundedQuotaRecord ? buildPwSummary(refundedQuotaRecord) : null,
        });
      } catch (refundError) {
        await logBackend("error", "Failed to refund enhance stream quota", {
          requestId,
          route: "/api/enhance/stream",
          refundError,
        });
      }
    }

    if (closed && error?.name === "AbortError") {
      await logBackend("info", "Enhance stream request aborted after client disconnect", {
        requestId,
        route: "/api/enhance/stream",
      });
    } else {
      await logBackend("error", "Enhance stream request failed", {
        requestId,
        route: "/api/enhance/stream",
        error,
      });
    }
    if (!closed) {
      const message = error instanceof Error ? error.message : "提升清晰度失败";
      writeSseEvent(response, "error", { error: message });
    }
  } finally {
    clearInterval(heartbeatTimer);
    if (!closed) {
      response.end();
    }
  }
});

app.post(
  "/api/generate/simple",
  ensureAuthenticated,
  createGenerateJsonHandler({
    route: "/api/generate/simple",
    mode: "simple",
  }),
);

app.post(
  "/api/generate/professional",
  ensureAuthenticated,
  createGenerateJsonHandler({
    route: "/api/generate/professional",
    mode: "professional",
  }),
);

app.post(
  "/api/generate",
  ensureAuthenticated,
  createGenerateJsonHandler({
    route: "/api/generate",
    mode: "professional",
  }),
);

app.post("/api/enhance", ensureAuthenticated, async (request, response) => {
  const requestId = buildRequestId();
  let consumedQuotaAmount = 0;
  try {
    const prompt = normalizePrompt(request.body?.prompt);

    if (!prompt) {
      await logBackend("info", "Rejected enhance request: missing prompt", {
        requestId,
        route: "/api/enhance",
      });
      response.status(400).json({ error: "缺少原始提示词，无法提升清晰度" });
      return;
    }

    const bananaModel = resolveBananaModel(request.body?.modelId);
    const sourceImage = sanitizeSourceImage(request.body?.sourceImage);

    if (!sourceImage) {
      await logBackend("info", "Rejected enhance request: missing source image", {
        requestId,
        route: "/api/enhance",
      });
      response.status(400).json({ error: "缺少原始结果图，无法提升清晰度" });
      return;
    }

    const layoutGuideImage = sanitizeLayoutGuideImage(request.body?.layoutGuideImage);
    const imageOptions = {
      ...sanitizeImageOptions(request.body?.imageOptions, bananaModel),
      imageCount: 1,
    };
    const quotaRecord = await consumePwQuotaOrThrow(request.accessPayload.pwName, 1);

    consumedQuotaAmount = 1;

    await logBackend("info", "Accepted enhance request", {
      requestId,
      route: "/api/enhance",
      pwName: quotaRecord.name,
      remainingCredits: quotaRecord.remainingCredits,
      bananaModelId: bananaModel.id,
      providerModel: bananaModel.providerModel,
      imageOptions,
      hasLayoutGuideImage: Boolean(layoutGuideImage),
      promptLength: prompt.length,
      sourceImageMimeType: sourceImage.mimeType,
      sourceImageName: sourceImage.name,
    });

    const result = await generateImagesWithGemini({
      requestId,
      requestType: "enhance",
      bananaModel,
      prompt,
      referenceImages: [sourceImage],
      imageOptions,
      layoutGuideImage,
      additionalInstructions: [
        "The uploaded reference image is the previously generated low-resolution result.",
        "Preserve the composition, panel layout, subject identity, perspective, scene structure, and text placement as closely as possible.",
        "Increase visual clarity, local detail, edge fidelity, and legibility only. Do not redesign the image or change the arrangement.",
      ],
    });
    const savedRecord = await saveGenerationArtifacts({
      bananaModel,
      imageOptions,
      userPrompt: prompt,
      geminiPrompt: result.geminiPrompt,
      modelOutputText: result.text,
      resultImageBase64: result.images[0].imageBase64,
      resultMimeType: result.images[0].mimeType,
      requestId,
    });

    await logBackend("info", "Saved enhance result", {
      requestId,
      route: "/api/enhance",
      savedRecordId: savedRecord.id,
      imagePath: savedRecord.imagePath,
      metadataPath: savedRecord.metadataPath,
      responseId: result.responseId,
      providerModel: result.providerModel,
      googleAuthMode: result.googleAuthMode,
      googleBackend: result.googleBackend,
      googleCloudProject: result.googleCloudProject,
      googleCloudLocation: result.googleCloudLocation,
    });

    response.json({
      ok: true,
      bananaModelId: bananaModel.id,
      bananaModelName: bananaModel.name,
      bananaModelTone: bananaModel.tone,
      bananaModelPriceLabel: bananaModel.priceLabel,
      bananaModelPriceNote: bananaModel.priceNote,
      providerModel: result.providerModel,
      googleAuthMode: result.googleAuthMode,
      googleBackend: result.googleBackend,
      googleCloudProject: result.googleCloudProject,
      googleCloudLocation: result.googleCloudLocation,
      aspectRatio: imageOptions.aspectRatio,
      imageSize: imageOptions.imageSize,
      layoutRows: imageOptions.layoutRows,
      layoutColumns: imageOptions.layoutColumns,
      imageCountRequested: 1,
      imageCountReturned: 1,
      savedRecord,
      savedRecords: [savedRecord],
      mimeType: result.images[0].mimeType,
      imageBase64: result.images[0].imageBase64,
      images: result.images,
      text: result.text,
      quota: buildPwSummary(quotaRecord),
    });
  } catch (error) {
    if (consumedQuotaAmount > 0) {
      try {
        await refundPwQuotaIfNeeded(request.accessPayload?.pwName, consumedQuotaAmount);
        consumedQuotaAmount = 0;
      } catch (refundError) {
        await logBackend("error", "Failed to refund enhance quota", {
          requestId,
          route: "/api/enhance",
          refundError,
        });
      }
    }

    const message = error instanceof Error ? error.message : "提升清晰度失败";
    await logBackend("error", "Enhance request failed", {
      requestId,
      route: "/api/enhance",
      error,
    });
    response.status(500).json({ error: message });
  }
});

if (await hasDistIndex()) {
  app.use(express.static(distDir));

  app.get("/{*any}", (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

await ensureBootstrapPwRecord();
await logBackend("info", "Google generation backend configured", await getResolvedGoogleBackendSummary());

const server = app.listen(port, () => {
  void logBackend("info", "Backend listening", {
    url: `http://127.0.0.1:${port}`,
  });
});

async function closeBrowser() {
  if (!browserPromise) {
    return;
  }

  const browser = await browserPromise;
  await browser.close();
  browserPromise = null;
}

async function shutdown(exitCode) {
  server.close(async () => {
    try {
      await closeBrowser();
    } finally {
      process.exit(exitCode);
    }
  });
}

process.on("SIGINT", () => {
  void shutdown(130);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});
