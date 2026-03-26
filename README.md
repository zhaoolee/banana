# Banana Studio 使用SKill生成分镜图片

一款开源的banana生图拼图小工具，适合轻度自媒体条漫爱好者，zhaoolee自用已在🍠涨粉3K，账号[程序员梗图火炬](https://www.xiaohongshu.com/user/profile/566a6d770bf90c7076c1f397), 欢迎品鉴效果。


## Skill生成故事配图

```
使用skill banana-studio-generate 生成分镜图，图片本身不需要任何文字。布局可以自定义，这次使用宽度为1080px的一列四行布局，风格为中国古典水墨，人物统一，李白头像参考图为 https://cdn.fangyuanxiaozhan.com/assets/aaa919414a090a3a8c5e2828b18e213df5e39949b2e657eae427854549337d9a.png

请基于以下四句诗生成分镜：

床前明月光
疑是地上霜
举头望明月
低头思故乡

把诗文作为分镜的配文，配文使用工具的能力
```

![](./README.assets/038077cfca98cb6e45f5604ad9325c74d7e246b5d908e13df0d9831d7f423b65.png)

![](./README.assets/e2b0191bae328df55379e857fa0d0f26c5c978eb0a8b7a49d92748c3acd0fe8f.png)

## 生成小红书条漫

| 程序员饮食LV1到LV7 | 程序员狠话LV1到LV7 |
| --- | --- |
| ![](./README.assets/765bc73f4ffd5f4dbfa28b3e39fad7f46985590ca4bbf7ff7550f4f9b601990d.png) | ![](./README.assets/9d16e4ba79e375c179d3ea0e6f4bf2b704d1a8b7a7a57a2c5f079f002a5fbcde.png) |




## 解决的痛点

- 一个格子效果有问题，就只重新生成一小格，省钱！
- 隔离上下文污染，为单个格子提供参考图，比如banana不认识cursor的图标，就可以对单格提供cursor图标
- 消除中文鬼画符现象，将图片里面的文字拆分到input，让生图模型只负责
- 支持自定义画板尺寸，动态调整行列格子数
- 根据小格长宽比，自动化匹配最接近的生图长宽比，减少生图的画面裁剪


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
