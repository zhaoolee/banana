import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const configuredCredentialsPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
const cloudSdkConfigDir = String(process.env.CLOUDSDK_CONFIG || "").trim() || path.join(os.homedir(), ".config", "gcloud");
const candidateCredentialPaths = [
  configuredCredentialsPath,
  "/app/.config/gcloud/application_default_credentials.json",
  path.join(cloudSdkConfigDir, "application_default_credentials.json"),
].filter(Boolean);
const credentialsPath =
  candidateCredentialPaths.find((candidatePath) => fs.existsSync(candidatePath)) ||
  configuredCredentialsPath ||
  "/app/.config/gcloud/application_default_credentials.json";
let adcQuotaProjectId = "";

if (credentialsPath && fs.existsSync(credentialsPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    adcQuotaProjectId = String(parsed?.quota_project_id || "").trim();
  } catch {
    adcQuotaProjectId = "";
  }
}

const project = String(
  process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    adcQuotaProjectId,
).trim();
const location = String(process.env.GOOGLE_CLOUD_LOCATION || "global").trim() || "global";
const model = String(process.env.GEMINI_TEST_MODEL || "gemini-3.1-flash-image-preview").trim();
const prompt = String(
  process.env.GEMINI_TEST_PROMPT ||
    "一只白色马尔济斯小狗，坐在极简风白色桌面上，柔和自然光，产品摄影风格，高清细节，干净背景，真实毛发质感",
).trim();
const outputPath = String(process.env.GEMINI_TEST_OUTPUT || "/tmp/banana-vertex-adc-test.png").trim();
const quotaProject = String(
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT || process.env.GOOGLE_QUOTA_PROJECT || adcQuotaProjectId || project,
).trim();

if (!project) {
  throw new Error("缺少 GOOGLE_CLOUD_PROJECT");
}

const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
const endpoint = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:streamGenerateContent?alt=sse`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const client = await auth.getClient();
const accessTokenResponse = await client.getAccessToken();
const accessToken =
  typeof accessTokenResponse === "string"
    ? accessTokenResponse
    : accessTokenResponse?.token || "";

if (!accessToken) {
  throw new Error("无法从 ADC 获取 Google 访问令牌");
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...(quotaProject ? { "x-goog-user-project": quotaProject } : {}),
  },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K",
      },
    },
  }),
});

if (!response.ok) {
  const responseText = await response.text();
  console.error(responseText);
  process.exit(1);
}

if (!response.body) {
  throw new Error("Vertex AI 流式响应不可用");
}

const imageParts = [];
const textParts = [];
const decoder = new TextDecoder();
let buffer = "";

function collectEvent(rawEvent) {
  const dataLines = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return;
  }

  const dataText = dataLines.join("\n");

  if (dataText === "[DONE]") {
    return;
  }

  const payload = JSON.parse(dataText);
  const parts =
    payload?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];

  for (const part of parts) {
    if (typeof part?.text === "string" && part.text.trim()) {
      textParts.push(part.text.trim());
    }

    if (part?.inlineData?.data) {
      imageParts.push(part.inlineData);
    }
  }
}

for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");

  while (buffer.includes("\n\n")) {
    const boundaryIndex = buffer.indexOf("\n\n");
    const rawEvent = buffer.slice(0, boundaryIndex);
    buffer = buffer.slice(boundaryIndex + 2);
    collectEvent(rawEvent);

    if (imageParts[0]?.data) {
      break;
    }
  }

  if (imageParts[0]?.data) {
    break;
  }
}

if (!imageParts[0]?.data && buffer.trim()) {
  collectEvent(buffer);
}

if (!imageParts[0]?.data) {
  throw new Error("Vertex AI 没有返回图片数据");
}

fs.writeFileSync(outputPath, Buffer.from(imageParts[0].data, "base64"));

console.log(
  JSON.stringify(
    {
      ok: true,
      project,
      location,
      quotaProject: quotaProject || null,
      model,
      outputPath,
      imageCount: imageParts.length,
      textPreview: textParts.join("\n").slice(0, 300) || null,
    },
    null,
    2,
  ),
);

process.exit(0);
