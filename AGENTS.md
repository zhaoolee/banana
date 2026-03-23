开发和生产默认使用 Vertex ADC 作为后端认证方式。

仓库内只保留两套 Docker Compose 入口：
- 开发：`docker-compose.dev.yml`
- 生产：`docker-compose.yml`

不要再使用 `docker-compose.vertex.yml` 或 `docker-compose.vertex.dev.yml` 这类额外 overlay 文件。

开发和生产都优先使用 Docker，不要手动本地起业务服务。
