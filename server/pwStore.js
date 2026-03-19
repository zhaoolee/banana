import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PW_CREDITS = 100;

const PW_STORE_VERSION = 1;
const PW_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

let storeQueue = Promise.resolve();

function getDefaultStore() {
  return {
    version: PW_STORE_VERSION,
    passwords: [],
  };
}

function cloneRecord(record) {
  return {
    name: record.name,
    remainingCredits: record.remainingCredits,
    usedCredits: record.usedCredits,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function sanitizeRecord(input) {
  const name = normalizePwName(input?.name);
  const remainingCredits = Number.parseInt(String(input?.remainingCredits ?? 0), 10);
  const usedCredits = Number.parseInt(String(input?.usedCredits ?? 0), 10);
  const createdAt =
    typeof input?.createdAt === "string" && input.createdAt.trim()
      ? input.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof input?.updatedAt === "string" && input.updatedAt.trim()
      ? input.updatedAt
      : createdAt;

  return {
    name,
    remainingCredits: Number.isFinite(remainingCredits) && remainingCredits >= 0 ? remainingCredits : 0,
    usedCredits: Number.isFinite(usedCredits) && usedCredits >= 0 ? usedCredits : 0,
    createdAt,
    updatedAt,
  };
}

async function readStore(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const passwords = Array.isArray(parsed?.passwords)
      ? parsed.passwords.map(sanitizeRecord)
      : [];

    return {
      version: PW_STORE_VERSION,
      passwords,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return getDefaultStore();
    }

    throw error;
  }
}

async function writeStore(filePath, store) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        version: PW_STORE_VERSION,
        passwords: store.passwords.map(cloneRecord),
      },
      null,
      2,
    ),
    "utf8",
  );
}

function withStoreLock(task) {
  const run = storeQueue.then(task, task);
  storeQueue = run.catch(() => {});
  return run;
}

export function normalizePwName(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    throw new Error("请输入 pw 名称");
  }

  if (!PW_NAME_PATTERN.test(normalized)) {
    throw new Error("pw 名称仅支持小写字母、数字、连字符和下划线，且需以字母或数字开头");
  }

  return normalized;
}

export function buildPwSummary(record) {
  return {
    name: record.name,
    remainingCredits: record.remainingCredits,
    usedCredits: record.usedCredits,
    totalCredits: record.remainingCredits + record.usedCredits,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function ensureSeedPwRecord({ filePath, name, initialCredits = DEFAULT_PW_CREDITS }) {
  if (!String(name || "").trim()) {
    return null;
  }

  return withStoreLock(async () => {
    const normalizedName = normalizePwName(name);
    const store = await readStore(filePath);
    const existingRecord = store.passwords.find((record) => record.name === normalizedName);

    if (existingRecord) {
      return cloneRecord(existingRecord);
    }

    const now = new Date().toISOString();
    const nextRecord = {
      name: normalizedName,
      remainingCredits: initialCredits,
      usedCredits: 0,
      createdAt: now,
      updatedAt: now,
    };

    store.passwords.push(nextRecord);
    await writeStore(filePath, store);

    return cloneRecord(nextRecord);
  });
}

export async function listPwRecords({ filePath }) {
  return withStoreLock(async () => {
    const store = await readStore(filePath);

    return store.passwords
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(cloneRecord);
  });
}

export async function findPwRecord({ filePath, name }) {
  if (!String(name || "").trim()) {
    return null;
  }

  return withStoreLock(async () => {
    const normalizedName = normalizePwName(name);
    const store = await readStore(filePath);
    const record = store.passwords.find((item) => item.name === normalizedName);
    return record ? cloneRecord(record) : null;
  });
}

export async function createPwRecord({ filePath, name, initialCredits = DEFAULT_PW_CREDITS }) {
  return withStoreLock(async () => {
    const normalizedName = normalizePwName(name);
    const parsedInitialCredits = Number.parseInt(String(initialCredits), 10);

    if (!Number.isFinite(parsedInitialCredits) || parsedInitialCredits <= 0) {
      throw new Error("初始额度必须是大于 0 的整数");
    }

    const store = await readStore(filePath);
    const existingRecord = store.passwords.find((record) => record.name === normalizedName);

    if (existingRecord) {
      throw new Error(`pw ${normalizedName} 已存在`);
    }

    const now = new Date().toISOString();
    const nextRecord = {
      name: normalizedName,
      remainingCredits: parsedInitialCredits,
      usedCredits: 0,
      createdAt: now,
      updatedAt: now,
    };

    store.passwords.push(nextRecord);
    await writeStore(filePath, store);

    return cloneRecord(nextRecord);
  });
}

export async function addPwCredits({ filePath, name, amount }) {
  return withStoreLock(async () => {
    const normalizedName = normalizePwName(name);
    const parsedAmount = Number.parseInt(String(amount), 10);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("追加额度必须是大于 0 的整数");
    }

    const store = await readStore(filePath);
    const record = store.passwords.find((item) => item.name === normalizedName);

    if (!record) {
      throw new Error(`pw ${normalizedName} 不存在`);
    }

    record.remainingCredits += parsedAmount;
    record.updatedAt = new Date().toISOString();
    await writeStore(filePath, store);

    return cloneRecord(record);
  });
}

export async function consumePwCredits({ filePath, name, amount = 1 }) {
  return withStoreLock(async () => {
    const normalizedName = normalizePwName(name);
    const parsedAmount = Number.parseInt(String(amount), 10);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("扣减额度必须是大于 0 的整数");
    }

    const store = await readStore(filePath);
    const record = store.passwords.find((item) => item.name === normalizedName);

    if (!record) {
      throw new Error(`pw ${normalizedName} 不存在`);
    }

    if (record.remainingCredits < parsedAmount) {
      throw new Error(`pw ${normalizedName} 剩余额度不足，当前仅剩 ${record.remainingCredits}`);
    }

    record.remainingCredits -= parsedAmount;
    record.usedCredits += parsedAmount;
    record.updatedAt = new Date().toISOString();
    await writeStore(filePath, store);

    return cloneRecord(record);
  });
}

export async function refundPwCredits({ filePath, name, amount = 1 }) {
  return withStoreLock(async () => {
    const normalizedName = normalizePwName(name);
    const parsedAmount = Number.parseInt(String(amount), 10);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("回退额度必须是大于 0 的整数");
    }

    const store = await readStore(filePath);
    const record = store.passwords.find((item) => item.name === normalizedName);

    if (!record) {
      throw new Error(`pw ${normalizedName} 不存在`);
    }

    record.remainingCredits += parsedAmount;
    record.usedCredits = Math.max(0, record.usedCredits - parsedAmount);
    record.updatedAt = new Date().toISOString();
    await writeStore(filePath, store);

    return cloneRecord(record);
  });
}
