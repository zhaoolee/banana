import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const generationsDir = path.join(rootDir, "storage", "generations");
const port = Number(process.env.PORT || 3001);
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
const STANDARD_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const MAX_LAYOUT_TRACKS = 8;

const BANANA_MODELS = [
  {
    id: "nano-banana",
    name: "基础版",
    tone: "官方 Nano Banana / Gemini 2.5 Flash Image",
    description: "价格最低，适合通用图像生成与基础编辑。",
    priceLabel: "$0.039/张",
    priceNote: "标准 1K 参考价",
    providerModel:
      process.env.GEMINI_MODEL_NANO_BANANA?.trim() || "gemini-2.5-flash-image",
    promptBooster:
      "Use the capabilities of Gemini 2.5 Flash Image for versatile image generation and editing with solid prompt adherence.",
    supportedAspectRatios: STANDARD_ASPECT_RATIOS,
  },
  {
    id: "nano-banana-2",
    name: "默认版",
    tone: "官方 Nano Banana 2 / Gemini 3.1 Flash Image",
    description: "当前默认推荐，速度、质量和能力更均衡。",
    priceLabel: "$0.067/张",
    priceNote: "标准 1K 参考价",
    providerModel:
      process.env.GEMINI_MODEL_NANO_BANANA_2?.trim() ||
      process.env.GEMINI_IMAGE_MODEL?.trim() ||
      "gemini-3.1-flash-image-preview",
    promptBooster:
      "Use the latest Gemini 3.1 Flash Image generation and editing behavior for fast, strong all-around image output.",
    supportedAspectRatios: ALL_SUPPORTED_ASPECT_RATIOS,
  },
  {
    id: "nano-banana-pro",
    name: "Pro版",
    tone: "官方 Nano Banana Pro / Gemini 3 Pro Image",
    description: "价格最高，适合复杂场景、高精度控制和更强文字遵循。",
    priceLabel: "$0.134/张",
    priceNote: "标准 1K/2K 参考价",
    providerModel:
      process.env.GEMINI_MODEL_NANO_BANANA_PRO?.trim() ||
      "gemini-3-pro-image-preview",
    promptBooster:
      "Use the advanced reasoning and precision of Gemini 3 Pro Image to maximize control, detail, and prompt fidelity.",
    supportedAspectRatios: STANDARD_ASPECT_RATIOS,
  },
];

function getAccessPassword() {
  return (process.env.ACCESS_PASSWORD || "banana").trim();
}

function getAccessTokenTtlMs() {
  const minutes = Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 720);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 12 * 60 * 60 * 1000;
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

function createAccessToken() {
  const payload = {
    exp: Date.now() + getAccessTokenTtlMs(),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.exp,
  };
}

function verifyAccessToken(token) {
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

function passwordsMatch(inputPassword) {
  const provided = Buffer.from(String(inputPassword || ""));
  const expected = Buffer.from(getAccessPassword());

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

function ensureAuthenticated(request, response, next) {
  const payload = verifyAccessToken(getAccessTokenFromRequest(request));

  if (!payload) {
    response.status(401).json({
      error: "提取码会话无效或已过期，请重新输入提取码",
    });
    return;
  }

  request.accessPayload = payload;
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

function resolveBananaModel(modelId) {
  return BANANA_MODELS.find((item) => item.id === modelId) || BANANA_MODELS[0];
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
        bananaModel: {
          id: bananaModel.id,
          name: bananaModel.name,
          tone: bananaModel.tone,
          providerModel: bananaModel.providerModel,
          priceLabel: bananaModel.priceLabel,
          priceNote: bananaModel.priceNote,
        },
        imageOptions,
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

  return {
    aspectRatio,
    layoutRows,
    layoutColumns,
  };
}

function buildGeminiPrompt({
  bananaModel,
  prompt,
  referenceImages,
  imageOptions,
  hasLayoutGuideImage,
}) {
  const referenceHint =
    referenceImages.length > 0
      ? `Use the uploaded reference images as visual guidance. Preserve important subject cues when it helps the request. The reference images are numbered in upload order. If the user mentions 图1, 图2, 1号图, 2号图, #1, or #2, map those references to the matching numbered image.`
      : `No reference images were supplied, so compose the scene from the text request alone.`;
  const layoutGuideHint = hasLayoutGuideImage
    ? "A dedicated layout guide image is provided. Treat it as structural composition guidance for panel arrangement, not as a style reference."
    : "No separate layout guide image is provided.";
  const totalPanels = imageOptions.layoutRows * imageOptions.layoutColumns;
  const layoutRule =
    totalPanels > 1
      ? `Create exactly ${totalPanels} panels arranged in ${imageOptions.layoutRows} horizontal rows and ${imageOptions.layoutColumns} vertical columns. Rows run top-to-bottom. Columns run left-to-right. Do not transpose, rotate, or swap rows and columns.`
      : "Create a single-panel composition.";

  return [
    "You are Banana Studio, an image generation assistant.",
    "Return one strong final image that follows the request precisely.",
    bananaModel.promptBooster,
    referenceHint,
    layoutGuideHint,
    `Preferred aspect ratio: ${imageOptions.aspectRatio}.`,
    `Preferred layout grid: ${imageOptions.layoutRows} rows by ${imageOptions.layoutColumns} columns.`,
    layoutRule,
    "When composing collages, panels, or multi-scene layouts, respect the requested grid structure exactly.",
    "Prefer coherent composition, clear focal subject, refined lighting, and high visual quality.",
    `User request: ${prompt}`,
  ].join("\n");
}

async function generateImageWithGemini({
  bananaModel,
  prompt,
  referenceImages,
  imageOptions,
  layoutGuideImage,
}) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY，请先在 .env 中配置");
  }

  const providerModel = bananaModel.providerModel;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${providerModel}:generateContent`;
  const geminiPrompt = buildGeminiPrompt({
    bananaModel,
    prompt,
    referenceImages,
    imageOptions,
    hasLayoutGuideImage: Boolean(layoutGuideImage),
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
      },
    },
  };

  const geminiResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await geminiResponse.text();
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!geminiResponse.ok) {
    const apiMessage =
      payload?.error?.message || "Gemini 图像生成请求失败";
    throw new Error(apiMessage);
  }

  const parts =
    payload?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];
  const imagePart = parts.find((part) => part?.inlineData?.data);
  const textParts = parts
    .filter((part) => typeof part?.text === "string" && part.text.trim())
    .map((part) => part.text.trim());

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini 没有返回图片结果，请调整提示词后重试");
  }

  return {
    providerModel,
    geminiPrompt,
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
    text: textParts.join("\n"),
  };
}

async function hasDistIndex() {
  try {
    await fs.access(path.join(distDir, "index.html"));
    return true;
  } catch {
    return false;
  }
}

const app = express();

app.use(express.json({ limit: "40mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/access/verify", (request, response) => {
  const password = normalizePrompt(request.body?.password);

  if (!password) {
    response.status(400).json({ error: "请输入提取码" });
    return;
  }

  if (!passwordsMatch(password)) {
    response.status(401).json({ error: "提取码错误" });
    return;
  }

  const tokenBundle = createAccessToken();

  response.json({
    ok: true,
    accessToken: tokenBundle.token,
    expiresAt: tokenBundle.expiresAt,
  });
});

app.get("/api/access/session", ensureAuthenticated, (request, response) => {
  response.json({
    ok: true,
    expiresAt: request.accessPayload.exp,
  });
});

app.get("/api/models", ensureAuthenticated, (_request, response) => {
  response.json({
    ok: true,
    models: BANANA_MODELS.map(({ promptBooster, ...model }) => model),
  });
});

app.post("/api/generate", ensureAuthenticated, async (request, response) => {
  try {
    const prompt = normalizePrompt(request.body?.prompt);

    if (!prompt) {
      response.status(400).json({ error: "请输入生成要求" });
      return;
    }

    const bananaModel = resolveBananaModel(request.body?.modelId);
    const referenceImages = sanitizeReferenceImages(request.body?.referenceImages);
    const layoutGuideImage = sanitizeLayoutGuideImage(request.body?.layoutGuideImage);
    const imageOptions = sanitizeImageOptions(request.body?.imageOptions, bananaModel);
    const result = await generateImageWithGemini({
      bananaModel,
      prompt,
      referenceImages,
      imageOptions,
      layoutGuideImage,
    });
    const savedRecord = await saveGenerationArtifacts({
      bananaModel,
      imageOptions,
      userPrompt: prompt,
      geminiPrompt: result.geminiPrompt,
      modelOutputText: result.text,
      resultImageBase64: result.imageBase64,
      resultMimeType: result.mimeType,
    });

    response.json({
      ok: true,
      bananaModelId: bananaModel.id,
      bananaModelName: bananaModel.name,
      bananaModelTone: bananaModel.tone,
      bananaModelPriceLabel: bananaModel.priceLabel,
      bananaModelPriceNote: bananaModel.priceNote,
      providerModel: result.providerModel,
      aspectRatio: imageOptions.aspectRatio,
      layoutRows: imageOptions.layoutRows,
      layoutColumns: imageOptions.layoutColumns,
      savedRecord,
      mimeType: result.mimeType,
      imageBase64: result.imageBase64,
      text: result.text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "banana 生图失败";
    console.error("Generate request failed:", error);
    response.status(500).json({ error: message });
  }
});

if (await hasDistIndex()) {
  app.use(express.static(distDir));

  app.get("/{*any}", (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Backend listening on http://127.0.0.1:${port}`);
});
