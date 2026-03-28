# Playwright 回归说明

目录约定：

- `tests/e2e/fixtures`：共享 test fixture，例如控制台报错守卫
- `tests/e2e/helpers`：mock、导航、测试工具函数
- `tests/e2e/smoke`：基础回归用例，`npm run self-test` 默认只跑这里带 `@smoke` 的 case

常用命令：

```bash
npm run self-test
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run self-test:install
```

新增功能时建议：

1. 先把接口加入 `tests/e2e/helpers/mockApi.js`
2. 再按功能新增一个独立 `*.spec.js`
3. 基础链路放 `@smoke`，重场景回归放普通 e2e
4. 发现前端运行时报错时，不要绕过；让 `fixtures/test.js` 里的客户端报错守卫直接失败
