const DEFAULT_ADMIN_TOKEN = "mock-admin-token";
const DEFAULT_ADMIN_EXPIRES_AT = "2099-01-01T00:00:00.000Z";

export const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yF9sAAAAASUVORK5CYII=";

export function getMockModelsPayload() {
  return {
    models: [
      {
        id: "nano-banana-2",
        name: "Nano Banana 2",
        priceLabel: "1 credit",
        description: "Playwright mock model",
        supportedAspectRatios: ["1:1", "3:4", "4:5"],
        supportedImageSizes: ["1K", "2K"],
        supportsImageSizeParam: true,
      },
    ],
  };
}

export function buildMockPasswordRecord(name, overrides = {}) {
  return normalizePasswordRecord({
    name,
    createdAt: "2026-03-25T10:00:00.000Z",
    updatedAt: "2026-03-25T10:00:00.000Z",
    remainingCredits: 100,
    totalCredits: 100,
    usedCredits: 0,
    ...overrides,
  });
}

export function fulfillJson(route, data, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

function normalizePasswordRecord(record) {
  const remainingCredits = Number(record?.remainingCredits || 0);
  const usedCredits = Number(record?.usedCredits || 0);
  const totalCredits =
    Number(record?.totalCredits) || Math.max(remainingCredits + usedCredits, 0);

  return {
    name: String(record?.name || "").trim(),
    createdAt: record?.createdAt || DEFAULT_ADMIN_EXPIRES_AT,
    updatedAt: record?.updatedAt || DEFAULT_ADMIN_EXPIRES_AT,
    remainingCredits,
    totalCredits,
    usedCredits,
  };
}

function readJsonBody(request) {
  try {
    return request.postDataJSON();
  } catch {
    return {};
  }
}

export async function installApiMocks(
  page,
  {
    studioSession = {
      pw: {
        value: "banana",
        remainingCredits: 99,
      },
    },
    models = getMockModelsPayload().models,
    adminUsername = "banana-admin",
    adminToken = DEFAULT_ADMIN_TOKEN,
    adminExpiresAt = DEFAULT_ADMIN_EXPIRES_AT,
    passwords = [],
    customHandler = null,
  } = {},
) {
  const state = {
    studioSession,
    models,
    adminUsername,
    adminToken,
    adminExpiresAt,
    passwords: passwords.map((record) => normalizePasswordRecord(record)),
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (typeof customHandler === "function") {
      const handled = await customHandler({
        route,
        request,
        pathname,
        state,
        fulfillJson,
      });

      if (handled) {
        return;
      }
    }

    if (pathname === "/api/access/session" && request.method() === "GET") {
      await fulfillJson(route, state.studioSession);
      return;
    }

    if (pathname === "/api/models" && request.method() === "GET") {
      await fulfillJson(route, { models: state.models });
      return;
    }

    if (pathname === "/api/admin/login" && request.method() === "POST") {
      await fulfillJson(route, {
        ok: true,
        adminToken: state.adminToken,
        expiresAt: state.adminExpiresAt,
      });
      return;
    }

    if (pathname === "/api/admin/session" && request.method() === "GET") {
      await fulfillJson(route, {
        ok: true,
        username: state.adminUsername,
        expiresAt: state.adminExpiresAt,
      });
      return;
    }

    if (pathname === "/api/admin/pws" && request.method() === "GET") {
      await fulfillJson(route, {
        ok: true,
        passwords: state.passwords,
      });
      return;
    }

    if (pathname === "/api/admin/pws" && request.method() === "POST") {
      const body = readJsonBody(request);
      const name = String(body?.name || "").trim();

      if (!name) {
        await fulfillJson(route, { error: "pw 名称不能为空" }, 400);
        return;
      }

      if (state.passwords.some((record) => record.name === name)) {
        await fulfillJson(route, { error: `pw ${name} 已存在` }, 409);
        return;
      }

      const nextRecord = buildMockPasswordRecord(name, {
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:00.000Z",
      });
      state.passwords = state.passwords
        .concat(nextRecord)
        .sort((left, right) => left.name.localeCompare(right.name));

      await fulfillJson(route, {
        ok: true,
        pw: nextRecord,
      });
      return;
    }

    const addCreditsMatch = pathname.match(/^\/api\/admin\/pws\/([^/]+)\/credits$/);

    if (addCreditsMatch && request.method() === "POST") {
      const name = decodeURIComponent(addCreditsMatch[1]);
      const amount = Number.parseInt(String(readJsonBody(request)?.amount || ""), 10);
      const currentRecord = state.passwords.find((record) => record.name === name);

      if (!currentRecord) {
        await fulfillJson(route, { error: `pw ${name} 不存在` }, 404);
        return;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        await fulfillJson(route, { error: "请输入大于 0 的整数额度" }, 400);
        return;
      }

      const nextRecord = normalizePasswordRecord({
        ...currentRecord,
        remainingCredits: currentRecord.remainingCredits + amount,
        totalCredits: currentRecord.totalCredits + amount,
        updatedAt: "2026-03-27T00:10:00.000Z",
      });
      state.passwords = state.passwords.map((record) =>
        record.name === name ? nextRecord : record,
      );

      await fulfillJson(route, {
        ok: true,
        pw: nextRecord,
      });
      return;
    }

    await fulfillJson(
      route,
      {
        error: `Unexpected mocked API request: ${request.method()} ${pathname}`,
      },
      501,
    );
  });

  return state;
}
