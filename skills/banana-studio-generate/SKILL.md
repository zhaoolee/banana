---
name: banana-studio-generate
description: Use when generating images through the Banana Studio backend with pw authentication. Supports prompt-only usage after configuring a default pw, plus frontend-compatible modelId, imageOptions, layoutGuideImage, and referenceImages.
---

# Banana Studio Generate

Use this skill when you need to generate images through the Banana Studio backend instead of calling a model provider directly.

## What it does

- Sends `pw` directly on backend requests
- Uses the same direct `pw` auth path as the Studio frontend, via `x-banana-pw`
- Calls `POST /api/generate/stream` with the same request shape as the frontend
- Supports prompt-only runs
- Supports the same request fields the frontend sends:
  - `prompt`
  - `modelId`
  - `imageOptions.aspectRatio`
  - `imageOptions.imageSize`
  - `imageOptions.layoutRows`
  - `imageOptions.layoutColumns`
  - `layoutGuideImage`
  - `referenceImages`

## Default workflow

Run the bundled script at `scripts/banana_studio_generate.mjs`:

```bash
node /absolute/path/to/banana_studio_generate.mjs --prompt "A banana astronaut on the moon"
```

For prompt-only usage, set a default pw once:

```bash
export BANANA_STUDIO_PW="your-pw"
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

Send an exact frontend-compatible payload:

```bash
node /absolute/path/to/banana_studio_generate.mjs \
  --pw "test-banana" \
  --payload-file /abs/path/payload.json
```

`payload.json` can contain the same JSON shape the frontend posts to `/api/generate/stream`.

## Output

The script:

- streams backend status to stderr
- saves the generated image under `./storage/skill-runs/...` by default
- writes a `result.json` summary beside the image
- prints a concise JSON summary to stdout

## Notes

- If `--pw` is omitted, the script reads `BANANA_STUDIO_PW`.
- If `--api-base-url` is omitted, the script reads `BANANA_STUDIO_API_BASE_URL` and falls back to `http://127.0.0.1:3001`.
- The script defaults to `modelId: "nano-banana-2"` and frontend-like image defaults when you do not provide them.
- When Codex uses this skill, resolve `scripts/banana_studio_generate.mjs` relative to the skill directory instead of assuming a repo-local `skills/` folder.
