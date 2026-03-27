import localforage from "localforage";

export const LOGIN_PATH = "/login";
export const STUDIO_PATH = "/studio";
export const PANEL_MODE_STORAGE_KEY = "banana.panelMode";
export const LEGACY_SELECTED_MODEL_STORAGE_KEY = "banana.selectedModelId";
export const LEGACY_SELECTED_ASPECT_RATIO_STORAGE_KEY = "banana.selectedAspectRatio";
export const LEGACY_SELECTED_LAYOUT_ROWS_STORAGE_KEY = "banana.selectedLayoutRows";
export const LEGACY_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY = "banana.selectedLayoutColumns";
export const LEGACY_SELECTED_IMAGE_SIZE_STORAGE_KEY = "banana.selectedImageSize";
export const LEGACY_SELECTED_IMAGE_COUNT_STORAGE_KEY = "banana.selectedImageCount";
export const LEGACY_PROMPT_STORAGE_KEY = "banana.prompt";
export const PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY = "banana.professional.selectedModelId";
export const PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY = "banana.professional.globalPrompt";
export const PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY = "banana.professional.canvasSize";
export const PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY = "banana.professional.customScenarios";
export const PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY = "banana.professional.customCanvasWidth";
export const PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY = "banana.professional.customCanvasHeight";
export const PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY = "banana.professional.selectedLayoutRows";
export const PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY = "banana.professional.selectedLayoutColumns";
export const PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY = "banana.professional.storyboardAspectRatio";
export const PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY = "banana.professional.storyboardImageSize";
export const PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY = "banana.professional.storyboardDividerWidth";
export const PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY = "banana.professional.storyboardCaptionFontSize";
export const PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY = "banana.professional.storyboardCaptionBackgroundAlpha";
export const PROFESSIONAL_SELECTED_IMAGE_SIZE_STORAGE_KEY = "banana.professional.selectedImageSize";
export const PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY = "banana.professional.selectedImageCount";
export const PROFESSIONAL_STORYBOARD_CELLS_STORAGE_KEY = "professionalStoryboardCells";
export const PROFESSIONAL_REFERENCE_IMAGES_STORAGE_KEY = "professionalReferenceImages";
export const SIMPLE_REFERENCE_IMAGES_STORAGE_KEY = "simpleReferenceImages";
export const SIMPLE_PROMPT_STORAGE_KEY = "banana.simple.prompt";
export const LAST_GENERATION_DB_NAME = "banana.studio";
export const LAST_GENERATION_STORE_NAME = "app";
export const LAST_GENERATION_RECORD_KEY = "lastGenerationResult";
export const GENERATION_LIBRARY_RECORDS_KEY = "generationLibraryRecords";
export const LAST_GENERATION_RECORD_ID_KEY = "lastGenerationRecordId";
export const MAX_REFERENCE_IMAGES = 12;
export const MAX_LAYOUT_TRACKS = 8;
export const VERTEX_INLINE_IMAGE_MAX_BYTES = 7 * 1024 * 1024;
export const REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES = Math.floor(VERTEX_INLINE_IMAGE_MAX_BYTES * 0.78);
export const REFERENCE_IMAGE_MAX_LONG_EDGE_PX = 2560;
export const REFERENCE_IMAGE_MIN_LONG_EDGE_PX = 1280;
export const REFERENCE_IMAGE_JPEG_QUALITY_STEPS = [0.82, 0.76, 0.7, 0.64, 0.58];
export const REFERENCE_IMAGE_RESIZE_STEPS = [1, 0.9, 0.82, 0.74];
export const PROMPT_TEXTAREA_MIN_ROWS = 2;
export const PROMPT_TEXTAREA_MAX_ROWS = 5;
export const PROMPT_STORAGE_WRITE_DEBOUNCE_MS = 180;
export const PANEL_MODE_SIMPLE = "simple";
export const PANEL_MODE_PROFESSIONAL = "professional";
export const CUSTOM_CANVAS_SIZE_VALUE = "custom";
export const STORYBOARD_EDITOR_MODE_GENERATE = "generate";
export const STORYBOARD_EDITOR_MODE_ASSET = "asset";
export const PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO = "1:1";
export const PROFESSIONAL_STYLE_REFERENCE_LIMIT = 1;
export const STORYBOARD_CELL_REFERENCE_LIMIT = 1;
export const PROFESSIONAL_SCENE_ARCHIVE_KIND = "banana.professional.scene";
export const PROFESSIONAL_SCENE_ARCHIVE_VERSION = 1;
export const DEFAULT_CUSTOM_CANVAS_WIDTH = 1080;
export const DEFAULT_CUSTOM_CANVAS_HEIGHT = 1440;
export const DEFAULT_STORYBOARD_DIVIDER_WIDTH_PX = 2;
export const MIN_STORYBOARD_DIVIDER_WIDTH_PX = 0;
export const MAX_STORYBOARD_DIVIDER_WIDTH_PX = 8;
export const DEFAULT_STORYBOARD_CAPTION_FONT_SIZE_PERCENT = 100;
export const MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT = 70;
export const MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT = 440;
export const DEFAULT_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT = 90;
export const MIN_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT = 72;
export const MAX_STORYBOARD_CAPTION_BACKGROUND_ALPHA_PERCENT = 100;
export const STORYBOARD_DRAG_ACTIVATION_DISTANCE_PX = 6;
export const STORYBOARD_MOBILE_DRAG_ACTIVATION_DELAY_MS = 220;
export const STORYBOARD_MOBILE_DRAG_TOLERANCE_PX = 8;
export const STORYBOARD_DRAG_CLICK_SUPPRESSION_MS = 240;
export const SIMPLE_PANEL_DEFAULTS = {
  modelId: "nano-banana-2",
  aspectRatio: "3:4",
  imageSize: "1K",
  imageCount: 2,
  layoutRows: 1,
  layoutColumns: 1,
};
export const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "方图 1:1" },
  { value: "1:4", label: "超长竖 1:4" },
  { value: "1:8", label: "极长竖 1:8" },
  { value: "2:3", label: "竖版 2:3" },
  { value: "3:2", label: "横版 3:2" },
  { value: "4:3", label: "横版 4:3" },
  { value: "3:4", label: "小红书封面 3:4（1080 x 1440）" },
  { value: "4:1", label: "超宽 4:1" },
  { value: "4:5", label: "竖版 4:5" },
  { value: "5:4", label: "横版 5:4" },
  { value: "8:1", label: "极宽 8:1" },
  { value: "16:9", label: "横版 16:9" },
  { value: "9:16", label: "竖版 9:16" },
  { value: "21:9", label: "超宽 21:9" },
];
export const CANVAS_SIZE_OPTIONS = [
  {
    value: "programmer-lv1-lv7",
    label: "程序员LV1到LV7",
    width: 1088,
    height: 3936,
    layoutRows: 7,
    layoutColumns: 1,
  },
  {
    value: "xiaohongshu-cover",
    label: "小红书封面",
    width: 1080,
    height: 1440,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "xiaohongshu-cover-2-grid",
    label: "小红书封面左右布局",
    width: 1080,
    height: 1440,
    layoutRows: 1,
    layoutColumns: 2,
  },
  {
    value: "xiaohongshu-cover-8-grid",
    label: "小红书封面8宫格",
    width: 1080,
    height: 1440,
    layoutRows: 2,
    layoutColumns: 4,
  },
  {
    value: "xiaohongshu-cover-4-grid",
    label: "小红书封面4宫格",
    width: 1080,
    height: 1440,
    layoutRows: 4,
    layoutColumns: 1,
  },
  {
    value: "square-logo",
    label: "方形LOGO",
    width: 1024,
    height: 1024,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "logo-selection-8-grid",
    label: "LOGO选品8宫格",
    width: 2048,
    height: 4096,
    layoutRows: 4,
    layoutColumns: 2,
  },
  {
    value: "phone-wallpaper",
    label: "手机壁纸",
    width: 1440,
    height: 3200,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "pc-wallpaper",
    label: "PC壁纸",
    width: 3840,
    height: 2160,
    layoutRows: 1,
    layoutColumns: 1,
  },
  {
    value: "ipad-wallpaper",
    label: "iPad壁纸",
    width: 2732,
    height: 2048,
    layoutRows: 1,
    layoutColumns: 1,
  },
];
export const REQUEST_TASK_RECOVERY_STALE_AFTER_MS = 4 * 60 * 1000;
export const SUPPORTED_ASPECT_RATIO_VALUES = new Set(ASPECT_RATIO_OPTIONS.map((option) => option.value));
export const SUPPORTED_CANVAS_SIZE_VALUES = new Set(CANVAS_SIZE_OPTIONS.map((option) => option.value));
export const IMAGE_SIZE_OPTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];
export const IMAGE_COUNT_OPTIONS = [
  { value: 1, label: "1 张" },
  { value: 2, label: "2 张" },
  { value: 3, label: "3 张" },
  { value: 4, label: "4 张" },
];
export const LAYOUT_TRACK_OPTIONS = Array.from({ length: MAX_LAYOUT_TRACKS }, (_value, index) => ({
  value: index + 1,
  label: String(index + 1),
}));
export const SUPPORTED_IMAGE_SIZE_VALUES = new Set(IMAGE_SIZE_OPTIONS.map((option) => option.value));
export const SUPPORTED_IMAGE_COUNT_VALUES = new Set(IMAGE_COUNT_OPTIONS.map((option) => option.value));
export const MIN_PREVIEW_SCALE = 1;
export const MAX_PREVIEW_SCALE = 6;
export const SSE_CONNECT_TIMEOUT_MS = 20 * 1000;
export const SSE_INACTIVITY_TIMEOUT_MS = 90 * 1000;
export const generationResultStorage = localforage.createInstance({
  name: LAST_GENERATION_DB_NAME,
  storeName: LAST_GENERATION_STORE_NAME,
});
