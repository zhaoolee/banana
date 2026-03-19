# Banana Studio

- 前端：React + Vite
- 后端：Express
- 能力：`pw` 提取码登录、管理员面板、多图参考生图、清晰度提升、后端代理 Gemini 图像生成

## 环境变量

项目根目录使用 `.env`：

```bash
GEMINI_API_KEY=your-key
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

停止：

```bash
docker compose -f docker-compose.dev.yml down
```

带提取码访问示例：

```bash
http://127.0.0.1:5173/login?pw=banana
```

## Docker 生产部署

项目根目录提供：

- [Dockerfile](/Users/zhaoolee/github/banana/Dockerfile)
- [docker-compose.yml](/Users/zhaoolee/github/banana/docker-compose.yml)

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
- 用户侧接口认证只走 `x-banana-pw`
- 如果前面挂了 Nginx 或 Caddy，记得保留 `x-banana-pw` 请求头
