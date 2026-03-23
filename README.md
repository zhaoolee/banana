# Banana Studio

- 前端：React + Vite
- 后端：Express
- 能力：`pw` 提取码登录、管理员面板、多图参考生图、清晰度提升、后端代理 Gemini 图像生成

## 环境变量

项目根目录使用 `.env`：

```bash
GEMINI_API_KEY=your-key
GEMINI_AUTH_MODE=api-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ACCESS_PASSWORD=banana
ADMIN_TOKEN_TTL_MINUTES=720
GEMINI_MODEL_NANO_BANANA=gemini-2.5-flash-image
GEMINI_MODEL_NANO_BANANA_PRO=gemini-3-pro-image-preview
GEMINI_MODEL_NANO_BANANA_2=gemini-3.1-flash-image-preview
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=global
GOOGLE_CLOUD_QUOTA_PROJECT=
PORT=23001
```

说明：

- `GEMINI_AUTH_MODE` 支持 `api-key` 和 `vertex-adc`
- `api-key` 模式读取 `GEMINI_API_KEY`
- `vertex-adc` 模式优先读取 `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_QUOTA_PROJECT`
- 如果 `vertex-adc` 模式没有显式传 `GOOGLE_CLOUD_PROJECT`，后端会尝试从可读取的 `application_default_credentials.json` 的 `quota_project_id` 自动推断
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` 用于登录 `/admin`
- `ACCESS_PASSWORD` 是可选的初始 `pw` 种子值，服务启动时会自动创建同名 `pw`
- Studio 与生图接口只使用 `x-banana-pw` 请求头认证
- 管理员可继续创建更多 `pw`，每个新 `pw` 默认有 `100` 张额度
- `pw` 额度会在每次成功生图或提升清晰度时扣减 `1`
- 结果图、提示词和元数据会保存到 `storage/generations/`

## Docker 开发

启动：

```bash
docker compose -f docker-compose.dev.yml up --build
```

访问：

- 登录页：`http://127.0.0.1:5173/login`
- 工作台：`http://127.0.0.1:5173/studio`
- 管理员页：`http://127.0.0.1:5173/admin`
- 后端：`http://127.0.0.1:23001`

说明：

- 前端容器运行 Vite，支持 HMR
- 后端容器运行 Express，并使用 `node --watch` 自动重启
- 源码通过 volume 挂载到容器内，修改本地文件会直接生效
- `.env` 会挂载进容器
- 前端通过 `VITE_API_PROXY_TARGET=http://backend:23001` 代理到后端
- 开发模式默认挂载宿主机 `${HOME}/.config/gcloud/application_default_credentials.json`
- 开发模式默认使用 `GEMINI_AUTH_MODE=vertex-adc`

停止：

```bash
docker compose -f docker-compose.dev.yml down
```

带提取码访问示例：

```bash
http://127.0.0.1:5173/login?pw=banana
```

## Playwright 自测

安装 Chromium（首次执行需要）：

```bash
npm run self-test:install
```

执行自测：

```bash
npm run self-test
```

说明：

- 自测会先执行 `vite build`，再启动本地 `vite dev`
- 浏览器层使用 Playwright
- `/api/access/session` 和 `/api/models` 会在浏览器里被 mock，不消耗真实 Vertex / Gemini 额度
- 当前默认包含 2 条烟测：
  - 根路径跳转到 `/login`
  - 专业模式场景包导入 / 导出

## Docker 生产部署

项目根目录提供：

- [Dockerfile](./Dockerfile)
- [docker-compose.yml](./docker-compose.yml)

启动：

```bash
docker compose up -d --build
```

### Vertex 启动方案

适用场景：

- 本地 macOS 已执行 `gcloud auth application-default login`
- Linux 服务器已经有可用的 ADC 文件
- 希望直接复用宿主机 `${HOME}/.config/gcloud/application_default_credentials.json`

前提：

```bash
ls ${HOME}/.config/gcloud/application_default_credentials.json
```

如果文件存在，开发和生产 compose 都会默认：

- 挂载 `${HOME}/.config/gcloud/application_default_credentials.json`
- 设置 `GEMINI_AUTH_MODE=vertex-adc`
- 设置 `GOOGLE_APPLICATION_CREDENTIALS=/app/.config/gcloud/application_default_credentials.json`
- 默认使用 `GOOGLE_CLOUD_LOCATION=global`

启动：

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs --tail=50 banana
curl -sS http://127.0.0.1:23001/api/health
```

正常情况下，你会在日志或健康检查里看到：

- `authMode: vertex-adc`
- `backend: vertex-ai`
- `credentialsConfigured: true`

补充说明：

- 如果 ADC 文件里带有 `quota_project_id`，并且后端能读到该文件，通常可以自动推断 `GOOGLE_CLOUD_PROJECT`
- 如果你使用的不是 `gcloud auth application-default login` 生成的 ADC，而是其他 JSON 凭据，可能仍需要在 `.env` 里显式设置 `GOOGLE_CLOUD_PROJECT`
- 开发和生产 compose 都保留 `${HOME}`，方便本地 macOS 和 Linux 服务器复用同一套启动方式
- 这套模式只影响“后端到 Google”的认证方式；前端访问你自己的后端仍然使用 `x-banana-pw`

访问：

- 登录页：`http://服务器IP:23001/login`
- 工作台：`http://服务器IP:23001/studio`
- 管理员页：`http://服务器IP:23001/admin`

说明：

- 生产镜像会先构建前端，再由 Express 统一托管 `dist`
- `./storage:/app/storage` 是持久化卷，保存 `pw-store.json`、日志和生成结果
- 用户侧接口认证只走 `x-banana-pw`
- 如果前面挂了 Nginx 或 Caddy，记得保留 `x-banana-pw` 请求头
- 生产 compose 默认挂载宿主机 `${HOME}/.config/gcloud/application_default_credentials.json`
- 只要你的 ADC 文件里带有 `quota_project_id`，通常不需要再额外传 `GOOGLE_CLOUD_PROJECT`
