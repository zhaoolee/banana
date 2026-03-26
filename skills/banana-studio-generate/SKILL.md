---
name: banana-studio-generate
description: Use when generating images through the Banana Studio backend with pw authentication. Supports prompt-only usage, storyboard file workflows with tool-rendered captions, and frontend-compatible modelId, imageOptions, layoutGuideImage, and referenceImages.
---

# Banana Studio Generate

Use this skill when you need to generate images through the Banana Studio backend instead of calling a model provider directly.

## What it does

- Sends `pw` directly on backend requests
- Uses the same direct `pw` auth path as the Studio frontend, via `x-banana-pw`
- Calls `POST /api/generate/stream` with the same request shape as the frontend
- Supports prompt-only runs
- Supports storyboard-file runs that generate each cell separately and render captions with the tool via `POST /api/export/professional-preview`
- Storyboard layouts are customizable; the bundled markdown files are examples, not fixed presets
- In storyboard mode, the script automatically chooses the closest supported image aspect ratio for each cell based on canvas size and row/column layout, which reduces export-time cropping
- Supports the same request fields the frontend sends:
  - `prompt`
  - `modelId`
  - `imageOptions.aspectRatio`
  - `imageOptions.imageSize`
  - `imageOptions.layoutRows`
  - `imageOptions.layoutColumns`
  - `layoutGuideImage`
  - `referenceImages`
- Supports reference images from either local file paths or remote `http(s)` image URLs

## Default workflow

Run the bundled script at `scripts/banana_studio_generate.mjs`:

```bash
node /absolute/path/to/banana_studio_generate.mjs --prompt "A banana astronaut on the moon"
```

For captioned storyboard exports, pass `--storyboard-file`:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --storyboard-file /abs/path/jingyesi-4-panel.md
```

If you need a different layout than the file's default, override it explicitly:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --storyboard-file /abs/path/jingyesi-4-panel.md \
  --layout-rows 4 \
  --layout-columns 1
```

For prompt-only usage, set a default pw once:

```bash
export BANANA_STUDIO_PW="your-pw"
```

You can also put a local `.env` file beside `SKILL.md` and `scripts/`:

```env
BANANA_STUDIO_PW=your-pw
BANANA_STUDIO_API_BASE_URL=http://127.0.0.1:23001
```

Optional env vars:

```bash
export BANANA_STUDIO_API_BASE_URL="http://127.0.0.1:3001"
export BANANA_STUDIO_PW="your-pw"
```

## Common variants

Override pw explicitly:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --prompt "A banana astronaut on the moon" \
  --pw "test-banana"
```

Pass frontend-style options directly:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --prompt "A vertical comic about a banana detective" \
  --pw "test-banana" \
  --model-id "nano-banana-2" \
  --aspect-ratio "1:8" \
  --image-size "2K" \
  --layout-rows 7 \
  --layout-columns 1
```

Attach local images by file path:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --prompt "Use the references for style and character design" \
  --pw "test-banana" \
  --reference-image /abs/path/ref-1.png \
  --reference-image /abs/path/ref-2.jpg \
  --layout-guide /abs/path/layout-guide.png
```

Attach remote reference images by URL:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --prompt "Use the portrait as the character reference" \
  --pw "test-banana" \
  --reference-image "https://cdn.example.com/libai.png"
```

Send an exact frontend-compatible payload:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --pw "test-banana" \
  --payload-file /abs/path/payload.json
```

`payload.json` can contain the same JSON shape the frontend posts to `/api/generate/stream`.

Storyboard markdown format:

```md
---
title: 静夜思四格
globalStylePrompt: 中国古典水墨插画，唐风卧房夜景，月色柔和，留白克制，统一人物形象与服饰
canvasWidth: 1080
canvasHeight: 1440
layoutRows: 2
layoutColumns: 2
aspectRatio: 3:4
imageSize: 1K
---
| row | column | content | caption |
| --- | --- | --- | --- |
| 1 | 1 | 古代卧房，木床与窗棂，皎洁月光洒在床前，诗人刚刚醒来，神情安静 | 床前明月光 |
| 1 | 2 | 地面被月光照亮，如同覆着一层清霜，诗人低头凝视地面，室内静谧清冷 | 疑是地上霜 |
| 2 | 1 | 诗人缓缓举头望向窗外明月，夜空澄净，月轮高悬，构图清朗 | 举头望明月 |
| 2 | 2 | 诗人低头沉思故乡，神情含蓄克制，背景隐约浮现远方家园与夜色意象 | 低头思故乡 |
```

Vertical 1x4 example:

`assets/jingyesi-1x4.md`

## Layout notes

- Storyboard layout is customizable; you are not limited to the bundled examples.
- `assets/jingyesi-4-panel.md` and `assets/jingyesi-1x4.md` are only example templates.
- You can create your own storyboard file with any reasonable `layoutRows`, `layoutColumns`, canvas size, panel content, and captions.
- You can also override a storyboard file's default layout at runtime with `--layout-rows` and `--layout-columns`.

## Output

The script:

- streams backend status to stderr
- saves the generated image under `./storage/skill-runs/...` by default
- writes a `result.json` summary beside the image
- in storyboard mode, writes a captioned final `result.png` rendered by the tool instead of relying on the model to paint text
- also writes a zip asset package beside the image, including `result.png`, `result.json`, `request.payload.json`, and extracted reference/layout images
- prints a concise JSON summary to stdout

## Notes

- If `--pw` is omitted, the script reads `BANANA_STUDIO_PW`.
- If `BANANA_STUDIO_PW` is also omitted, the script loads `.env` from the skill directory and reads `BANANA_STUDIO_PW`.
- If `--api-base-url` is omitted, the script reads `BANANA_STUDIO_API_BASE_URL` and falls back to `http://127.0.0.1:3001`.
- The local skill config uses standard dotenv / `.env` format with `KEY=value` entries such as `BANANA_STUDIO_PW=...`.
- The script defaults to `modelId: "nano-banana-2"` and frontend-like image defaults when you do not provide them.
- `--reference-image` and `--layout-guide` accept either a local file path or a remote image URL.
- In `payload.json`, `referenceImages` and `layoutGuideImage` may be passed as embedded frontend-style objects, local paths, or remote image URLs.
- When the user asks for per-panel captions, prefer `--storyboard-file` so captions are rendered by the tool and the generated images themselves can stay text-free.
- In storyboard mode, the script derives a near-matching cell aspect ratio from `canvasWidth / layoutColumns` and `canvasHeight / layoutRows`, then adds a prompt hint to keep the subject inside a safe area so final export cropping is reduced.
- In storyboard mode, `--layout-rows` and `--layout-columns` override the file's layout and reflow cells by order, which avoids accidental 2x2/1x4 mismatches.
- If storyboard coordinates fall outside the configured layout or collide, the script now throws an error instead of silently clamping them.
- The printed result JSON includes `assetPackagePath` so callers can return a downloadable zip together with `result.png` and `result.json`.
- When the user gives a reference image URL in natural language, treat it as a `referenceImages` input rather than leaving it only inside the prompt text.
- When Codex uses this skill, resolve `scripts/banana_studio_generate.mjs` relative to the skill directory instead of assuming a repo-local `skills/` folder.
