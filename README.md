# Banana Studio

一个参考 `notes` 项目组织方式初始化的单仓项目：

- 前端：React + Vite
- 后端：Express
- 能力：提取码验证、`pw` URL 参数自动填充、banana 生图工作台、多图参考输入、后端代理 Gemini 图像生成

## 环境变量

项目根目录使用 `.env`：

```bash
GEMINI_API_KEY=AIzaSy***********mVg
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ACCESS_PASSWORD=banana
ADMIN_TOKEN_TTL_MINUTES=720
GEMINI_MODEL_NANO_BANANA=gemini-2.5-flash-image
GEMINI_MODEL_NANO_BANANA_PRO=gemini-3-pro-image-preview
GEMINI_MODEL_NANO_BANANA_2=gemini-3.1-flash-image-preview
PORT=23001
```

说明：

- `GEMINI_API_KEY` 由后端读取
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` 用于登录 `/admin` 管理员页面
- `ACCESS_PASSWORD` 现在是可选的初始 `pw` 种子值。服务启动时若该值存在，会自动创建一个同名 `pw`，默认额度为 `100`
- Studio 与生图接口现在只使用 `x-banana-pw` 请求头认证
- 管理员可在 `/admin` 页面继续创建更多 `pw`，每个新 `pw` 默认也有 `100` 张图片额度
- `pw` 额度会在每次成功调用生图或清晰度提升时扣减 `1`
- 3 个底模分别映射到 `gemini-2.5-flash-image`、`gemini-3.1-flash-image-preview`、`gemini-3-pro-image-preview`
- 如需调整实际调用的 Gemini model id，可以修改对应的 `GEMINI_MODEL_*` 环境变量
- `gemini-3.1-flash-image-preview` 与 `gemini-3-pro-image-preview` 支持前端分辨率选择 `1K / 2K / 4K`
- `gemini-2.5-flash-image` 当前只支持固定 `1K`
- 每次成功生成后，后端会自动把结果图、输入提示词、输出文本和元数据保存到 `storage/generations/`

## Docker 开发

启动：

```bash
docker compose -f docker-compose.dev.yml up --build
```

访问：

- 提取码页：`http://127.0.0.1:5173/login`
- 工作台：`http://127.0.0.1:5173/studio`
- 后端：`http://127.0.0.1:23001`
- 管理员页面：`http://127.0.0.1:5173/admin`

说明：

- 前端容器运行 Vite，支持 HMR
- 后端容器运行 Express，并使用 `node --watch` 自动重启
- 源码通过 volume 挂载到容器内，修改本地文件会直接生效
- `.env` 会随项目目录一起挂载，后端容器内可直接读取 `GEMINI_API_KEY`
- 前端通过 `VITE_API_PROXY_TARGET=http://backend:23001` 代理到后端容器

停止：

```bash
docker compose -f docker-compose.dev.yml down
```

带提取码访问示例：

```bash
http://127.0.0.1:5173/login?pw=banana
```

## 本地非 Docker 开发

安装依赖：

```bash
npm install
```

启动后端：

```bash
npm run backend:watch
```

启动前端：

```bash
npm run dev
```

访问：

- 提取码页：`http://127.0.0.1:5173/login`
- 工作台：`http://127.0.0.1:5173/studio`
- 后端：`http://127.0.0.1:23001`
- 管理员页面：`http://127.0.0.1:5173/admin`

## 生产构建

```bash
npm run build
node server/index.js
```

构建后如果 `dist/index.html` 存在，Express 会自动托管前端静态资源。

## Docker 生产部署

项目根目录现在提供了生产用 [Dockerfile](/Users/zhaoolee/github/banana/Dockerfile) 和 [docker-compose.yml](/Users/zhaoolee/github/banana/docker-compose.yml)。

准备：

```bash
cp .env.example .env
```

然后补齐至少这些环境变量：

```bash
GEMINI_API_KEY=your-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ACCESS_PASSWORD=banana
PORT=23001
```

启动：

```bash
docker compose up -d --build
```

访问：

- 登录页：`http://服务器IP:23001/login`
- 工作台：`http://服务器IP:23001/studio`
- 管理员页：`http://服务器IP:23001/admin`

说明：

- 生产镜像会先构建前端，再由 Express 统一托管 `dist`
- `./storage:/app/storage` 是持久化卷，保存 `pw-store.json`、日志和生成结果
- 用户侧接口认证现在只走 `x-banana-pw`
- 如果你前面还挂了 Nginx 或 Caddy，记得保留 `x-banana-pw` 请求头
