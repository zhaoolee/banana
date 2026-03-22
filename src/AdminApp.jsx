import { useEffect, useMemo, useState } from "react";

const ADMIN_TOKEN_STORAGE_KEY = "banana.adminToken";
const ADMIN_EXPIRES_STORAGE_KEY = "banana.adminExpiresAt";

function readSessionValue(key) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeSessionValue(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!value) {
      window.sessionStorage.removeItem(key);
      return;
    }

    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore session storage failures and keep UI usable.
  }
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return response.json();
}

async function requestAdmin(endpoint, options = {}) {
  const response = await fetch(endpoint, options);
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || "管理员请求失败");
  }

  return payload;
}

async function loginAdmin(username, password) {
  return requestAdmin("/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
}

async function fetchAdminSession(adminToken) {
  return requestAdmin("/api/admin/session", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
}

async function fetchPasswords(adminToken) {
  return requestAdmin("/api/admin/pws", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
}

async function createPassword(adminToken, name) {
  return requestAdmin("/api/admin/pws", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name }),
  });
}

async function addCredits(adminToken, name, amount) {
  return requestAdmin(`/api/admin/pws/${encodeURIComponent(name)}/credits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ amount }),
  });
}

function formatDateTime(value) {
  if (!value) {
    return "未记录";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function upsertPassword(list, nextRecord) {
  return list
    .filter((item) => item.name !== nextRecord.name)
    .concat(nextRecord)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function AdminApp() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminToken, setAdminToken] = useState(() => readSessionValue(ADMIN_TOKEN_STORAGE_KEY));
  const [adminExpiresAt, setAdminExpiresAt] = useState(() =>
    readSessionValue(ADMIN_EXPIRES_STORAGE_KEY),
  );
  const [sessionState, setSessionState] = useState(() =>
    readSessionValue(ADMIN_TOKEN_STORAGE_KEY) ? "checking" : "locked",
  );
  const [sessionError, setSessionError] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [passwords, setPasswords] = useState([]);
  const [listPending, setListPending] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creditDrafts, setCreditDrafts] = useState({});
  const [creditPendingName, setCreditPendingName] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  useEffect(() => {
    if (!adminToken) {
      setSessionState("locked");
      return;
    }

    let cancelled = false;

    async function restoreSession() {
      try {
        const data = await fetchAdminSession(adminToken);

        if (cancelled) {
          return;
        }

        setSessionState("ready");
        setAdminExpiresAt(String(data.expiresAt || ""));
        setSessionError("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        writeSessionValue(ADMIN_TOKEN_STORAGE_KEY, "");
        writeSessionValue(ADMIN_EXPIRES_STORAGE_KEY, "");
        setAdminToken("");
        setAdminExpiresAt("");
        setSessionState("locked");
        setSessionError(error instanceof Error ? error.message : "管理员会话恢复失败");
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  useEffect(() => {
    if (sessionState !== "ready" || !adminToken) {
      return;
    }

    let cancelled = false;

    async function loadPasswords() {
      setListPending(true);

      try {
        const data = await fetchPasswords(adminToken);

        if (cancelled) {
          return;
        }

        setPasswords(Array.isArray(data.passwords) ? data.passwords : []);
        setPageMessage("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPageMessage(error instanceof Error ? error.message : "加载 pw 列表失败");
      } finally {
        if (!cancelled) {
          setListPending(false);
        }
      }
    }

    void loadPasswords();

    return () => {
      cancelled = true;
    };
  }, [adminToken, sessionState]);

  const totals = useMemo(() => {
    return passwords.reduce(
      (summary, item) => {
        summary.remainingCredits += item.remainingCredits || 0;
        summary.usedCredits += item.usedCredits || 0;
        summary.totalCredits += item.totalCredits || 0;
        return summary;
      },
      {
        remainingCredits: 0,
        usedCredits: 0,
        totalCredits: 0,
      },
    );
  }, [passwords]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginPending(true);
    setSessionError("");
    setPageMessage("");

    try {
      const data = await loginAdmin(username, password);
      writeSessionValue(ADMIN_TOKEN_STORAGE_KEY, data.adminToken || "");
      writeSessionValue(ADMIN_EXPIRES_STORAGE_KEY, String(data.expiresAt || ""));
      setAdminToken(data.adminToken || "");
      setAdminExpiresAt(String(data.expiresAt || ""));
      setSessionState("ready");
      setPassword("");
    } catch (error) {
      setSessionState("locked");
      setSessionError(error instanceof Error ? error.message : "管理员登录失败");
    } finally {
      setLoginPending(false);
    }
  }

  function handleLogout() {
    writeSessionValue(ADMIN_TOKEN_STORAGE_KEY, "");
    writeSessionValue(ADMIN_EXPIRES_STORAGE_KEY, "");
    setAdminToken("");
    setAdminExpiresAt("");
    setSessionState("locked");
    setPasswords([]);
    setCreditDrafts({});
    setPageMessage("");
  }

  async function handleCreatePassword(event) {
    event.preventDefault();

    if (!adminToken) {
      return;
    }

    setCreatePending(true);
    setCreateError("");
    setPageMessage("");

    try {
      const data = await createPassword(adminToken, createName);
      setPasswords((currentValue) => upsertPassword(currentValue, data.pw));
      setCreateName("");
      setPageMessage(`已创建 pw ${data.pw.name}，默认额度 ${data.pw.remainingCredits}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "创建 pw 失败");
    } finally {
      setCreatePending(false);
    }
  }

  async function handleAddCredits(name) {
    if (!adminToken) {
      return;
    }

    const amount = Number.parseInt(String(creditDrafts[name] || ""), 10);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPageMessage("请输入大于 0 的整数额度");
      return;
    }

    setCreditPendingName(name);
    setPageMessage("");

    try {
      const data = await addCredits(adminToken, name, amount);
      setPasswords((currentValue) => upsertPassword(currentValue, data.pw));
      setCreditDrafts((currentValue) => ({
        ...currentValue,
        [name]: "",
      }));
      setPageMessage(`已为 ${name} 增加 ${amount} 张额度`);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : "追加额度失败");
    } finally {
      setCreditPendingName("");
    }
  }

  if (sessionState === "checking") {
    return (
      <div className="page-shell">
        <main className="status-card admin-status-card">
          <p className="eyebrow">BANANA ADMIN</p>
          <h1>正在恢复管理员会话</h1>
          <p>如果当前 token 仍有效，会自动进入管理员面板。</p>
        </main>
      </div>
    );
  }

  if (sessionState !== "ready") {
    return (
      <div className="page-shell">
        <main className="gate-layout admin-gate-layout">
          <section className="gate-hero admin-hero">
            <p className="eyebrow">BANANA ADMIN</p>
            <h1>管理员面板</h1>
            <p className="hero-copy">
              使用环境变量里的管理员用户名和密码登录。登录后可创建多个 `pw`，
              每个新 `pw` 默认 100 张图片额度，并支持后续追加。
            </p>
            <div className="hero-tags">
              <span>多 pw 管理</span>
              <span>额度追加</span>
              <span>剩余额度</span>
            </div>
          </section>

          <section className="gate-panel">
            <form className="gate-form" onSubmit={handleLogin}>
              <label htmlFor="admin-username">管理员用户名</label>
              <input
                id="admin-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入管理员用户名"
              />

              <label htmlFor="admin-password">管理员密码</label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入管理员密码"
              />

              <button type="submit" disabled={loginPending || !username.trim() || !password.trim()}>
                {loginPending ? "登录中..." : "登录管理员面板"}
              </button>
            </form>

            {sessionError ? <p className="error-text">{sessionError}</p> : null}

            <p className="panel-note">
              普通生图入口：
              <a className="admin-inline-link" href="/login">
                返回 banana Studio
              </a>
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell admin-shell">
      <header className="studio-topbar admin-topbar">
        <div className="studio-brand studio-brand-with-copy">
          <img className="studio-brand-logo" src="/logo.png" alt="Banana Studio" />
          <div>
          <p className="eyebrow">BANANA ADMIN</p>
          <h1>PW 管理面板</h1>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <div className="admin-session-meta">
            <strong>{passwords.length}</strong>
            <span>个 pw</span>
            <small>会话到期：{formatDateTime(adminExpiresAt)}</small>
          </div>
          <a className="ghost-button admin-nav-link" href="/login">
            返回 Studio
          </a>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      <main className="admin-layout">
        <section className="studio-panel admin-summary-panel">
          <div className="section-title">
            <h2>额度总览</h2>
            <p>当前所有 `pw` 的累计额度、已使用和剩余量。</p>
          </div>

          <div className="admin-summary-grid">
            <article className="admin-metric-card">
              <span>PW 数量</span>
              <strong>{passwords.length}</strong>
            </article>
            <article className="admin-metric-card">
              <span>总额度</span>
              <strong>{totals.totalCredits}</strong>
            </article>
            <article className="admin-metric-card">
              <span>剩余额度</span>
              <strong>{totals.remainingCredits}</strong>
            </article>
            <article className="admin-metric-card">
              <span>已使用</span>
              <strong>{totals.usedCredits}</strong>
            </article>
          </div>
        </section>

        <section className="studio-panel admin-create-panel">
          <div className="section-title">
            <h2>创建新 PW</h2>
            <p>每个新建 `pw` 默认发放 100 张图片额度。</p>
          </div>

          <form className="admin-create-form" onSubmit={handleCreatePassword}>
            <input
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="例如 banana、banana_vip"
            />
            <button type="submit" disabled={createPending || !createName.trim()}>
              {createPending ? "创建中..." : "创建 pw"}
            </button>
          </form>

          {createError ? <p className="error-text">{createError}</p> : null}
          {pageMessage ? <p className="panel-note">{pageMessage}</p> : null}
        </section>

        <section className="studio-panel admin-passwords-panel">
          <div className="section-title">
            <h2>PW 列表</h2>
            <p>查看每个 `pw` 的剩余量，并按需追加额度。</p>
          </div>

          {listPending ? <p className="panel-note">正在加载 pw 列表...</p> : null}

          {!listPending && passwords.length === 0 ? (
            <div className="empty-state admin-empty-state">
              <strong>还没有可用 pw</strong>
              <small>先创建一个，默认就会带 100 张额度。</small>
            </div>
          ) : null}

          <div className="admin-password-list">
            {passwords.map((item) => (
              <article className="admin-password-card" key={item.name}>
                <div className="admin-password-head">
                  <div>
                    <strong>{item.name}</strong>
                    <span>创建于 {formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="admin-password-badge">
                    <span>剩余</span>
                    <strong>{item.remainingCredits}</strong>
                  </div>
                </div>

                <div className="admin-password-stats">
                  <span>总额度 {item.totalCredits}</span>
                  <span>已使用 {item.usedCredits}</span>
                  <span>最近更新 {formatDateTime(item.updatedAt)}</span>
                </div>

                <form
                  className="admin-credit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAddCredits(item.name);
                  }}
                >
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={creditDrafts[item.name] || ""}
                    onChange={(event) =>
                      setCreditDrafts((currentValue) => ({
                        ...currentValue,
                        [item.name]: event.target.value,
                      }))
                    }
                    placeholder="增加额度"
                  />
                  <button
                    type="submit"
                    disabled={creditPendingName === item.name || !String(creditDrafts[item.name] || "").trim()}
                  >
                    {creditPendingName === item.name ? "提交中..." : "追加额度"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminApp;
