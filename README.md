# Banana Studio

一个参考 `notes` 项目组织方式初始化的单仓项目：

- 前端：React + Vite
- 后端：Express
- 能力：提取码验证、`pw` URL 参数自动填充、banana 生图工作台、多图参考输入、后端代理 Gemini 图像生成

## 环境变量

项目根目录使用 `.env`：

```bash
GEMINI_API_KEY=AIzaSy***********mVg
ACCESS_PASSWORD=banana
ACCESS_TOKEN_TTL_MINUTES=720
GEMINI_MODEL_NANO_BANANA=gemini-2.5-flash-image
GEMINI_MODEL_NANO_BANANA_PRO=gemini-3-pro-image-preview
GEMINI_MODEL_NANO_BANANA_2=gemini-3.1-flash-image-preview
PORT=3001
```

说明：

- `GEMINI_API_KEY` 由后端读取
- `ACCESS_PASSWORD` 是提取码
- 3 个底模分别映射到 `Nano Banana`、`Nano Banana Pro`、`Nano Banana 2`
- 如需调整实际调用的 Gemini model id，可以修改对应的 `GEMINI_MODEL_*` 环境变量
- 每次成功生成后，后端会自动把结果图、输入提示词、输出文本和元数据保存到 `storage/generations/`

## Docker 开发

启动：

```bash
docker compose -f docker-compose.dev.yml up --build
```

访问：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:3001`

说明：

- 前端容器运行 Vite，支持 HMR
- 后端容器运行 Express，并使用 `node --watch` 自动重启
- 源码通过 volume 挂载到容器内，修改本地文件会直接生效
- `.env` 会随项目目录一起挂载，后端容器内可直接读取 `GEMINI_API_KEY`
- 前端通过 `VITE_API_PROXY_TARGET=http://backend:3001` 代理到后端容器

停止：

```bash
docker compose -f docker-compose.dev.yml down
```

带提取码访问示例：

```bash
http://127.0.0.1:5173/?pw=banana
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

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:3001`

## 生产构建

```bash
npm run build
node server/index.js
```

构建后如果 `dist/index.html` 存在，Express 会自动托管前端静态资源。
