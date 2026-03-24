开发和生产默认使用 Vertex ADC 作为后端认证方式。

仓库内只保留两套 Docker Compose 入口：
- 开发：`docker-compose.dev.yml`
- 生产：`docker-compose.yml`

不要再使用 `docker-compose.vertex.yml` 或 `docker-compose.vertex.dev.yml` 这类额外 overlay 文件。

开发和生产都优先使用 Docker，不要手动本地起业务服务。

环境变量约束：
- 项目根目录使用 `.env`
- 首次使用先执行 `cp .env.example .env`
- `.env.example` 是唯一示例来源；不要在这里维护第二份完整 env 模板

Docker + Vertex ADC 约束：
- compose 会挂载宿主机 `${HOME}/.config/gcloud`
- compose 会在容器内设置 `GEMINI_AUTH_MODE=vertex-adc`
- compose 会在容器内设置 `GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json`
- 如果 ADC 文件里已有 `quota_project_id`，通常不需要在 `.env` 里额外填写 `GOOGLE_APPLICATION_CREDENTIALS`、`GOOGLE_CLOUD_PROJECT`、`GOOGLE_CLOUD_LOCATION`、`GOOGLE_CLOUD_QUOTA_PROJECT`
- 只有在 ADC 无法自动推断项目或配额项目时，再按需补充 `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_QUOTA_PROJECT`

认证与数据约束：
- Studio 与生图接口只使用 `x-banana-pw` 请求头认证
- `ACCESS_PASSWORD` 可作为初始 `pw` 种子值
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` 用于登录 `/admin`
- 结果图、请求记录和 `pw` 数据保存在 `storage/`

常用命令：
- 开发启动：`docker compose -f docker-compose.dev.yml up -d --build`
- 开发停止：`docker compose -f docker-compose.dev.yml down`
- 生产启动：`docker compose up -d --build`
- 生产停止：`docker compose down`
- 自测：`npm run self-test`
