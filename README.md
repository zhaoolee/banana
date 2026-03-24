# Banana Studio

一款开源的banana生图拼图小工具，适合轻度自媒体条漫爱好者，zhaoolee自用已在🍠涨粉3K，账号[程序员梗图火炬](https://www.xiaohongshu.com/user/profile/566a6d770bf90c7076c1f397), 欢迎品鉴效果。



| 程序员饮食LV1到LV7 | 程序员狠话LV1到LV7 |
| --- | --- |
| ![](./README.assets/765bc73f4ffd5f4dbfa28b3e39fad7f46985590ca4bbf7ff7550f4f9b601990d.png) | ![](./README.assets/9d16e4ba79e375c179d3ea0e6f4bf2b704d1a8b7a7a57a2c5f079f002a5fbcde.png) |


## 解决的痛点

- 一个格子效果有问题，就只重新生成一小格，省钱！
- 隔离上下文污染，为单个格子提供参考图，比如banana不认识cursor的图标，就可以对单格提供cursor图标
- 消除中文鬼画符现象，将图片里面的文字拆分到input，让生图模型只负责
- 支持自定义画板尺寸，动态调整行列格子数
- 根据小格长宽比，自动化匹配最接近的生图长宽比，减少生图的画面裁剪

```
专业模式分享

参数

底模：Gemini 3.1 Flash Image Preview

常用场景：程序员LV1到LV7

分镜布局：7 行 × 1 列

图片比例：16:9

分辨率：1K

分割线：0px

配文字号：240%

整体画风参考图：程序员爱机LV1到LV7.png



全局提示词与画风参考图

不出现任何文字，火柴人画风



分镜提示词与配文

第 1 格｜行 1 / 列 1
提示词：一个程序员在工位前喝苏打水，苏打水参考下图
配文：LV1不喝可乐喝苏打水
格子参考图：image.png

第 2 格｜行 2 / 列 1
提示词：一个程序员在茶水间剥皮鸡蛋，还有一杯牛奶，准备健康进餐
配文：LV2优质零食茶叶蛋
格子参考图：未设置

第 3 格｜行 3 / 列 1
提示词：一个人在户外的草坪观景斜坡，惬意的坐着，左手拿着勺子，右手拿着酸奶杯子，开始品尝无糖酸奶
配文：LV3改善下午嘴馋无糖酸奶
格子参考图：未设置

第 4 格｜行 4 / 列 1
提示词：一个程序员在小餐桌上吃蒸熟的红薯，桌面餐盘还有蒸玉米，旁边放着一杯牛奶
配文：LV4玉米🌽红薯🍠更稳的碳水
格子参考图：未设置

第 5 格｜行 5 / 列 1
提示词：一个程序员在一个阳光照进茶水间的中午，吃一份鸡胸肉沙拉
配文：LV5鸡胸肉沙拉高蛋白、低负担
格子参考图：未设置

第 6 格｜行 6 / 列 1
提示词：一个程序员打开一个精致的饭盒，里面放着三文鱼 + 西兰花
配文：LV6高质量营养三文鱼+西兰花（朋友圈开始出现西兰花）
格子参考图：未设置

第 7 格｜行 7 / 列 1
提示词：一个黄毛洛丽塔粉色裙程序员，正在厨房为自己明天三餐配餐，里面包含牛肉，鸡胸肉，三文鱼，茶叶蛋，红薯，有三个小盒子，每顿吃一盒
配文：LV7进入“自己配餐”的可怕阶段
格子参考图：未设置
```

每个格子都可以上传独立的参考图，方便生图

| 生图效果 | 参考图 |
| --- | --- |
| ![](./README.assets/1c21b99022763f4e0d27e4c13b3cdcfec24ccd3dc141d986c1fb77e331a35a0f.png) | ![](./README.assets/dbe815b0322e3015da26f74c9ea056da0faf2c2ac0a82add3eca3632bbb06878.png) |


![](./README.assets/f5b2ce343b1ae2a1400f6fc54462e0f47a4bfe93818407e8c63d8c9640c90b3e.png)

- 支持实时预览导出效果

![](./README.assets/7a1382db7270612d01e6427d2f7df5d63af0035f1780958c55fbeeef9ed3adcb.png)

- 支持通过提取码分享给朋友

![](./README.assets/8b7cd50e9078941bdb2d86245f712a21814642679a9d9aba5e5e2917461bdbba.png)


## 部署方式

运行 gcloud auth application-default login 完成登陆，获取Vertex ADC认证文件
保证 `${HOME}/.config/gcloud/application_default_credentials.json` 存在

```
git clone https://github.com/zhaoolee/banana
cd banana
cp .env.example .env
# 按需修改 .env 中的配置
docker compose up -d --build
```
启动成功后即可在 http://127.0.0.1:23001 访问, 输入默认提取码 banana 即可
