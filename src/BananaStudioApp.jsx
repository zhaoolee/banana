import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  canRetryRequestTask,
  getRequestTaskRetryHandler,
  isRequestTaskTerminal,
  normalizeRequestTaskProgress,
  setRequestTaskRetryHandler,
  useTaskStore,
} from "./stores/taskStore.js";
import { getProfessionalExportLayoutMetrics } from "../shared/professionalExportLayout.js";
import {
  ImagePreviewDialog,
  ResourceManagerDialog,
  TaskManagerDialog,
} from "./components/bananaStudioDialogs.jsx";
import {
  PendingScenarioSwitchDialog,
  ProfessionalSceneExportDialog,
  ScenarioManagerDialog,
  StoryboardCellClearConfirmDialog,
  StoryboardClearConfirmDialog,
  StoryboardEditorDialog,
} from "./components/bananaStudioStoryboardDialogs.jsx";
import { useImagePreviewState } from "./hooks/useImagePreviewState.js";
import {
  bumpDevMetric,
  exposeDevTool,
  getDevMetricsSnapshot,
  resetDevMetrics,
  useDevRenderMetric,
} from "./devMetrics.js";
import {
  LOGIN_PATH,
  STUDIO_PATH,
  PANEL_MODE_STORAGE_KEY,
  LEGACY_SELECTED_MODEL_STORAGE_KEY,
  LEGACY_SELECTED_ASPECT_RATIO_STORAGE_KEY,
  LEGACY_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
  LEGACY_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
  LEGACY_SELECTED_IMAGE_COUNT_STORAGE_KEY,
  LEGACY_PROMPT_STORAGE_KEY,
  PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY,
  PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY,
  PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY,
  PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY,
  PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY,
  PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY,
  PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
  PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY,
  PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY,
  PROFESSIONAL_SELECTED_IMAGE_SIZE_STORAGE_KEY,
  PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY,
  SIMPLE_PROMPT_STORAGE_KEY,
  MAX_REFERENCE_IMAGES,
  REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES,
  PROMPT_TEXTAREA_MIN_ROWS,
  PROMPT_STORAGE_WRITE_DEBOUNCE_MS,
  PANEL_MODE_SIMPLE,
  PANEL_MODE_PROFESSIONAL,
  CUSTOM_CANVAS_SIZE_VALUE,
  STORYBOARD_EDITOR_MODE_GENERATE,
  STORYBOARD_EDITOR_MODE_ASSET,
  PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO,
  PROFESSIONAL_STYLE_REFERENCE_LIMIT,
  STORYBOARD_CELL_REFERENCE_LIMIT,
  DEFAULT_CUSTOM_CANVAS_WIDTH,
  DEFAULT_CUSTOM_CANVAS_HEIGHT,
  MIN_STORYBOARD_DIVIDER_WIDTH_PX,
  MAX_STORYBOARD_DIVIDER_WIDTH_PX,
  MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT,
  MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT,
  STORYBOARD_DRAG_ACTIVATION_DISTANCE_PX,
  STORYBOARD_MOBILE_DRAG_ACTIVATION_DELAY_MS,
  STORYBOARD_MOBILE_DRAG_TOLERANCE_PX,
  STORYBOARD_DRAG_CLICK_SUPPRESSION_MS,
  SIMPLE_PANEL_DEFAULTS,
  CANVAS_SIZE_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  LAYOUT_TRACK_OPTIONS,
  SUPPORTED_IMAGE_COUNT_VALUES,
  MIN_PREVIEW_SCALE,
  createPersistedRecordId,
  createClientRequestId,
  normalizeAspectRatioValue,
  normalizePanelModeValue,
  normalizeImageSizeValue,
  normalizeImageCountValue,
  normalizeCanvasDimensionValue,
  normalizeStoryboardCaptionFontSizePercent,
  normalizeStoryboardDividerWidthPx,
  normalizeStoryboardCaptionBackgroundAlphaPercent,
  clampPreviewScale,
  getPointerDistance,
  getModelAspectRatioOptions,
  getModelImageSizeOptions,
  clampLayoutTrack,
  normalizeTextValue,
  normalizeRemainingCredits,
  resolveSimplePanelModelId,
  resolveCanvasSizeFromLegacyAspectRatio,
  getCanvasSizeOption,
  getCanvasScenarioOption,
  normalizeCanvasScenarioValue,
  buildStoryboardCellDefinitions,
  createStoryboardCellState,
  findStoryboardCellIdByPendingRequestId,
  mergeHydratedStoryboardCells,
  buildStoryboardCellTaskPatch,
  doesStoryboardCellHaveContent,
  swapStoryboardCellContent,
  normalizeStoryboardCells,
  findRecommendedStoryboardAspectRatioOption,
  findRecommendedStoryboardAspectRatioForLayout,
  formatCropPercentValue,
  ProfessionalStoryboardGridSection,
  formatCanvasSizeAspectRatioValue,
  buildProfessionalExportCssVariables,
  resizePromptTextarea,
  drawLayoutGuide,
  readSearchParam,
  detectMobilePerformanceMode,
  reorderReferenceImages,
  readLocalValue,
  writeLocalValue,
  readStoredProfessionalCustomScenarios,
  buildPersistedProfessionalCustomScenarios,
  buildDownloadNameWithOptions,
  buildProfessionalSceneArchiveBaseName,
  sanitizeExportFileBaseName,
  buildProfessionalSceneArchiveDownloadName,
  buildProfessionalSceneArchiveZipDownloadName,
  buildProfessionalSceneAssetPackage,
  formatPersistedAt,
  getRequestTaskStatusLabel,
  buildRequestTaskMeta,
  buildRequestTaskQueueSummary,
  parseRequestTaskTimeMs,
  isOrphanedPendingRequestTask,
  buildOrphanedRequestTaskPatch,
  buildMissingRecoverableRequestTaskPatch,
  isRequestTaskRecoveryStale,
  getFinderFilterDefinitions,
  getReferenceImageOptimizationSummary,
  getImageFilesFromClipboardData,
  secondsToEstimateMs,
  formatStreamPreviewText,
  createRequestCancelledError,
  isRequestCancelledError,
  buildCancelledRequestTaskPatch,
  subscribeTaskStatusStream,
  downloadTextFile,
  buildSimpleGenerationPayload,
  buildProfessionalGenerationPayload,
  buildProfessionalReferenceImages,
  buildProfessionalStoryboardPrompt,
  buildProfessionalExportPayload,
  getNextImageSize,
  cloneGenerationResultRecord,
  buildGeneratedImageRecords,
  buildGeneratedImageRecord,
  buildProfessionalSceneArchive,
  resolveProfessionalSceneArchiveState,
  readPersistedGenerationLibrary,
  writePersistedGenerationLibrary,
  readPersistedCurrentGenerationRecord,
  readPersistedStoryboardCells,
  writePersistedStoryboardCells,
  readPersistedReferenceImages,
  readPersistedSimpleReferenceImages,
  writePersistedReferenceImages,
  writePersistedSimpleReferenceImages,
  readFileAsReferenceImage,
  readFileAsText,
  readFileAsGenerationResultRecord,
  fetchRetryableGenerationRequest,
  fetchRecoverableGenerationRequest,
  verifyPassword,
  fetchBananaModels,
  fetchCancelableGenerationRequest,
  requestProfessionalGeneration,
  requestSimpleGeneration,
  requestEnhancement,
  requestProfessionalExportPreview,
  saveBlobFile,
} from "./bananaStudioShared.jsx";

const EXAMPLE_SCENE_VALUE_PREFIX = "example-scene:";
const exampleSceneAssetModules = import.meta.glob("../public/example/*.json", {
  eager: true,
  query: "?url",
  import: "default",
});
const EXAMPLE_SCENE_OPTIONS = Object.entries(exampleSceneAssetModules)
  .map(([path, assetUrl]) => {
    const filename = path.split("/").pop() || "";
    const label = filename.replace(/\.json$/i, "");

    if (!filename || !label || typeof assetUrl !== "string") {
      return null;
    }

    return {
      value: `${EXAMPLE_SCENE_VALUE_PREFIX}${filename}`,
      label: `示例 · ${label}`,
      sceneLabel: label,
      filename,
      assetUrl,
    };
  })
  .filter(Boolean)
  .sort((leftOption, rightOption) =>
    leftOption.sceneLabel.localeCompare(rightOption.sceneLabel, "zh-Hans-CN"),
  );
const EXAMPLE_SCENE_OPTION_MAP = new Map(
  EXAMPLE_SCENE_OPTIONS.map((option) => [option.value, option]),
);

function BananaStudioApp({ routeMode = "login" }) {
  useDevRenderMetric("BananaStudioApp", routeMode);

  const urlPassword = normalizeTextValue(readSearchParam("pw"));
  const isE2eStudioMode =
    import.meta.env.DEV &&
    routeMode === "studio" &&
    readSearchParam("e2e") === "1";
  const shouldAutoVerifyStudioPassword =
    routeMode === "studio" && Boolean(urlPassword) && !isE2eStudioMode;
  const [password, setPassword] = useState(() => urlPassword);
  const [activePw, setActivePw] = useState(() => (isE2eStudioMode ? "__banana_e2e__" : ""));
  const [sessionState, setSessionState] = useState(() =>
    isE2eStudioMode ? "ready" : shouldAutoVerifyStudioPassword ? "checking" : "locked",
  );
  const [models, setModels] = useState([]);
  const [panelMode, setPanelMode] = useState(() =>
    normalizePanelModeValue(readLocalValue(PANEL_MODE_STORAGE_KEY)),
  );
  const [professionalSelectedModelId, setProfessionalSelectedModelId] = useState(() =>
    readLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY) ||
      readLocalValue(LEGACY_SELECTED_MODEL_STORAGE_KEY),
  );
  const [professionalGlobalPrompt, setProfessionalGlobalPrompt] = useState(() =>
    readLocalValue(PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY),
  );
  const [professionalCustomScenarios, setProfessionalCustomScenarios] = useState(() =>
    readStoredProfessionalCustomScenarios(),
  );
  const [professionalCanvasSize, setProfessionalCanvasSize] = useState(() =>
    normalizeCanvasScenarioValue(
      readLocalValue(PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY) ||
        resolveCanvasSizeFromLegacyAspectRatio(
          readLocalValue(LEGACY_SELECTED_ASPECT_RATIO_STORAGE_KEY) || "1:1",
        ),
      readStoredProfessionalCustomScenarios(),
    ),
  );
  const [professionalLayoutRows, setProfessionalLayoutRows] = useState(() =>
    clampLayoutTrack(
      readLocalValue(PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY) ||
        readLocalValue(LEGACY_SELECTED_LAYOUT_ROWS_STORAGE_KEY) ||
        1,
    ),
  );
  const [professionalLayoutColumns, setProfessionalLayoutColumns] = useState(() =>
    clampLayoutTrack(
      readLocalValue(PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY) ||
        readLocalValue(LEGACY_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY) ||
        1,
    ),
  );
  const [professionalStoryboardAspectRatio, setProfessionalStoryboardAspectRatio] = useState(() =>
    normalizeAspectRatioValue(
      readLocalValue(PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY) ||
        PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO,
    ),
  );
  const [professionalStoryboardImageSize, setProfessionalStoryboardImageSize] = useState(() =>
    normalizeImageSizeValue(
      readLocalValue(PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY) ||
        readLocalValue(PROFESSIONAL_SELECTED_IMAGE_SIZE_STORAGE_KEY) ||
        "1K",
    ),
  );
  const [professionalSelectedImageCount, setProfessionalSelectedImageCount] = useState(() =>
    normalizeImageCountValue(
      readLocalValue(PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY) ||
        readLocalValue(LEGACY_SELECTED_IMAGE_COUNT_STORAGE_KEY) ||
        1,
    ),
  );
  const [simplePrompt, setSimplePrompt] = useState(() =>
    readLocalValue(SIMPLE_PROMPT_STORAGE_KEY) || readLocalValue(LEGACY_PROMPT_STORAGE_KEY),
  );
  const [simpleReferenceImages, setSimpleReferenceImages] = useState([]);
  const [simpleReferenceImagesHydrated, setSimpleReferenceImagesHydrated] = useState(false);
  const [simpleReferenceDisclosureOpen, setSimpleReferenceDisclosureOpen] = useState(false);
  const [referenceImages, setReferenceImages] = useState([]);
  const [referenceImagesHydrated, setReferenceImagesHydrated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState(null);
  const [studioError, setStudioError] = useState("");
  const [studioNotice, setStudioNotice] = useState("");
  const [studioPending, setStudioPending] = useState(false);
  const [professionalExportPending, setProfessionalExportPending] = useState(false);
  const [professionalSceneTransferPending, setProfessionalSceneTransferPending] = useState(false);
  const [exampleSceneLoadingLabel, setExampleSceneLoadingLabel] = useState("");
  const [professionalSceneExportDialog, setProfessionalSceneExportDialog] = useState(null);
  const [enhancePending, setEnhancePending] = useState(false);
  const [backendRequestCount, setBackendRequestCount] = useState(0);
  const [backendBusyLabel, setBackendBusyLabel] = useState("");
  const [backendBusyEstimateMs, setBackendBusyEstimateMs] = useState(secondsToEstimateMs(18));
  const [backendBusyStartedAt, setBackendBusyStartedAt] = useState(0);
  const [backendBusyTickAt, setBackendBusyTickAt] = useState(0);
  const [backendBusyStreamText, setBackendBusyStreamText] = useState("");
  const [taskRecoveryPauseCount, setTaskRecoveryPauseCount] = useState(0);
  const [generationResult, setGenerationResult] = useState(null);
  const [generationResults, setGenerationResults] = useState([]);
  const [generationLibrary, setGenerationLibrary] = useState([]);
  const [generationLibraryLoaded, setGenerationLibraryLoaded] = useState(false);
  const [resourceManagerPending, setResourceManagerPending] = useState(false);
  const [resourceManagerOpen, setResourceManagerOpen] = useState(false);
  const [resourceManagerFilter, setResourceManagerFilter] = useState("all");
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [referenceDragActive, setReferenceDragActive] = useState(false);
  const [promptMode, setPromptMode] = useState("simple");
  const [professionalCustomCanvasWidth, setProfessionalCustomCanvasWidth] = useState(() =>
    normalizeCanvasDimensionValue(
      readLocalValue(PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY),
      DEFAULT_CUSTOM_CANVAS_WIDTH,
    ),
  );
  const [professionalCustomCanvasHeight, setProfessionalCustomCanvasHeight] = useState(() =>
    normalizeCanvasDimensionValue(
      readLocalValue(PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY),
      DEFAULT_CUSTOM_CANVAS_HEIGHT,
    ),
  );
  const [professionalStoryboardDividerWidthPx, setProfessionalStoryboardDividerWidthPx] = useState(() =>
    normalizeStoryboardDividerWidthPx(
      readLocalValue(PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY),
    ),
  );
  const [professionalStoryboardCaptionFontSizePercent, setProfessionalStoryboardCaptionFontSizePercent] = useState(() =>
    normalizeStoryboardCaptionFontSizePercent(
      readLocalValue(PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY),
    ),
  );
  const [professionalStoryboardCaptionBackgroundAlphaPercent, setProfessionalStoryboardCaptionBackgroundAlphaPercent] = useState(() =>
    normalizeStoryboardCaptionBackgroundAlphaPercent(
      readLocalValue(PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY),
    ),
  );
  const [storyboardCells, setStoryboardCells] = useState(() =>
    normalizeStoryboardCells({}, professionalLayoutRows, professionalLayoutColumns),
  );
  const [scenarioManagerOpen, setScenarioManagerOpen] = useState(false);
  const [scenarioManagerSelectedType, setScenarioManagerSelectedType] = useState("new");
  const [scenarioManagerDraft, setScenarioManagerDraft] = useState(() => ({
    value: "",
    label: "",
    width: String(DEFAULT_CUSTOM_CANVAS_WIDTH),
    height: String(DEFAULT_CUSTOM_CANVAS_HEIGHT),
    layoutRows: 1,
    layoutColumns: 1,
  }));
  const [scenarioManagerSelectedId, setScenarioManagerSelectedId] = useState("");
  const [storyboardEditorCellId, setStoryboardEditorCellId] = useState("");
  const [storyboardEditorMode, setStoryboardEditorMode] = useState(STORYBOARD_EDITOR_MODE_GENERATE);
  const [storyboardLibraryPickerOpen, setStoryboardLibraryPickerOpen] = useState(false);
  const [storyboardLibraryPickerPending, setStoryboardLibraryPickerPending] = useState(false);
  const [pendingScenarioSwitch, setPendingScenarioSwitch] = useState(null);
  const [storyboardClearConfirmOpen, setStoryboardClearConfirmOpen] = useState(false);
  const [storyboardCellClearConfirmCellId, setStoryboardCellClearConfirmCellId] = useState("");
  const [requestTaskCancelConfirmId, setRequestTaskCancelConfirmId] = useState("");
  const [storyboardShareCopyState, setStoryboardShareCopyState] = useState("idle");
  const [storyboardImageControlsCollapsed, setStoryboardImageControlsCollapsed] = useState(true);
  const [storyboardStyleControlsCollapsed, setStoryboardStyleControlsCollapsed] = useState(true);
  const [storyboardCellsHydrated, setStoryboardCellsHydrated] = useState(false);
  const [activeStoryboardDragId, setActiveStoryboardDragId] = useState("");
  const [isMobilePerformanceMode, setIsMobilePerformanceMode] = useState(() =>
    detectMobilePerformanceMode(),
  );
  const [professionalExportPreviewVisible, setProfessionalExportPreviewVisible] = useState(() =>
    !detectMobilePerformanceMode(),
  );
  const [professionalExportScale, setProfessionalExportScale] = useState(1);
  const [professionalExportCardElement, setProfessionalExportCardElement] = useState(null);
  const requestTasks = useTaskStore((state) => state.requestTasks);
  const retryingRequestTaskIds = useTaskStore((state) => state.retryingRequestTaskIds);
  const cancellingRequestTaskIds = useTaskStore((state) => state.cancellingRequestTaskIds);
  const taskManagerOpen = useTaskStore((state) => state.taskManagerOpen);
  const setTaskManagerOpen = useTaskStore((state) => state.setTaskManagerOpen);
  const upsertRequestTask = useTaskStore((state) => state.upsertRequestTask);
  const updateRequestTask = useTaskStore((state) => state.updateRequestTask);
  const startRetryingRequestTask = useTaskStore((state) => state.startRetryingRequestTask);
  const finishRetryingRequestTask = useTaskStore((state) => state.finishRetryingRequestTask);
  const startCancellingRequestTask = useTaskStore((state) => state.startCancellingRequestTask);
  const finishCancellingRequestTask = useTaskStore((state) => state.finishCancellingRequestTask);
  const clearTerminalRequestTasks = useTaskStore((state) => state.clearTerminalRequestTasks);
  const layoutCanvasRef = useRef(null);
  const promptTextareaRef = useRef(null);
  const storyboardDragClickSuppressionRef = useRef({
    cellId: "",
    timestamp: 0,
  });
  const defaultViewportMetaContentRef = useRef("");
  const storyboardCellsRef = useRef(storyboardCells);
  const activeStoryboardDragIdRef = useRef(activeStoryboardDragId);
  const storyboardCellInteractionRef = useRef({
    open: () => {},
    clear: () => {},
  });
  const storyboardGridActionRef = useRef({
    openClearConfirm: () => {},
    onDragStart: () => {},
    onDragCancel: () => {},
    onDragEnd: () => {},
  });
  const storyboardShareCopyResetTimeoutRef = useRef(null);
  const storyboardLibraryPickerTimeoutRef = useRef(null);
  const storyboardEditorDraftRef = useRef({
    cellId: "",
    prompt: "",
    caption: "",
  });
  const generationLibraryLoadPromiseRef = useRef(null);
  const storyboardDragSensorsDebugRef = useRef(null);
  const taskRecoveryInFlightRequestIdsRef = useRef(new Set());
  const taskStatusStreamHandleRef = useRef(null);
  const taskStatusStreamReconnectTimeoutRef = useRef(0);
  const taskStatusStreamRequestIdsRef = useRef([]);
  const taskStatusStreamPasswordRef = useRef("");
  const taskStatusStreamGenerationRef = useRef(0);
  const requestAbortControllersRef = useRef(new Map());
  const professionalSceneImportInputRef = useRef(null);
  const referenceGridRef = useRef(null);
  const {
    imagePreviewOpen,
    imagePreviewRecord,
    imagePreviewDragging,
    imagePreviewViewportSize,
    imagePreviewNaturalSize,
    imagePreviewTransform,
    imagePreviewBaseStyle,
    imagePreviewViewportRef,
    setImagePreviewViewportSize,
    setImagePreviewNaturalSize,
    setImagePreviewTransform,
    openImagePreview,
    closeImagePreview,
    resetImagePreviewTransform,
    zoomImagePreview,
    applyPreviewScale,
    handleImagePreviewWheel,
    handleImagePreviewPointerDown,
    handleImagePreviewPointerMove,
    handleImagePreviewPointerEnd,
  } = useImagePreviewState({
    minPreviewScale: MIN_PREVIEW_SCALE,
    clampPreviewScale,
    getPointerDistance,
  });
  storyboardCellsRef.current = storyboardCells;
  activeStoryboardDragIdRef.current = activeStoryboardDragId;
  const hasLayoutValues = Boolean(
    professionalCanvasSize &&
      professionalLayoutRows > 0 &&
      professionalLayoutColumns > 0,
  );
  const isSimplePanelMode = panelMode === PANEL_MODE_SIMPLE;
  const isProfessionalPanelMode = panelMode === PANEL_MODE_PROFESSIONAL;
  const showResultPanel = isSimplePanelMode;
  const showProfessionalExportPanel = isProfessionalPanelMode;
  const shouldRenderProfessionalExportPreview =
    showProfessionalExportPanel && professionalExportPreviewVisible;
  const showPromptField = isSimplePanelMode;
  const isPromptFocusMode = showPromptField && promptMode === "focus";
  const showSimplePanelSubmit = isSimplePanelMode && !isPromptFocusMode;
  const showProfessionalPanelControls = isProfessionalPanelMode && !isPromptFocusMode;
  const professionalSceneTransferReady =
    referenceImagesHydrated && storyboardCellsHydrated;
  const simpleStyleReference = simpleReferenceImages[0] || null;
  const storyboardCellDefinitions = useMemo(
    () => buildStoryboardCellDefinitions(professionalLayoutRows, professionalLayoutColumns),
    [professionalLayoutColumns, professionalLayoutRows],
  );
  const allCanvasScenarioOptions = useMemo(
    () => [...CANVAS_SIZE_OPTIONS, ...professionalCustomScenarios],
    [professionalCustomScenarios],
  );
  const professionalCanvasSizeOption = useMemo(
    () =>
      getCanvasSizeOption(
        professionalCanvasSize,
        professionalCustomCanvasWidth,
        professionalCustomCanvasHeight,
        professionalCustomScenarios,
        professionalLayoutRows,
        professionalLayoutColumns,
      ),
    [
      professionalCanvasSize,
      professionalCustomCanvasHeight,
      professionalCustomCanvasWidth,
      professionalCustomScenarios,
      professionalLayoutColumns,
      professionalLayoutRows,
    ],
  );
  const professionalStyleReference = referenceImages[0] || null;
  const activeCustomScenario = useMemo(
    () =>
      professionalCustomScenarios.find((scenario) => scenario.value === professionalCanvasSize) || null,
    [professionalCanvasSize, professionalCustomScenarios],
  );
  const activeSystemScenario = useMemo(
    () => CANVAS_SIZE_OPTIONS.find((scenario) => scenario.value === professionalCanvasSize) || null,
    [professionalCanvasSize],
  );
  const storyboardEditorOpen = Boolean(storyboardEditorCellId);
  const isStoryboardEditorGenerateMode = storyboardEditorMode === STORYBOARD_EDITOR_MODE_GENERATE;
  const isStoryboardEditorAssetMode = storyboardEditorMode === STORYBOARD_EDITOR_MODE_ASSET;
  const rawStoryboardDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobilePerformanceMode
        ? {
            delay: STORYBOARD_MOBILE_DRAG_ACTIVATION_DELAY_MS,
            tolerance: STORYBOARD_MOBILE_DRAG_TOLERANCE_PX,
          }
        : {
            distance: STORYBOARD_DRAG_ACTIVATION_DISTANCE_PX,
          },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const storyboardDragSensorsRef = useRef(rawStoryboardDragSensors);
  const storyboardDragSensorsModeRef = useRef(isMobilePerformanceMode);

  if (storyboardDragSensorsModeRef.current !== isMobilePerformanceMode) {
    storyboardDragSensorsRef.current = rawStoryboardDragSensors;
    storyboardDragSensorsModeRef.current = isMobilePerformanceMode;
  }

  const storyboardDragSensors = storyboardDragSensorsRef.current;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");
    const handleChange = () => {
      const nextValue = mediaQuery.matches;
      setIsMobilePerformanceMode(nextValue);
      setProfessionalExportPreviewVisible(nextValue ? false : true);
    };

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const viewportMeta = document.querySelector('meta[name="viewport"]');

    if (!viewportMeta) {
      return undefined;
    }

    if (!defaultViewportMetaContentRef.current) {
      defaultViewportMetaContentRef.current =
        viewportMeta.getAttribute("content") || "width=device-width, initial-scale=1.0";
    }

    const defaultViewportContent = defaultViewportMetaContentRef.current;
    viewportMeta.setAttribute(
      "content",
      isMobilePerformanceMode
        ? `${defaultViewportContent}, maximum-scale=1, user-scalable=no`
        : defaultViewportContent,
    );

    return () => {
      viewportMeta.setAttribute("content", defaultViewportContent);
    };
  }, [isMobilePerformanceMode]);

  const storyboardCaptionFontScale = professionalStoryboardCaptionFontSizePercent / 100;
  const storyboardCaptionBackgroundAlpha =
    professionalStoryboardCaptionBackgroundAlphaPercent / 100;
  const storyboardGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(professionalLayoutColumns, 1)}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${Math.max(professionalLayoutRows, 1)}, minmax(0, 1fr))`,
      "--storyboard-divider-size": `${professionalStoryboardDividerWidthPx}px`,
      "--storyboard-caption-font-scale": String(storyboardCaptionFontScale),
      "--storyboard-caption-background-alpha": String(storyboardCaptionBackgroundAlpha),
    }),
    [
      professionalStoryboardDividerWidthPx,
      professionalLayoutColumns,
      professionalLayoutRows,
      storyboardCaptionBackgroundAlpha,
      storyboardCaptionFontScale,
    ],
  );
  const storyboardShellStyle = useMemo(
    () => ({
      aspectRatio: `${professionalCanvasSizeOption.width} / ${professionalCanvasSizeOption.height}`,
    }),
    [professionalCanvasSizeOption],
  );
  const professionalExportMetrics = useMemo(
    () =>
      getProfessionalExportLayoutMetrics({
        canvasWidth: professionalCanvasSizeOption.width,
        canvasHeight: professionalCanvasSizeOption.height,
        rows: professionalLayoutRows,
        columns: professionalLayoutColumns,
      }),
    [professionalCanvasSizeOption, professionalLayoutColumns, professionalLayoutRows],
  );
  const professionalExportViewportStyle = useMemo(
    () => ({
      width: `${professionalCanvasSizeOption.width * professionalExportScale}px`,
      height: `${professionalCanvasSizeOption.height * professionalExportScale}px`,
    }),
    [professionalCanvasSizeOption, professionalExportScale],
  );
  const professionalExportGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${Math.max(professionalLayoutColumns, 1)}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${Math.max(professionalLayoutRows, 1)}, minmax(0, 1fr))`,
      "--professional-export-divider-size": `${professionalStoryboardDividerWidthPx}px`,
    }),
    [
      professionalLayoutColumns,
      professionalLayoutRows,
      professionalStoryboardDividerWidthPx,
    ],
  );
  const professionalExportSheetStyle = useMemo(
    () => ({
      width: `${professionalCanvasSizeOption.width}px`,
      height: `${professionalCanvasSizeOption.height}px`,
      transform: `scale(${professionalExportScale})`,
      ...buildProfessionalExportCssVariables(professionalExportMetrics, {
        dividerWidthPx: professionalStoryboardDividerWidthPx,
        captionFontScale: storyboardCaptionFontScale,
        captionBackgroundAlpha: storyboardCaptionBackgroundAlpha,
      }),
    }),
    [
      professionalCanvasSizeOption,
      professionalExportMetrics,
      professionalExportScale,
      professionalStoryboardDividerWidthPx,
      storyboardCaptionBackgroundAlpha,
      storyboardCaptionFontScale,
    ],
  );
  const previewRecord = imagePreviewRecord || generationResult;
  const isBackendBusy = backendRequestCount > 0;
  const backendBusyElapsedMs =
    isBackendBusy && backendBusyStartedAt
      ? Math.max(0, backendBusyTickAt - backendBusyStartedAt)
      : 0;
  const backendBusyRemainingMs = Math.max(0, backendBusyEstimateMs - backendBusyElapsedMs);
  const backendBusyRemainingSeconds = Math.ceil(backendBusyRemainingMs / 1000);
  const backendBusyProgressValue =
    backendBusyEstimateMs > 0
      ? Math.min(backendBusyElapsedMs / backendBusyEstimateMs, 1)
      : 0;
  const recoverableRequestTasks = useMemo(
    () =>
      requestTasks
        .filter((task) => !isRequestTaskTerminal(task))
        .sort((leftTask, rightTask) => {
          const leftTime = Date.parse(leftTask.createdAt || "") || 0;
          const rightTime = Date.parse(rightTask.createdAt || "") || 0;
          return leftTime - rightTime;
        }),
    [requestTasks],
  );
  const activeRequestTaskCount = recoverableRequestTasks.length;
  const recoverableRequestTaskSignature = useMemo(
    () => recoverableRequestTasks.map((task) => task.requestId).join("|"),
    [recoverableRequestTasks],
  );
  const sortedRequestTasks = useMemo(
    () => requestTasks,
    [requestTasks],
  );
  const clearableRequestTaskCount = useMemo(
    () => requestTasks.filter((task) => isRequestTaskTerminal(task)).length,
    [requestTasks],
  );
  const finderFilters = useMemo(() => {
    return getFinderFilterDefinitions(generationLibrary);
  }, [generationLibrary]);
  const activeFinderFilter = useMemo(() => {
    return finderFilters.find((item) => item.id === resourceManagerFilter) || finderFilters[0] || null;
  }, [finderFilters, resourceManagerFilter]);
  const filteredGenerationLibrary = useMemo(() => {
    if (!activeFinderFilter) {
      return generationLibrary;
    }

    return generationLibrary.filter(activeFinderFilter.predicate);
  }, [activeFinderFilter, generationLibrary]);
  const backendBusyOverlay = isBackendBusy ? (
    <div
      className="request-busy-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="request-busy-halo" aria-hidden="true" />
      <div className="request-busy-center">
        <div className="request-busy-chip">
          <div className="request-busy-row">
            <div className="request-busy-copy">
              <div className="request-busy-title">
                <span className="request-busy-orb" aria-hidden="true" />
                <strong>{backendBusyLabel || "banana 正在请求后端..."}</strong>
              </div>
              <span className="request-busy-meta">
                {backendBusyRemainingSeconds > 0
                  ? `预计还需 ${backendBusyRemainingSeconds} 秒`
                  : "预计即将完成"}
              </span>
            </div>
            <span className="request-busy-countdown">
              {backendBusyRemainingSeconds > 0 ? `${backendBusyRemainingSeconds}s` : "0s"}
            </span>
          </div>
          {backendBusyStreamText ? (
            <p className="request-busy-streamtext">{backendBusyStreamText}</p>
          ) : null}
          <div
            className={`request-busy-progress${backendBusyProgressValue >= 1 ? " is-complete" : ""}`}
            aria-hidden="true"
          >
            <span
              style={{
                transform: `scaleX(${Math.max(backendBusyProgressValue, 0.04)})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  ) : null;

  function beginBackendRequest(label, estimateMs = secondsToEstimateMs(18)) {
    const startedAt = Date.now();
    setBackendBusyLabel(label || "banana 正在请求后端...");
    setBackendBusyEstimateMs(estimateMs);
    setBackendBusyStartedAt(startedAt);
    setBackendBusyTickAt(startedAt);
    setBackendBusyStreamText("");
    setBackendRequestCount((currentValue) => currentValue + 1);

    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      setBackendRequestCount((currentValue) => Math.max(0, currentValue - 1));
    };
  }

  function beginTaskRecoveryPause() {
    let released = false;
    setTaskRecoveryPauseCount((currentValue) => currentValue + 1);

    return () => {
      if (released) {
        return;
      }

      released = true;
      setTaskRecoveryPauseCount((currentValue) => Math.max(0, currentValue - 1));
    };
  }

  function registerRequestAbortController(requestId, abortController) {
    if (!requestId || !abortController) {
      return;
    }

    requestAbortControllersRef.current.set(requestId, abortController);
  }

  function unregisterRequestAbortController(requestId, abortController) {
    if (!requestId) {
      return;
    }

    const currentController = requestAbortControllersRef.current.get(requestId);

    if (!currentController || (abortController && currentController !== abortController)) {
      return;
    }

    requestAbortControllersRef.current.delete(requestId);
  }

  function abortRequestAbortController(requestId, reason = createRequestCancelledError()) {
    if (!requestId) {
      return;
    }

    const abortController = requestAbortControllersRef.current.get(requestId);

    if (!abortController || abortController.signal.aborted) {
      return;
    }

    abortController.abort(reason);
  }

  async function executeRetryPayloadTask(task, retryPayload) {
    const resolvedStoryboardCellId =
      normalizeTextValue(task?.storyboardCellId) ||
      findStoryboardCellIdByPendingRequestId(storyboardCells, task?.requestId);
    const resolvedStoryboardCell =
      resolvedStoryboardCellId && storyboardCells[resolvedStoryboardCellId]
        ? storyboardCells[resolvedStoryboardCellId]
        : null;
    const retryType =
      resolvedStoryboardCell
        ? "storyboard"
        : normalizeTextValue(task?.type) === "storyboard"
        ? "storyboard"
        : normalizeTextValue(retryPayload?.type) || normalizeTextValue(task?.type);
    const retryMode = normalizeTextValue(retryPayload?.mode) || normalizeTextValue(task?.mode);
    const retryImageOptions = retryPayload?.imageOptions || {};

    if (retryType === "enhance") {
      await executeEnhancementTask({
        sourceGenerationRecord: {
          bananaModelId: retryPayload?.modelId || "",
          mimeType: retryPayload?.sourceImage?.mimeType || "image/png",
          imageBase64: retryPayload?.sourceImage?.data || "",
          aspectRatio: retryImageOptions?.aspectRatio || "",
          layoutRows: retryImageOptions?.layoutRows || 1,
          layoutColumns: retryImageOptions?.layoutColumns || 1,
          savedRecord: null,
        },
        promptSnapshot: retryPayload?.prompt || task?.promptSnapshot || "",
        targetImageSize: retryImageOptions?.imageSize || enhancementTargetImageSize,
      });
      return;
    }

    if (retryType === "storyboard") {
      if (resolvedStoryboardCell) {
        await executeStoryboardCellTask({
          editorCell: resolvedStoryboardCell,
          modelId: retryPayload?.modelId || generationModelId,
          requestedPromptValue: retryPayload?.prompt || task?.promptSnapshot || "",
          storyboardAspectRatio: retryImageOptions?.aspectRatio || professionalStoryboardAspectRatioValue,
          storyboardImageSize: retryImageOptions?.imageSize || professionalStoryboardImageSizeValue,
          globalReferenceImageRecords: retryPayload?.referenceImages || [],
        });
        return;
      }
    }

    await executeGenerationTask({
      mode: retryMode === "simple" ? "simple" : "professional",
      modelId: retryPayload?.modelId || generationModelId,
      prompt: retryPayload?.prompt || task?.promptSnapshot || "",
      aspectRatio:
        retryImageOptions?.aspectRatio ||
        (retryMode === "simple" ? generationAspectRatio : professionalDefaultCellAspectRatio),
      imageSize: retryImageOptions?.imageSize || generationImageSize,
      imageCount: retryImageOptions?.imageCount || 1,
      layoutRows: retryImageOptions?.layoutRows || 1,
      layoutColumns: retryImageOptions?.layoutColumns || 1,
      referenceImageRecords: retryPayload?.referenceImages || [],
    });
  }

  async function handleRetryRequestTask(task) {
    const requestId = normalizeTextValue(task?.requestId);
    const retryHandler = getRequestTaskRetryHandler(requestId);

    if (!requestId || retryingRequestTaskIds[requestId]) {
      return;
    }

    startRetryingRequestTask(requestId);

    try {
      setStudioError("");
      setStudioNotice("已重新提交失败任务，请查看新的任务状态。");

      if (activePw) {
        const data = await fetchRetryableGenerationRequest(activePw, requestId);

        if (data?.retryPayload) {
          await executeRetryPayloadTask(task, data.retryPayload);
          updateRequestTask(requestId, {
            canRetry: true,
            message: "已重新提交新的重试任务",
          });
          return;
        }
      }

      if (typeof retryHandler === "function") {
        await retryHandler();
      } else {
        throw new Error("当前任务没有可重试的请求体，请重新发起一次请求");
      }

      updateRequestTask(requestId, {
        message: "已重新提交新的重试任务",
      });
    } catch (error) {
      if (error?.status === 400 && typeof retryHandler !== "function") {
        updateRequestTask(requestId, {
          canRetry: false,
        });
      }
      setStudioError(error instanceof Error ? error.message : "任务重试失败");
    } finally {
      finishRetryingRequestTask(requestId);
    }
  }

  async function recoverRequestTaskFromServer(requestTask) {
    if (!activePw || !requestTask?.requestId) {
      return { state: "idle" };
    }

    try {
      const data = await fetchRecoverableGenerationRequest(activePw, requestTask.requestId);
      const nextRemainingCredits = normalizeRemainingCredits(
        data?.result?.quota?.remainingCredits ?? data?.quota?.remainingCredits,
      );

      if (nextRemainingCredits !== null) {
        setRemainingQuota(nextRemainingCredits);
      }

      if (isOrphanedPendingRequestTask(requestTask, data?.backendStartedAt)) {
        updateRequestTask(requestTask.requestId, buildOrphanedRequestTaskPatch(requestTask));
        return {
          state: "failed",
          data,
        };
      }

      if (data?.status === "succeeded" && data?.result) {
        const nextResults = buildGeneratedImageRecords(data.result, {
          promptSnapshot: requestTask.promptSnapshot,
        });
        const storyboardCellId =
          normalizeTextValue(requestTask?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(storyboardCells, requestTask?.requestId);
        const recoveredStoryboardResult =
          storyboardCellId
            ? buildGeneratedImageRecord(data.result, {
                promptSnapshot: requestTask.promptSnapshot,
                storyboardCellId,
                storyboardCellLabel: requestTask?.storyboardCellLabel || "",
                storyboardCellCoordinate: requestTask?.storyboardCellCoordinate || "",
              })
            : null;

        if (nextResults.length === 0) {
          throw new Error("banana 已完成任务，但恢复结果失败");
        }

        if (storyboardCellId && recoveredStoryboardResult) {
          updateStoryboardCell(storyboardCellId, (cell) => ({
            ...cell,
            status: "success",
            statusText: "已恢复上一次请求的图片结果",
            error: "",
            pendingRequestId: "",
            record: recoveredStoryboardResult,
          }));
        }

        setCurrentGenerationSelection(nextResults, nextResults[0]);
        setStudioError("");
        setStudioNotice("已恢复上一次请求的图片结果");
        updateRequestTask(requestTask.requestId, {
          status: "recovered",
          stage: "result",
          message: data?.message || "已恢复上一次请求的图片结果",
          error: "",
          canRetry: data?.canRetry !== false,
          queuePosition: 0,
          queueRateLimitWaitMs: 0,
        });

        try {
          await persistGeneratedRecords(nextResults, nextResults[0].id);
        } catch (error) {
          console.warn("Persist recovered generation result failed:", error);
          setStudioError("图片已恢复，但写入本地资源管理器失败");
        }

        return {
          state: "recovered",
          data,
        };
      }

      if (data?.status === "failed") {
        const storyboardCellId =
          normalizeTextValue(requestTask?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(storyboardCells, requestTask?.requestId);

        if (storyboardCellId) {
          updateStoryboardCell(storyboardCellId, (cell) => ({
            ...cell,
            status: cell?.record ? "success" : "idle",
            statusText: "",
            error: data?.error || data?.message || "banana 任务失败",
            pendingRequestId: "",
          }));
        }

        setStudioNotice("");
        setStudioError(data?.error || data?.message || "banana 任务失败");
        updateRequestTask(requestTask.requestId, {
          status: "failed",
          stage: data?.stage || "error",
          message: data?.message || "banana 任务失败",
          error: data?.error || data?.message || "banana 任务失败",
          canRetry: data?.canRetry !== false,
          queuePosition: data?.queuePosition || 0,
          queueActiveCount: data?.queueActiveCount || 0,
          queuePendingCount: data?.queuePendingCount || 0,
          queueConcurrency: data?.queueConcurrency || 0,
          queueRateLimitWaitMs: data?.queueRateLimitWaitMs || 0,
          queueRateLimitedUntil: data?.queueRateLimitedUntil || "",
        });
        return {
          state: "failed",
          data,
        };
      }

      if (data?.status === "cancelled") {
        const storyboardCellId =
          normalizeTextValue(requestTask?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(storyboardCells, requestTask?.requestId);

        if (storyboardCellId) {
          updateStoryboardCell(storyboardCellId, (cell) => ({
            ...cell,
            status: cell?.record ? "success" : "idle",
            statusText: data?.message || "任务已取消",
            error: "",
            pendingRequestId: "",
          }));
        }

        setStudioNotice(data?.message || "任务已取消");
        setStudioError("");
        updateRequestTask(
          requestTask.requestId,
          buildCancelledRequestTaskPatch(data?.message || "任务已取消"),
        );

        return {
          state: "cancelled",
          data,
        };
      }

      if (isRequestTaskRecoveryStale(requestTask, data?.updatedAt)) {
        const staleTaskPatch = buildMissingRecoverableRequestTaskPatch(
          requestTask,
          "任务状态长时间未更新，后端可能已丢失该任务，请重新生成",
        );
        updateRequestTask(requestTask.requestId, staleTaskPatch);
        setStudioNotice("");
        setStudioError(staleTaskPatch.error);

        return {
          state: "failed",
          data,
        };
      }

      updateRequestTask(requestTask.requestId, {
        status: normalizeRequestTaskProgress(data)?.status || "processing",
        stage: data?.stage || "accepted",
        message:
          data?.message || "网络中断后任务仍在后端处理中，恢复联网后会自动取回结果。",
        error: data?.error || "",
        canRetry: data?.canRetry !== false,
        queuePosition: data?.queuePosition || 0,
        queueActiveCount: data?.queueActiveCount || 0,
        queuePendingCount: data?.queuePendingCount || 0,
        queueConcurrency: data?.queueConcurrency || 0,
        queueRateLimitWaitMs: data?.queueRateLimitWaitMs || 0,
        queueRateLimitedUntil: data?.queueRateLimitedUntil || "",
      });
      setStudioNotice(
        data?.message || "网络中断后任务仍在后端处理中，恢复联网后会自动取回结果。",
      );

      return {
        state: "pending",
        data,
      };
    } catch (error) {
      if (error?.status === 404) {
        const createdAtMs = Date.parse(requestTask?.createdAt || "");
        const isFreshRequest =
          Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 60 * 1000;

        if (isFreshRequest) {
          setStudioNotice("正在尝试恢复上一次请求结果...");
          updateRequestTask(requestTask.requestId, {
            status: "queued",
            stage: "queued",
            message: "正在尝试恢复上一次请求结果...",
          });
          return {
            state: "pending",
            error,
          };
        }

        setStudioNotice("");
        setStudioError("未找到待恢复的请求记录，请重新生成");
        updateRequestTask(requestTask.requestId, {
          status: "failed",
          stage: "error",
          message: "未找到待恢复的请求记录，请重新生成",
          error: "未找到待恢复的请求记录，请重新生成",
        });
        return {
          state: "missing",
          error,
        };
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStudioNotice("网络已断开，恢复联网后会自动取回上一次生成结果。");
      }

      throw error;
    }
  }

  async function ensureGenerationLibraryLoaded() {
    if (generationLibraryLoaded) {
      return generationLibrary;
    }

    if (generationLibraryLoadPromiseRef.current) {
      return generationLibraryLoadPromiseRef.current;
    }

    const loadPromise = readPersistedGenerationLibrary()
      .then((records) => {
        setGenerationLibrary(records);
        setGenerationLibraryLoaded(true);
        return records;
      })
      .finally(() => {
        generationLibraryLoadPromiseRef.current = null;
      });

    generationLibraryLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }

  useEffect(() => {
    let cancelled = false;

    async function restorePersistedImages() {
      try {
        const [
          persistedCurrentRecord,
          persistedStoryboardCells,
          persistedReferenceImages,
          persistedSimpleReferenceImages,
        ] = await Promise.all([
          readPersistedCurrentGenerationRecord(),
          readPersistedStoryboardCells(),
          readPersistedReferenceImages(),
          readPersistedSimpleReferenceImages(),
        ]);

        if (cancelled) {
          return;
        }

        setGenerationResult(persistedCurrentRecord);
        setGenerationResults(persistedCurrentRecord ? [persistedCurrentRecord] : []);
        setReferenceImages(persistedReferenceImages.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT));
        setSimpleReferenceImages(
          persistedSimpleReferenceImages.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT),
        );
        setStoryboardCells((currentValue) =>
          mergeHydratedStoryboardCells(
            persistedStoryboardCells,
            currentValue,
            professionalLayoutRows,
            professionalLayoutColumns,
          ),
        );
      } catch (error) {
        console.warn("Restore persisted generation result failed:", error);
      } finally {
        if (!cancelled) {
          setSimpleReferenceImagesHydrated(true);
          setReferenceImagesHydrated(true);
          setStoryboardCellsHydrated(true);
        }
      }
    }

    void restorePersistedImages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (backendRequestCount !== 0 || !backendBusyLabel) {
      return;
    }

    setBackendBusyLabel("");
    setBackendBusyStartedAt(0);
    setBackendBusyTickAt(0);
    setBackendBusyStreamText("");
  }, [backendBusyLabel, backendRequestCount]);

  useEffect(() => {
    if (!isBackendBusy) {
      return;
    }

    setBackendBusyTickAt(Date.now());

    const intervalId = window.setInterval(() => {
      setBackendBusyTickAt(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isBackendBusy]);

  useEffect(() => {
    if (isE2eStudioMode) {
      setActivePw("__banana_e2e__");
      setRemainingQuota(null);
      setSessionState("ready");
      return;
    }

    if (routeMode === "studio") {
      if (!urlPassword) {
        setActivePw("");
        setRemainingQuota(null);
        setSessionState("locked");
      }

      return;
    }

    setActivePw("");
    setRemainingQuota(null);
    setSessionState("locked");
  }, [isE2eStudioMode, routeMode, urlPassword]);

  useEffect(() => {
    if (!shouldAutoVerifyStudioPassword) {
      return;
    }

    let cancelled = false;
    setSessionState("checking");
    setAuthPending(true);
    setAuthError("");

    const releaseBackendRequest = beginBackendRequest(
      "正在校验提取码...",
      secondsToEstimateMs(3),
    );

    async function verifyStudioPassword() {
      try {
        const data = await verifyPassword(urlPassword);

        if (cancelled) {
          return;
        }

        setActivePw(urlPassword);
        setRemainingQuota(normalizeRemainingCredits(data?.pw?.remainingCredits));
        setSessionState("ready");
        setAuthError("");
      } catch {
        if (cancelled) {
          return;
        }

        setActivePw("");
        setRemainingQuota(null);
        setSessionState("locked");

        if (typeof window !== "undefined") {
          window.location.replace(LOGIN_PATH);
        }
      } finally {
        if (!cancelled) {
          releaseBackendRequest();
          setAuthPending(false);
        }
      }
    }

    void verifyStudioPassword();

    return () => {
      cancelled = true;
      releaseBackendRequest();
    };
  }, [shouldAutoVerifyStudioPassword, urlPassword]);

  useEffect(() => {
    if (sessionState !== "ready" || !activePw) {
      return;
    }

    let cancelled = false;

    async function loadModels() {
      const releaseBackendRequest = beginBackendRequest(
        "正在加载 banana 模型...",
        secondsToEstimateMs(4),
      );

      try {
        const data = await fetchBananaModels(activePw);

        if (cancelled) {
          return;
        }

        setModels(data.models || []);
        setProfessionalSelectedModelId((currentValue) => {
          if (currentValue && data.models?.some((item) => item.id === currentValue)) {
            return currentValue;
          }

          const storedModelId =
            readLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY) ||
            readLocalValue(LEGACY_SELECTED_MODEL_STORAGE_KEY);

          if (storedModelId && data.models?.some((item) => item.id === storedModelId)) {
            return storedModelId;
          }

          return data.models?.[0]?.id || "";
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStudioError(error instanceof Error ? error.message : "无法加载 banana 模型");
      } finally {
        releaseBackendRequest();
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [activePw, sessionState]);

  function closeTaskStatusStream() {
    if (taskStatusStreamReconnectTimeoutRef.current) {
      window.clearTimeout(taskStatusStreamReconnectTimeoutRef.current);
      taskStatusStreamReconnectTimeoutRef.current = 0;
    }

    taskStatusStreamGenerationRef.current += 1;
    taskStatusStreamHandleRef.current?.close?.();
    taskStatusStreamHandleRef.current = null;
    taskStatusStreamRequestIdsRef.current = [];
    taskStatusStreamPasswordRef.current = "";
  }

  useEffect(() => {
    return () => {
      closeTaskStatusStream();
    };
  }, []);

  useEffect(() => {
    const shouldSubscribe =
      sessionState === "ready" &&
      Boolean(activePw) &&
      recoverableRequestTasks.length > 0 &&
      taskRecoveryPauseCount === 0 &&
      !studioPending &&
      !enhancePending;

    if (!shouldSubscribe) {
      closeTaskStatusStream();
      return;
    }

    const desiredRequestIds = recoverableRequestTasks.map((task) => task.requestId);
    const currentRequestIds = taskStatusStreamRequestIdsRef.current;
    const hasActiveStream = Boolean(taskStatusStreamHandleRef.current);
    const samePassword = taskStatusStreamPasswordRef.current === activePw;
    const alreadyWatchingDesiredTasks =
      hasActiveStream &&
      samePassword &&
      desiredRequestIds.every((requestId) => currentRequestIds.includes(requestId));

    if (alreadyWatchingDesiredTasks) {
      return;
    }

    const recoverTaskResultIfNeeded = async (requestId) => {
      if (
        !requestId ||
        taskRecoveryInFlightRequestIdsRef.current.has(requestId)
      ) {
        return;
      }

      const requestTask =
        useTaskStore
          .getState()
          .requestTasks.find((task) => task.requestId === requestId) || null;

      if (!requestTask || requestTask.status === "recovered") {
        return;
      }

      taskRecoveryInFlightRequestIdsRef.current.add(requestId);

      try {
        await recoverRequestTaskFromServer(requestTask);
      } finally {
        taskRecoveryInFlightRequestIdsRef.current.delete(requestId);
      }
    };

    closeTaskStatusStream();

    const streamGeneration = taskStatusStreamGenerationRef.current + 1;
    taskStatusStreamGenerationRef.current = streamGeneration;
    taskStatusStreamRequestIdsRef.current = desiredRequestIds.slice();
    taskStatusStreamPasswordRef.current = activePw;

    const connectTaskStream = () => {
      if (taskStatusStreamGenerationRef.current !== streamGeneration) {
        return;
      }

      taskStatusStreamHandleRef.current = subscribeTaskStatusStream(
        activePw,
        desiredRequestIds,
        {
          onStatus: (eventPayload) => {
            bumpDevMetric("stream:taskStatus:onStatus");

            if (
              taskStatusStreamGenerationRef.current !== streamGeneration ||
              !eventPayload?.requestId ||
              eventPayload?.stage === "heartbeat"
            ) {
              return;
            }

            const currentTask =
              useTaskStore
                .getState()
                .requestTasks.find((task) => task.requestId === eventPayload.requestId) || null;

            if (isOrphanedPendingRequestTask(currentTask, eventPayload.backendStartedAt)) {
              updateRequestTask(eventPayload.requestId, buildOrphanedRequestTaskPatch(currentTask));
              return;
            }

            updateRequestTask(eventPayload.requestId, {
              status: normalizeRequestTaskProgress(eventPayload)?.status || eventPayload.status,
              stage: eventPayload.stage || "accepted",
              message: eventPayload.message || "",
              error: eventPayload.error || "",
              canRetry: eventPayload.canRetry !== false,
              queuePosition: eventPayload.queuePosition || 0,
              queueActiveCount: eventPayload.queueActiveCount || 0,
              queuePendingCount: eventPayload.queuePendingCount || 0,
              queueConcurrency: eventPayload.queueConcurrency || 0,
              queueRateLimitWaitMs: eventPayload.queueRateLimitWaitMs || 0,
              queueRateLimitedUntil: eventPayload.queueRateLimitedUntil || "",
            });

            if (eventPayload.status === "succeeded") {
              void recoverTaskResultIfNeeded(eventPayload.requestId);
            }
          },
        },
      );

      taskStatusStreamHandleRef.current.ready
        .then(() => {})
        .catch(() => {
          if (taskStatusStreamGenerationRef.current !== streamGeneration) {
            return;
          }

          if (taskStatusStreamReconnectTimeoutRef.current) {
            window.clearTimeout(taskStatusStreamReconnectTimeoutRef.current);
          }

          taskStatusStreamReconnectTimeoutRef.current = window.setTimeout(() => {
            taskStatusStreamReconnectTimeoutRef.current = 0;
            connectTaskStream();
          }, 1500);
        });
    };

    connectTaskStream();
  }, [
    activePw,
    enhancePending,
    recoverableRequestTaskSignature,
    sessionState,
    taskRecoveryPauseCount,
    studioPending,
    updateRequestTask,
  ]);

  const selectedModel = useMemo(() => {
    return models.find((item) => item.id === professionalSelectedModelId) || null;
  }, [models, professionalSelectedModelId]);
  const simplePanelModelId = useMemo(() => {
    return resolveSimplePanelModelId(models, "");
  }, [models]);
  const simplePanelModel = useMemo(() => {
    return models.find((item) => item.id === simplePanelModelId) || null;
  }, [models, simplePanelModelId]);

  const availableAspectRatioOptions = useMemo(() => {
    return getModelAspectRatioOptions(selectedModel);
  }, [selectedModel]);
  const availableAspectRatioValueSet = useMemo(
    () => new Set(availableAspectRatioOptions.map((option) => option.value)),
    [availableAspectRatioOptions],
  );
  const availableImageSizeOptions = useMemo(() => {
    return getModelImageSizeOptions(selectedModel);
  }, [selectedModel]);
  const availableImageSizeValueSet = useMemo(
    () => new Set(availableImageSizeOptions.map((option) => option.value)),
    [availableImageSizeOptions],
  );
  const professionalDefaultCellAspectRatio = useMemo(() => {
    if (
      availableAspectRatioOptions.some(
        (option) => option.value === PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO,
      )
    ) {
      return PROFESSIONAL_DEFAULT_CELL_ASPECT_RATIO;
    }

    return availableAspectRatioOptions[0]?.value || "1:1";
  }, [availableAspectRatioOptions]);
  const professionalDefaultCellImageSize = useMemo(() => {
    if (availableImageSizeOptions.some((option) => option.value === "1K")) {
      return "1K";
    }

    return availableImageSizeOptions[0]?.value || "1K";
  }, [availableImageSizeOptions]);
  const professionalStoryboardAspectRatioValue = useMemo(() => {
    if (availableAspectRatioValueSet.has(professionalStoryboardAspectRatio)) {
      return professionalStoryboardAspectRatio;
    }

    return professionalDefaultCellAspectRatio;
  }, [
    availableAspectRatioValueSet,
    professionalDefaultCellAspectRatio,
    professionalStoryboardAspectRatio,
  ]);
  const professionalStoryboardImageSizeValue = useMemo(() => {
    if (availableImageSizeValueSet.has(professionalStoryboardImageSize)) {
      return professionalStoryboardImageSize;
    }

    return professionalDefaultCellImageSize;
  }, [
    availableImageSizeValueSet,
    professionalDefaultCellImageSize,
    professionalStoryboardImageSize,
  ]);
  const storyboardCellAspectRatio = useMemo(() => {
    const cellWidth = professionalExportMetrics?.cellWidth || 1;
    const cellHeight = professionalExportMetrics?.cellHeight || 1;
    return cellWidth / cellHeight;
  }, [professionalExportMetrics]);
  const recommendedStoryboardAspectRatio = useMemo(
    () =>
      findRecommendedStoryboardAspectRatioOption(
        availableAspectRatioOptions,
        storyboardCellAspectRatio,
      ),
    [availableAspectRatioOptions, storyboardCellAspectRatio],
  );
  const canApplyRecommendedStoryboardAspectRatio =
    recommendedStoryboardAspectRatio &&
    recommendedStoryboardAspectRatio.option.value !== professionalStoryboardAspectRatioValue;
  const latestStoryboardTaskByCellId = useMemo(() => {
    const nextTaskMap = new Map();

    requestTasks.forEach((task) => {
      const storyboardCellId =
        normalizeTextValue(task?.storyboardCellId) ||
        findStoryboardCellIdByPendingRequestId(storyboardCells, task?.requestId);

      if (!storyboardCellId || !storyboardCells[storyboardCellId]) {
        return;
      }

      const taskTimeMs =
        parseRequestTaskTimeMs(task?.updatedAt) || parseRequestTaskTimeMs(task?.createdAt);
      const currentTask = nextTaskMap.get(storyboardCellId);
      const currentTaskTimeMs = currentTask
        ? parseRequestTaskTimeMs(currentTask?.updatedAt) ||
          parseRequestTaskTimeMs(currentTask?.createdAt)
        : 0;

      if (!currentTask || taskTimeMs >= currentTaskTimeMs) {
        nextTaskMap.set(storyboardCellId, task);
      }
    });

    return nextTaskMap;
  }, [requestTasks, storyboardCells]);
  const storyboardRuntimeCells = useMemo(
    () =>
      Object.fromEntries(
        storyboardCellDefinitions.map((definition) => {
          const baseCell = storyboardCells[definition.id] || createStoryboardCellState(definition);
          const task = latestStoryboardTaskByCellId.get(definition.id);

          if (task) {
            const patch = buildStoryboardCellTaskPatch(task, baseCell);

            return [
              definition.id,
              patch
                ? {
                    ...baseCell,
                    ...patch,
                  }
                : baseCell,
            ];
          }

          if (baseCell.status === "loading") {
            return [
              definition.id,
              {
                ...baseCell,
                pendingRequestId: "",
                status: baseCell.record ? "success" : "idle",
                statusText: "",
                error: "",
              },
            ];
          }

          return [definition.id, baseCell];
        }),
      ),
    [latestStoryboardTaskByCellId, storyboardCellDefinitions, storyboardCells],
  );
  const storyboardEditorCell = storyboardEditorCellId
    ? storyboardRuntimeCells[storyboardEditorCellId] || null
    : null;
  const activeStoryboardDragCell = activeStoryboardDragId
    ? storyboardRuntimeCells[activeStoryboardDragId] || null
    : null;
  const storyboardCellList = useMemo(
    () =>
      storyboardCellDefinitions.map(
        (definition) =>
          storyboardRuntimeCells[definition.id] || createStoryboardCellState(definition),
      ),
    [
      storyboardCellDefinitions,
      storyboardRuntimeCells,
    ],
  );
  const storyboardSortableIds = useMemo(
    () => storyboardCellList.map((cell) => cell.id),
    [storyboardCellList],
  );
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    if (
      storyboardDragSensorsDebugRef.current &&
      storyboardDragSensorsDebugRef.current !== storyboardDragSensors
    ) {
      bumpDevMetric("identity:storyboardDragSensors:changed");
    }

    storyboardDragSensorsDebugRef.current = storyboardDragSensors;
  }, [storyboardDragSensors]);
  const storyboardEditorCellIndex = useMemo(
    () => storyboardCellList.findIndex((cell) => cell.id === storyboardEditorCellId),
    [storyboardCellList, storyboardEditorCellId],
  );
  const previousStoryboardEditorCell =
    storyboardEditorCellIndex > 0 ? storyboardCellList[storyboardEditorCellIndex - 1] : null;
  const nextStoryboardEditorCell =
    storyboardEditorCellIndex >= 0 && storyboardEditorCellIndex < storyboardCellList.length - 1
      ? storyboardCellList[storyboardEditorCellIndex + 1]
      : null;
  const storyboardCellClearConfirmCell = storyboardCellClearConfirmCellId
    ? storyboardRuntimeCells[storyboardCellClearConfirmCellId] || null
    : null;
  const requestTaskCancelConfirmTask = requestTaskCancelConfirmId
    ? requestTasks.find((task) => task.requestId === requestTaskCancelConfirmId) || null
    : null;
  const storyboardHasContent = useMemo(
    () => storyboardCellList.some((cell) => doesStoryboardCellHaveContent(cell)),
    [storyboardCellList],
  );
  const storyboardShareText = useMemo(() => {
    const shareSections = [
      "专业模式分享",
      "",
      "参数",
      `底模：${selectedModel?.name || professionalSelectedModelId || "未选择"}`,
      `常用场景：${professionalCanvasSizeOption.label}`,
      `分镜布局：${professionalLayoutRows} 行 × ${professionalLayoutColumns} 列`,
      `图片比例：${professionalStoryboardAspectRatioValue}`,
      `分辨率：${professionalStoryboardImageSizeValue}`,
      `分割线：${professionalStoryboardDividerWidthPx}px`,
      `配文字号：${professionalStoryboardCaptionFontSizePercent}%`,
      `整体画风参考图：${professionalStyleReference?.name || "未设置"}`,
      "",
      "全局提示词与画风参考图",
      normalizeTextValue(professionalGlobalPrompt) || "未填写",
      "",
      "分镜提示词与配文",
    ];
    const cellSections = storyboardCellList
      .map((cell) => {
        const prompt = normalizeTextValue(cell.prompt);
        const caption = normalizeTextValue(cell.caption);

        if (!prompt && !caption) {
          return "";
        }

        return [
          `${cell.label}｜行 ${cell.row} / 列 ${cell.column}`,
          `提示词：${prompt || "未填写"}`,
          `配文：${caption || "未填写"}`,
          `格子参考图：${cell.referenceImages?.[0]?.name || "未设置"}`,
        ].join("\n");
      })
      .filter(Boolean);

    return [
      ...shareSections,
      ...(cellSections.length > 0 ? cellSections : ["未填写任何格子提示词或配文"]),
    ]
      .join("\n\n")
      .trim();
  }, [
    professionalCanvasSizeOption.label,
    professionalGlobalPrompt,
    professionalLayoutColumns,
    professionalLayoutRows,
    professionalSelectedModelId,
    professionalStoryboardAspectRatioValue,
    professionalStoryboardCaptionFontSizePercent,
    professionalStoryboardDividerWidthPx,
    professionalStoryboardImageSizeValue,
    professionalStyleReference?.name,
    selectedModel?.name,
    storyboardCellList,
  ]);
  const storyboardHasLoadingCells = useMemo(
    () => storyboardCellList.some((cell) => cell.status === "loading"),
    [storyboardCellList],
  );
  const professionalExportHasRenderableContent = useMemo(
    () =>
      storyboardCellList.some(
        (cell) => cell.record || normalizeTextValue(cell.prompt),
      ),
    [storyboardCellList],
  );

  const simplePanelImageSize = useMemo(() => {
    const simpleImageSizeOptions = getModelImageSizeOptions(simplePanelModel);

    if (simpleImageSizeOptions.some((option) => option.value === SIMPLE_PANEL_DEFAULTS.imageSize)) {
      return SIMPLE_PANEL_DEFAULTS.imageSize;
    }

    return simpleImageSizeOptions[0]?.value || "1K";
  }, [simplePanelModel]);
  const generationModelId = isSimplePanelMode ? simplePanelModelId : professionalSelectedModelId;

  const generationAspectRatio = isSimplePanelMode
    ? null
    : professionalStoryboardAspectRatioValue;
  const generationImageSize = isSimplePanelMode
    ? simplePanelImageSize
    : professionalStoryboardImageSizeValue;
  const generationImageCount = isSimplePanelMode
    ? SIMPLE_PANEL_DEFAULTS.imageCount
    : professionalSelectedImageCount;
  const generationLayoutRows = isSimplePanelMode
    ? SIMPLE_PANEL_DEFAULTS.layoutRows
    : professionalLayoutRows;
  const generationLayoutColumns = isSimplePanelMode
    ? SIMPLE_PANEL_DEFAULTS.layoutColumns
    : professionalLayoutColumns;
  const generationResultModel = useMemo(() => {
    if (!generationResult?.bananaModelId) {
      return null;
    }

    return models.find((item) => item.id === generationResult.bananaModelId) || null;
  }, [generationResult?.bananaModelId, models]);

  const enhancementTargetImageSize = useMemo(() => {
    if (!generationResult) {
      return "";
    }

    const supportedSizes = generationResultModel?.supportedImageSizes || ["1K"];
    return getNextImageSize(
      normalizeImageSizeValue(generationResult.imageSize || "1K"),
      supportedSizes,
    );
  }, [generationResult, generationResultModel]);

  const canEnhanceGeneration = Boolean(
    generationResult &&
      generationResultModel?.supportsImageSizeParam &&
      enhancementTargetImageSize,
  );

  useEffect(() => {
    writeLocalValue(PANEL_MODE_STORAGE_KEY, panelMode);
  }, [panelMode]);

  useEffect(() => {
    writeLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY, professionalSelectedModelId);
  }, [professionalSelectedModelId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      writeLocalValue(PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY, professionalGlobalPrompt);
    }, PROMPT_STORAGE_WRITE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [professionalGlobalPrompt]);

  useEffect(() => {
    if (
      normalizeCanvasScenarioValue(
        professionalCanvasSize,
        professionalCustomScenarios,
      ) !== professionalCanvasSize
    ) {
      setProfessionalCanvasSize(CANVAS_SIZE_OPTIONS[0].value);
      return;
    }

    writeLocalValue(PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY, professionalCanvasSize);
  }, [professionalCanvasSize, professionalCustomScenarios]);

  useEffect(() => {
    const persistedValue = buildPersistedProfessionalCustomScenarios(professionalCustomScenarios);
    writeLocalValue(
      PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY,
      persistedValue.length > 0 ? JSON.stringify(persistedValue) : "",
    );
  }, [professionalCustomScenarios]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY,
      String(normalizeCanvasDimensionValue(professionalCustomCanvasWidth, DEFAULT_CUSTOM_CANVAS_WIDTH)),
    );
  }, [professionalCustomCanvasWidth]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY,
      String(normalizeCanvasDimensionValue(professionalCustomCanvasHeight, DEFAULT_CUSTOM_CANVAS_HEIGHT)),
    );
  }, [professionalCustomCanvasHeight]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
      String(professionalLayoutRows),
    );
  }, [professionalLayoutRows]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
      String(professionalLayoutColumns),
    );
  }, [professionalLayoutColumns]);

  useEffect(() => {
    if (!availableAspectRatioValueSet.has(professionalStoryboardAspectRatio)) {
      setProfessionalStoryboardAspectRatio(professionalDefaultCellAspectRatio);
      return;
    }

    writeLocalValue(
      PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY,
      professionalStoryboardAspectRatio,
    );
  }, [
    availableAspectRatioValueSet,
    professionalDefaultCellAspectRatio,
    professionalStoryboardAspectRatio,
  ]);

  useEffect(() => {
    if (!availableImageSizeValueSet.has(professionalStoryboardImageSize)) {
      setProfessionalStoryboardImageSize(professionalDefaultCellImageSize);
      return;
    }

    writeLocalValue(
      PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY,
      professionalStoryboardImageSize,
    );
  }, [
    availableImageSizeValueSet,
    professionalDefaultCellImageSize,
    professionalStoryboardImageSize,
  ]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY,
      String(normalizeStoryboardDividerWidthPx(professionalStoryboardDividerWidthPx)),
    );
  }, [professionalStoryboardDividerWidthPx]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY,
      String(
        normalizeStoryboardCaptionFontSizePercent(
          professionalStoryboardCaptionFontSizePercent,
        ),
      ),
    );
  }, [professionalStoryboardCaptionFontSizePercent]);

  useEffect(() => {
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY,
      String(
        normalizeStoryboardCaptionBackgroundAlphaPercent(
          professionalStoryboardCaptionBackgroundAlphaPercent,
        ),
      ),
    );
  }, [professionalStoryboardCaptionBackgroundAlphaPercent]);

  useEffect(() => {
    if (!SUPPORTED_IMAGE_COUNT_VALUES.has(professionalSelectedImageCount)) {
      setProfessionalSelectedImageCount(1);
      return;
    }

    writeLocalValue(
      PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY,
      String(professionalSelectedImageCount),
    );
  }, [professionalSelectedImageCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      writeLocalValue(SIMPLE_PROMPT_STORAGE_KEY, simplePrompt);
    }, PROMPT_STORAGE_WRITE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [simplePrompt]);

  useEffect(() => {
    setStoryboardCells((currentValue) =>
      normalizeStoryboardCells(currentValue, professionalLayoutRows, professionalLayoutColumns),
    );
  }, [
    professionalLayoutColumns,
    professionalLayoutRows,
  ]);

  useEffect(() => {
    if (!storyboardCellsHydrated) {
      return;
    }

    bumpDevMetric("effect:storyboardRequestTaskSyncRuns");

    setStoryboardCells((currentValue) => {
      const requestTaskIdSet = new Set(
        requestTasks
          .map((task) => normalizeTextValue(task?.requestId))
          .filter(Boolean),
      );
      const latestStoryboardTaskByCellId = new Map();
      let hasChanges = false;
      const nextValue = { ...currentValue };

      Object.entries(currentValue).forEach(([cellId, currentCell]) => {
        if (currentCell?.status !== "loading") {
          return;
        }

        const pendingRequestId = normalizeTextValue(currentCell?.pendingRequestId);

        if (pendingRequestId && requestTaskIdSet.has(pendingRequestId)) {
          return;
        }

        nextValue[cellId] = {
          ...currentCell,
          pendingRequestId: "",
          status: currentCell?.record ? "success" : "idle",
          statusText: "",
          error: "",
        };
        hasChanges = true;
        bumpDevMetric("effect:storyboardRequestTaskOrphanedCellsCleared");
      });

      requestTasks.forEach((task) => {
        const storyboardCellId =
          normalizeTextValue(task?.storyboardCellId) ||
          findStoryboardCellIdByPendingRequestId(currentValue, task?.requestId);

        if (!storyboardCellId || !currentValue[storyboardCellId]) {
          return;
        }

        const taskTimeMs =
          parseRequestTaskTimeMs(task?.updatedAt) || parseRequestTaskTimeMs(task?.createdAt);
        const currentTask = latestStoryboardTaskByCellId.get(storyboardCellId);
        const currentTaskTimeMs = currentTask
          ? parseRequestTaskTimeMs(currentTask?.updatedAt) ||
            parseRequestTaskTimeMs(currentTask?.createdAt)
          : 0;

        if (!currentTask || taskTimeMs >= currentTaskTimeMs) {
          latestStoryboardTaskByCellId.set(storyboardCellId, task);
        }
      });

      latestStoryboardTaskByCellId.forEach((task, cellId) => {
        const currentCell = nextValue[cellId];

        if (!currentCell) {
          return;
        }

        const patch = buildStoryboardCellTaskPatch(task, currentCell);

        if (!patch) {
          return;
        }

        const nextCell = {
          ...currentCell,
          ...patch,
        };

        if (
          nextCell.status !== currentCell.status ||
          nextCell.statusText !== currentCell.statusText ||
          nextCell.error !== currentCell.error ||
          nextCell.pendingRequestId !== currentCell.pendingRequestId
        ) {
          nextValue[cellId] = nextCell;
          hasChanges = true;
          bumpDevMetric("effect:storyboardRequestTaskPatchedCells");
        }
      });

      return hasChanges ? nextValue : currentValue;
    });
  }, [requestTasks, storyboardCellsHydrated]);

  useEffect(() => {
    if (!storyboardCellsHydrated || typeof window === "undefined") {
      return;
    }

    bumpDevMetric("effect:writePersistedStoryboardCells:scheduled");

    const timeoutId = window.setTimeout(() => {
      bumpDevMetric("effect:writePersistedStoryboardCells:flush");
      void writePersistedStoryboardCells(storyboardCells).catch((error) => {
        console.warn("Persist storyboard cells failed:", error);
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [storyboardCells, storyboardCellsHydrated]);

  useEffect(() => {
    if (!simpleReferenceImagesHydrated || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writePersistedSimpleReferenceImages(simpleReferenceImages).catch((error) => {
        console.warn("Persist simple reference images failed:", error);
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [simpleReferenceImages, simpleReferenceImagesHydrated]);

  useEffect(() => {
    if (!referenceImagesHydrated || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writePersistedReferenceImages(referenceImages).catch((error) => {
        console.warn("Persist professional reference images failed:", error);
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [referenceImages, referenceImagesHydrated]);

  useEffect(() => {
    if (!storyboardEditorCellId) {
      return;
    }

    if (storyboardRuntimeCells[storyboardEditorCellId]) {
      return;
    }

    setStoryboardEditorCellId("");
  }, [storyboardEditorCellId, storyboardRuntimeCells]);

  useEffect(() => {
    if (!storyboardCellClearConfirmCellId) {
      return;
    }

    const targetCell = storyboardRuntimeCells[storyboardCellClearConfirmCellId];

    if (targetCell && doesStoryboardCellHaveContent(targetCell)) {
      return;
    }

    setStoryboardCellClearConfirmCellId("");
  }, [storyboardCellClearConfirmCellId, storyboardRuntimeCells]);

  useEffect(() => {
    setStoryboardLibraryPickerOpen(false);
    setStoryboardLibraryPickerPending(false);
    if (storyboardLibraryPickerTimeoutRef.current) {
      window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      storyboardLibraryPickerTimeoutRef.current = null;
    }
  }, [storyboardEditorCellId]);

  useEffect(() => {
    if (storyboardEditorMode === STORYBOARD_EDITOR_MODE_ASSET) {
      return;
    }

    setStoryboardLibraryPickerOpen(false);
    setStoryboardLibraryPickerPending(false);
    if (storyboardLibraryPickerTimeoutRef.current) {
      window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      storyboardLibraryPickerTimeoutRef.current = null;
    }
  }, [storyboardEditorMode]);

  useEffect(() => {
    return () => {
      if (storyboardShareCopyResetTimeoutRef.current) {
        window.clearTimeout(storyboardShareCopyResetTimeoutRef.current);
      }
      if (storyboardLibraryPickerTimeoutRef.current) {
        window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasLayoutValues) {
      return;
    }

    drawLayoutGuide(layoutCanvasRef.current, {
      aspectRatio: formatCanvasSizeAspectRatioValue(professionalCanvasSizeOption),
      rows: professionalLayoutRows,
      columns: professionalLayoutColumns,
    });
  }, [
    hasLayoutValues,
    professionalCanvasSizeOption,
    professionalLayoutColumns,
    professionalLayoutRows,
  ]);

  useEffect(() => {
    const textarea = promptTextareaRef.current;

    if (!textarea) {
      return;
    }

    if (isPromptFocusMode) {
      textarea.style.height = "100%";
      textarea.style.overflowY = "auto";
      return;
    }

    resizePromptTextarea(textarea);
  }, [isPromptFocusMode, simplePrompt]);

  useEffect(() => {
    if (!isPromptFocusMode) {
      return;
    }

    const textarea = promptTextareaRef.current;

    if (!textarea) {
      return;
    }

    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, [isPromptFocusMode]);

  useLayoutEffect(() => {
    const card = professionalExportCardElement;

    if (!card || !shouldRenderProfessionalExportPreview) {
      setProfessionalExportScale(1);
      return;
    }

    const updateScale = () => {
      const measuredCardWidth = card.getBoundingClientRect().width;
      const availableWidth = Math.max(measuredCardWidth, 1);
      const maxPreviewHeight = Math.max(
        Math.min(window.innerHeight * 0.72, 860),
        320,
      );
      const nextScale = Math.min(
        availableWidth / professionalCanvasSizeOption.width,
        maxPreviewHeight / professionalCanvasSizeOption.height,
        1,
      );

      setProfessionalExportScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale,
      );
    };

    const animationFrameId = window.requestAnimationFrame(() => {
      updateScale();
    });

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);

      return () => {
        window.cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", updateScale);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(card);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [
    professionalExportCardElement,
    professionalCanvasSizeOption.height,
    professionalCanvasSizeOption.width,
    shouldRenderProfessionalExportPreview,
  ]);

  useEffect(() => {
    if (!showPromptField && promptMode === "focus") {
      setPromptMode("simple");
    }
  }, [promptMode, showPromptField]);

  useEffect(() => {
    if (isProfessionalPanelMode) {
      return;
    }

    setStoryboardEditorCellId("");
    setStoryboardClearConfirmOpen(false);
    setStoryboardCellClearConfirmCellId("");
    setRequestTaskCancelConfirmId("");
  }, [isProfessionalPanelMode]);

  useEffect(() => {
    if (!requestTaskCancelConfirmId) {
      return;
    }

    if (!requestTaskCancelConfirmTask || isRequestTaskTerminal(requestTaskCancelConfirmTask)) {
      setRequestTaskCancelConfirmId("");
    }
  }, [requestTaskCancelConfirmId, requestTaskCancelConfirmTask]);

  useEffect(() => {
    if (
      (!imagePreviewOpen &&
        !resourceManagerOpen &&
        !storyboardEditorOpen &&
        !storyboardClearConfirmOpen &&
        !storyboardCellClearConfirmCellId) ||
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (imagePreviewOpen) {
      setImagePreviewViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (imagePreviewOpen) {
          closeImagePreview();
          return;
        }

        if (storyboardClearConfirmOpen) {
          closeStoryboardClearConfirm();
          return;
        }

        if (storyboardCellClearConfirmCellId) {
          closeStoryboardCellClearConfirm();
          return;
        }

        if (requestTaskCancelConfirmId) {
          closeRequestTaskCancelConfirm();
          return;
        }

        setResourceManagerOpen(false);
        return;
      }

      if (!imagePreviewOpen) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomImagePreview(0.4);
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        zoomImagePreview(-0.4);
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        resetImagePreviewTransform();
      }
    }

    function handleResize() {
      setImagePreviewViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [
    imagePreviewOpen,
    resourceManagerOpen,
    storyboardCellClearConfirmCellId,
    storyboardClearConfirmOpen,
    storyboardEditorOpen,
    requestTaskCancelConfirmId,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return undefined;
    }

    const sleep = (ms) =>
      new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const devTools = {
      resetMetrics() {
        resetDevMetrics();
      },
      getMetricsSnapshot() {
        return getDevMetricsSnapshot();
      },
      getStoryboardCellIds() {
        return storyboardCellDefinitions.map((definition) => definition.id);
      },
      async simulateStoryboardTaskStream({
        cellId = storyboardCellDefinitions[0]?.id || "",
        count = 20,
        delayMs = 16,
      } = {}) {
        const targetCellId =
          normalizeTextValue(cellId) || storyboardCellDefinitions[0]?.id || "";

        if (!targetCellId) {
          throw new Error("No storyboard cell available for simulation");
        }

        const requestId = `dev-storyboard-${Date.now()}`;
        const targetCell = storyboardCellsRef.current[targetCellId];

        updateStoryboardCell(targetCellId, (cell) => ({
          ...cell,
          pendingRequestId: requestId,
          status: "loading",
          statusText: "dev stream start",
          error: "",
        }));
        upsertRequestTask({
          requestId,
          type: "storyboard",
          mode: "professional",
          canRetry: true,
          promptSnapshot: targetCell?.prompt || "dev storyboard stream",
          storyboardCellId: targetCellId,
          storyboardCellLabel: targetCell?.label || "",
          storyboardCellCoordinate: targetCell?.coordinateLabel || "",
          createdAt: new Date().toISOString(),
          status: "accepted",
          stage: "accepted",
          message: "dev stream start",
        });

        for (let index = 0; index < count; index += 1) {
          bumpDevMetric("simulate:storyboardTaskStream:event");
          updateRequestTask(requestId, {
            status: "processing",
            stage: "processing",
            message: `dev storyboard message ${index + 1}/${count}`,
            error: "",
          });

          if (delayMs > 0) {
            await sleep(delayMs);
          }
        }

        return {
          cellId: targetCellId,
          requestId,
          count,
        };
      },
      async simulateBackendBusyStream({
        count = 20,
        delayMs = 16,
      } = {}) {
        const releaseBackendRequest = beginBackendRequest(
          "dev backend stream",
          secondsToEstimateMs(30),
        );

        try {
          for (let index = 0; index < count; index += 1) {
            bumpDevMetric("simulate:backendBusyStream:event");
            setBackendBusyLabel(`dev backend status ${index + 1}/${count}`);
            setBackendBusyStreamText(`dev backend text ${index + 1}/${count}`);

            if (delayMs > 0) {
              await sleep(delayMs);
            }
          }
        } finally {
          releaseBackendRequest();
        }

        return {
          count,
        };
      },
    };

    exposeDevTool("app", devTools);

    return () => {
      exposeDevTool("app", null);
    };
  }, [
    beginBackendRequest,
    storyboardCellDefinitions,
    updateRequestTask,
    upsertRequestTask,
  ]);

  useEffect(() => {
    if (
      !storyboardEditorOpen ||
      !storyboardEditorCellId ||
      imagePreviewOpen ||
      resourceManagerOpen ||
      storyboardClearConfirmOpen ||
      requestTaskCancelConfirmId ||
      typeof window === "undefined"
    ) {
      return;
    }

    function handlePaste(event) {
      const imageFiles = getImageFilesFromClipboardData(event.clipboardData);

      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();

      if (storyboardEditorMode === STORYBOARD_EDITOR_MODE_ASSET) {
        void appendStoryboardLocalImageFiles(imageFiles, "已粘贴剪贴板图片，仅作用于当前格子");
        return;
      }

      void appendStoryboardReferenceFiles(imageFiles);
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [
    imagePreviewOpen,
    requestTaskCancelConfirmId,
    resourceManagerOpen,
    storyboardClearConfirmOpen,
    storyboardEditorCellId,
    storyboardEditorMode,
    storyboardEditorOpen,
  ]);

  async function handleVerifySubmit(event) {
    event.preventDefault();
    setAuthPending(true);
    setAuthError("");
    const releaseBackendRequest = beginBackendRequest(
      "正在校验提取码...",
      secondsToEstimateMs(4),
    );

    try {
      const normalizedPassword = normalizeTextValue(password);
      const data = await verifyPassword(normalizedPassword);
      setActivePw(normalizedPassword);
      setRemainingQuota(normalizeRemainingCredits(data?.pw?.remainingCredits));
      setSessionState("ready");

      if (routeMode === "login" && typeof window !== "undefined") {
        const nextSearch = normalizedPassword
          ? `?pw=${encodeURIComponent(normalizedPassword)}`
          : "";
        window.location.replace(`${STUDIO_PATH}${nextSearch}`);
        return;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "提取码校验失败");
      setRemainingQuota(null);
      setSessionState("locked");
    } finally {
      releaseBackendRequest();
      setAuthPending(false);
    }
  }

  function handleLayoutCanvasMount(node) {
    layoutCanvasRef.current = node;

    if (!node || !hasLayoutValues) {
      return;
    }

    drawLayoutGuide(node, {
      aspectRatio: formatCanvasSizeAspectRatioValue(professionalCanvasSizeOption),
      rows: professionalLayoutRows,
      columns: professionalLayoutColumns,
    });
  }

  function triggerRecordDownload(record) {
    if (!record?.previewUrl || typeof document === "undefined") {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = record.previewUrl;
    anchor.download = record.downloadName || buildDownloadNameWithOptions({
      mimeType: record.mimeType,
    });
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function handleDownloadProfessionalExport() {
    if (!activePw || !professionalExportHasRenderableContent) {
      return;
    }

    setStudioError("");
    setProfessionalExportPending(true);
    const releaseBackendRequest = beginBackendRequest(
      "正在导出专业模式预览...",
      secondsToEstimateMs(12),
    );

    try {
      const { blob, filename } = await requestProfessionalExportPreview(
        activePw,
        buildProfessionalExportPayload({
          canvasSizeOption: professionalCanvasSizeOption,
          rows: professionalLayoutRows,
          columns: professionalLayoutColumns,
          cells: storyboardCellList,
          title: professionalGlobalPrompt || "专业模式导出预览",
          dividerStyle: {
            widthPx: professionalStoryboardDividerWidthPx,
          },
          captionStyle: {
            fontSizePercent: professionalStoryboardCaptionFontSizePercent,
            backgroundAlphaPercent: professionalStoryboardCaptionBackgroundAlphaPercent,
          },
        }),
      );

      await saveBlobFile(
        blob,
        filename ||
          buildDownloadNameWithOptions({
            mimeType: "image/png",
            suffix: "professional-export",
          }),
      );
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "导出预览失败");
    } finally {
      releaseBackendRequest();
      setProfessionalExportPending(false);
    }
  }

  async function applyImportedProfessionalScene(sceneState) {
    const persistedCustomScenarios = buildPersistedProfessionalCustomScenarios(
      sceneState.customScenarios,
    );

    setPanelMode(PANEL_MODE_PROFESSIONAL);
    setProfessionalSelectedModelId(sceneState.selectedModelId);
    setProfessionalGlobalPrompt(sceneState.globalPrompt);
    setProfessionalCustomScenarios(sceneState.customScenarios);
    setProfessionalCanvasSize(sceneState.canvasSize);
    setProfessionalCustomCanvasWidth(sceneState.customCanvasWidth);
    setProfessionalCustomCanvasHeight(sceneState.customCanvasHeight);
    setProfessionalLayoutRows(sceneState.layoutRows);
    setProfessionalLayoutColumns(sceneState.layoutColumns);
    setProfessionalStoryboardAspectRatio(sceneState.storyboardAspectRatio);
    setProfessionalStoryboardImageSize(sceneState.storyboardImageSize);
    setProfessionalSelectedImageCount(sceneState.selectedImageCount);
    setProfessionalStoryboardDividerWidthPx(sceneState.storyboardDividerWidthPx);
    setProfessionalStoryboardCaptionFontSizePercent(
      sceneState.storyboardCaptionFontSizePercent,
    );
    setProfessionalStoryboardCaptionBackgroundAlphaPercent(
      sceneState.storyboardCaptionBackgroundAlphaPercent,
    );
    setReferenceImages(sceneState.referenceImages);
    setReferenceImagesHydrated(true);
    setStoryboardCells(sceneState.storyboardCells);
    setStoryboardCellsHydrated(true);
    setPromptMode("simple");
    setStoryboardImageControlsCollapsed(true);
    setStoryboardStyleControlsCollapsed(true);
    setScenarioManagerOpen(false);
    setResourceManagerOpen(false);
    closeStoryboardEditor();
    closeStoryboardClearConfirm();
    closeImagePreview();
    setStudioError("");

    if (!isMobilePerformanceMode) {
      setProfessionalExportPreviewVisible(true);
    }

    writeLocalValue(PANEL_MODE_STORAGE_KEY, PANEL_MODE_PROFESSIONAL);
    writeLocalValue(PROFESSIONAL_SELECTED_MODEL_STORAGE_KEY, sceneState.selectedModelId);
    writeLocalValue(PROFESSIONAL_GLOBAL_PROMPT_STORAGE_KEY, sceneState.globalPrompt);
    writeLocalValue(PROFESSIONAL_CANVAS_SIZE_STORAGE_KEY, sceneState.canvasSize);
    writeLocalValue(
      PROFESSIONAL_CUSTOM_SCENARIOS_STORAGE_KEY,
      persistedCustomScenarios.length > 0 ? JSON.stringify(persistedCustomScenarios) : "",
    );
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_WIDTH_STORAGE_KEY,
      String(sceneState.customCanvasWidth),
    );
    writeLocalValue(
      PROFESSIONAL_CUSTOM_CANVAS_HEIGHT_STORAGE_KEY,
      String(sceneState.customCanvasHeight),
    );
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_ROWS_STORAGE_KEY,
      String(sceneState.layoutRows),
    );
    writeLocalValue(
      PROFESSIONAL_SELECTED_LAYOUT_COLUMNS_STORAGE_KEY,
      String(sceneState.layoutColumns),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_ASPECT_RATIO_STORAGE_KEY,
      sceneState.storyboardAspectRatio,
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_IMAGE_SIZE_STORAGE_KEY,
      sceneState.storyboardImageSize,
    );
    writeLocalValue(
      PROFESSIONAL_SELECTED_IMAGE_COUNT_STORAGE_KEY,
      String(sceneState.selectedImageCount),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_DIVIDER_WIDTH_STORAGE_KEY,
      String(sceneState.storyboardDividerWidthPx),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_FONT_SIZE_STORAGE_KEY,
      String(sceneState.storyboardCaptionFontSizePercent),
    );
    writeLocalValue(
      PROFESSIONAL_STORYBOARD_CAPTION_BACKGROUND_ALPHA_STORAGE_KEY,
      String(sceneState.storyboardCaptionBackgroundAlphaPercent),
    );

    await Promise.all([
      writePersistedReferenceImages(sceneState.referenceImages),
      writePersistedStoryboardCells(sceneState.storyboardCells),
    ]);
  }

  function buildCurrentProfessionalSceneArchive() {
    return buildProfessionalSceneArchive({
      selectedModelId: professionalSelectedModelId,
      globalPrompt: professionalGlobalPrompt,
      canvasSize: professionalCanvasSize,
      customScenarios: professionalCustomScenarios,
      customCanvasWidth: professionalCustomCanvasWidth,
      customCanvasHeight: professionalCustomCanvasHeight,
      layoutRows: professionalLayoutRows,
      layoutColumns: professionalLayoutColumns,
      storyboardAspectRatio: professionalStoryboardAspectRatioValue,
      storyboardImageSize: professionalStoryboardImageSizeValue,
      selectedImageCount: professionalSelectedImageCount,
      storyboardDividerWidthPx: professionalStoryboardDividerWidthPx,
      storyboardCaptionFontSizePercent: professionalStoryboardCaptionFontSizePercent,
      storyboardCaptionBackgroundAlphaPercent:
        professionalStoryboardCaptionBackgroundAlphaPercent,
      referenceImages,
      storyboardCells,
    });
  }

  function closeProfessionalSceneExportDialog() {
    if (professionalSceneTransferPending) {
      return;
    }

    setProfessionalSceneExportDialog(null);
  }

  function openProfessionalSceneExportDialog(kind) {
    if (professionalSceneTransferPending || !professionalSceneTransferReady) {
      return;
    }

    const defaultFileName = buildProfessionalSceneArchiveBaseName();

    setStudioError("");
    setProfessionalSceneExportDialog({
      kind,
      defaultFileName,
      fileName: defaultFileName,
    });
  }

  function handleProfessionalSceneExportFileNameChange(value) {
    setProfessionalSceneExportDialog((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            fileName: value,
          }
        : currentValue,
    );
  }

  async function handleConfirmProfessionalSceneExport() {
    if (!professionalSceneTransferReady || !professionalSceneExportDialog?.kind) {
      return;
    }

    const fallbackBaseName =
      professionalSceneExportDialog.defaultFileName || buildProfessionalSceneArchiveBaseName();
    const exportBaseName = sanitizeExportFileBaseName(
      professionalSceneExportDialog.fileName,
      fallbackBaseName,
    );

    setProfessionalSceneTransferPending(true);
    setStudioError("");
    setStudioNotice("");

    try {
      const archive = buildCurrentProfessionalSceneArchive();

      if (professionalSceneExportDialog.kind === "zip") {
        const { blob, filename } = buildProfessionalSceneAssetPackage(archive, exportBaseName);
        await saveBlobFile(blob, filename);
        setStudioNotice(`已导出 ${filename}`);
      } else {
        downloadTextFile(
          buildProfessionalSceneArchiveDownloadName(exportBaseName),
          JSON.stringify(archive, null, 2),
        );
        setStudioNotice(
          `已导出 ${buildProfessionalSceneArchiveDownloadName(exportBaseName)}`,
        );
      }

      setProfessionalSceneExportDialog(null);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "专业模式场景导出失败");
    } finally {
      setProfessionalSceneTransferPending(false);
    }
  }

  function handleSwitchScenarioWithExport() {
    if (!pendingScenarioSwitch?.value || storyboardHasLoadingCells) {
      return;
    }

    const { value, label } = pendingScenarioSwitch;
    const archive = buildCurrentProfessionalSceneArchive();
    const filename = buildProfessionalSceneArchiveDownloadName();

    try {
      downloadTextFile(filename, JSON.stringify(archive, null, 2));
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "导出场景失败");
      return;
    }

    if (!clearStoryboardWithoutConfirm()) {
      return;
    }

    applyProfessionalScenarioChange(value);
    closeScenarioManager();
    setStudioError("");
    setStudioNotice(`已导出 ${filename}，并切换到 ${label}`);
  }

  function handleSwitchScenarioWithoutSaving() {
    if (!pendingScenarioSwitch?.value || storyboardHasLoadingCells) {
      return;
    }

    const { value, label } = pendingScenarioSwitch;

    if (!clearStoryboardWithoutConfirm()) {
      return;
    }

    applyProfessionalScenarioChange(value);
    closeScenarioManager();
    setStudioError("");
    setStudioNotice(`已放弃当前修改，并切换到 ${label}`);
  }

  function handleOpenProfessionalSceneImport() {
    if (professionalSceneTransferPending || !professionalSceneTransferReady) {
      return;
    }

    professionalSceneImportInputRef.current?.click();
  }

  async function handleImportProfessionalSceneFileChange(event) {
    const [file] = Array.from(event.target.files || []);

    if (!file) {
      return;
    }

    setProfessionalSceneTransferPending(true);
    setStudioError("");

    try {
      const rawText = await readFileAsText(file);
      let parsedValue = null;

      try {
        parsedValue = JSON.parse(rawText);
      } catch {
        throw new Error("场景文件不是合法的 JSON");
      }

      const sceneState = resolveProfessionalSceneArchiveState(parsedValue);
      await applyImportedProfessionalScene(sceneState);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "专业模式场景导入失败");
    } finally {
      setProfessionalSceneTransferPending(false);
      event.target.value = "";
    }
  }

  async function importExampleProfessionalScene(optionValue) {
    const exampleOption = EXAMPLE_SCENE_OPTION_MAP.get(optionValue);

    if (!exampleOption) {
      return;
    }

    setProfessionalSceneTransferPending(true);
    setExampleSceneLoadingLabel(exampleOption.sceneLabel);
    setStudioError("");
    setStudioNotice("");

    try {
      const response = await fetch(exampleOption.assetUrl, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`示例场景读取失败（${response.status}）`);
      }

      const parsedValue = JSON.parse(await response.text());
      const sceneState = resolveProfessionalSceneArchiveState(parsedValue);
      await applyImportedProfessionalScene(sceneState);
      setStudioNotice(`已导入示例场景：${exampleOption.sceneLabel}`);
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "示例场景导入失败");
    } finally {
      setProfessionalSceneTransferPending(false);
      setExampleSceneLoadingLabel("");
    }
  }

  function handleCanvasSizeSelectorChange(value) {
    if (value.startsWith(EXAMPLE_SCENE_VALUE_PREFIX)) {
      void importExampleProfessionalScene(value);
      return;
    }

    handleProfessionalScenarioChange(value);
  }

  async function appendReferenceFiles(files) {
    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFiles = imageFiles.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT);

      if (nextFiles.length === 0) {
        setStudioError("请上传 1 张图片作为整体画风参考");
        return;
      }

      setStudioNotice(
        nextFiles.some((file) => file.size > REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES)
          ? "正在优化参考图，上传大图时会自动压缩到更稳定的体积..."
          : "",
      );
      const parsedImages = await Promise.all(nextFiles.map(readFileAsReferenceImage));
      setReferenceImages(parsedImages);
      setStudioError("");
      setStudioNotice("");
    } catch (error) {
      setStudioNotice("");
      setStudioError(error instanceof Error ? error.message : "图片读取失败");
    }
  }

  async function appendSimpleReferenceFiles(files) {
    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFiles = imageFiles.slice(0, PROFESSIONAL_STYLE_REFERENCE_LIMIT);

      if (nextFiles.length === 0) {
        setStudioError("请上传 1 张图片作为简易模式参考图");
        return;
      }

      setStudioNotice(
        nextFiles.some((file) => file.size > REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES)
          ? "正在优化参考图，上传大图时会自动压缩到更稳定的体积..."
          : "",
      );
      const parsedImages = await Promise.all(nextFiles.map(readFileAsReferenceImage));
      setSimpleReferenceImages(parsedImages);
      setSimpleReferenceDisclosureOpen(true);
      setStudioError("");
      setStudioNotice("");
    } catch (error) {
      setStudioNotice("");
      setStudioError(error instanceof Error ? error.message : "图片读取失败");
    }
  }

  async function appendStoryboardReferenceFiles(files) {
    if (!storyboardEditorCellId) {
      return;
    }

    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFiles = imageFiles.slice(0, STORYBOARD_CELL_REFERENCE_LIMIT);

      if (nextFiles.length === 0) {
        updateStoryboardCell(storyboardEditorCellId, (cell) => ({
          ...cell,
          error: "请上传 1 张图片作为当前格子的参考图",
        }));
        return;
      }

      setStudioNotice(
        nextFiles.some((file) => file.size > REFERENCE_IMAGE_AUTO_OPTIMIZE_TARGET_BYTES)
          ? "正在优化参考图，上传大图时会自动压缩到更稳定的体积..."
          : "",
      );
      const parsedImages = await Promise.all(nextFiles.map(readFileAsReferenceImage));
      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        referenceImages: parsedImages,
        error: "",
      }));
      setStudioError("");
      setStudioNotice("");
    } catch (error) {
      setStudioNotice("");
      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        error: error instanceof Error ? error.message : "参考图读取失败",
      }));
    }
  }

  async function handleFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    try {
      await appendReferenceFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  async function handleSimpleReferenceFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    try {
      await appendSimpleReferenceFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  async function handleStoryboardReferenceFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    try {
      await appendStoryboardReferenceFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  function handleUploadDragOver(event) {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }

    setUploadDragActive(true);
  }

  function handleUploadDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setUploadDragActive(false);
  }

  async function handleUploadDrop(event) {
    event.preventDefault();
    setUploadDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);

    if (files.length === 0) {
      return;
    }

    await appendReferenceFiles(files);
  }

  async function handleSimpleReferenceUploadDrop(event) {
    event.preventDefault();
    setUploadDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);

    if (files.length === 0) {
      return;
    }

    await appendSimpleReferenceFiles(files);
  }

  function handleRemoveReferenceImage(imageId) {
    setReferenceImages((currentValue) =>
      currentValue.filter((image) => image.id !== imageId),
    );
  }

  function handleRemoveSimpleReferenceImage(imageId) {
    setSimpleReferenceImages((currentValue) =>
      currentValue.filter((image) => image.id !== imageId),
    );
  }

  function handleRemoveStoryboardReferenceImage(imageId) {
    if (!storyboardEditorCellId) {
      return;
    }

    updateStoryboardCell(storyboardEditorCellId, (cell) => ({
      ...cell,
      referenceImages: Array.isArray(cell.referenceImages)
        ? cell.referenceImages.filter((image) => image.id !== imageId)
        : [],
      error: "",
    }));
  }

  function scrollReferenceItemIntoView(index) {
    const container = referenceGridRef.current;

    if (!container || index < 0) {
      return;
    }

    const referenceItems = container.querySelectorAll("[data-reference-id]");
    const targetItem = referenceItems[index];

    if (!(targetItem instanceof HTMLElement)) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetItem.getBoundingClientRect();
    const edgePadding = 28;

    if (targetRect.right > containerRect.right - edgePadding) {
      container.scrollBy({
        left: targetRect.right - containerRect.right + edgePadding,
        behavior: "auto",
      });
      return;
    }

    if (targetRect.left < containerRect.left + edgePadding) {
      container.scrollBy({
        left: targetRect.left - containerRect.left - edgePadding,
        behavior: "auto",
      });
    }
  }

  function handleReferenceDragStart() {
    setReferenceDragActive(true);
  }

  function handleReferenceDragUpdate(update) {
    const { destination, source } = update;

    if (!destination) {
      return;
    }

    const targetIndex =
      destination.index > source.index
        ? Math.min(destination.index + 1, referenceImages.length - 1)
        : Math.max(destination.index - 1, 0);

    scrollReferenceItemIntoView(targetIndex);
  }

  function handleReferenceDragEnd(result) {
    setReferenceDragActive(false);
    const { destination, source } = result;

    if (!destination || destination.index === source.index) {
      return;
    }

    setReferenceImages((currentValue) =>
      reorderReferenceImages(currentValue, source.index, destination.index),
    );

    requestAnimationFrame(() => {
      scrollReferenceItemIntoView(destination.index);
    });
  }

  function setCurrentGenerationSelection(records, nextCurrentRecord = records[0] || null) {
    setGenerationResults(records);
    setGenerationResult(nextCurrentRecord);
  }

  async function persistGeneratedRecords(records, currentRecordId = records[0]?.id || "") {
    const existingLibraryRecords = await ensureGenerationLibraryLoaded();
    const nextRecordIds = new Set(records.map((record) => record.id));
    const nextLibraryRecords = [
      ...records,
      ...existingLibraryRecords.filter((record) => !nextRecordIds.has(record.id)),
    ];
    const currentRecord =
      nextLibraryRecords.find((record) => record.id === currentRecordId) ||
      records[0] ||
      null;

    await Promise.all([
      writePersistedGenerationLibrary(nextLibraryRecords),
      writeLastGenerationRecordId(currentRecordId),
      writeLastGenerationRecord(currentRecord),
    ]);

    setGenerationLibrary(nextLibraryRecords);
    setGenerationLibraryLoaded(true);
  }

  async function persistGeneratedRecord(record) {
    if (!record) {
      return;
    }

    await persistGeneratedRecords([record], record.id);
  }

  function handleSelectGenerationResult(record) {
    if (!record?.id) {
      return;
    }

    setGenerationResult(record);
    void Promise.all([
      writeLastGenerationRecordId(record.id),
      writeLastGenerationRecord(record),
    ]);
  }

  function applyProfessionalScenarioChange(value) {
    const scenario = getCanvasScenarioOption(value, professionalCustomScenarios);
    const nextRows = clampLayoutTrack(scenario.layoutRows);
    const nextColumns = clampLayoutTrack(scenario.layoutColumns);
    const nextRecommendedAspectRatio = findRecommendedStoryboardAspectRatioForLayout({
      options: availableAspectRatioOptions,
      canvasWidth:
        scenario.value === CUSTOM_CANVAS_SIZE_VALUE
          ? professionalCustomCanvasWidth
          : scenario.width,
      canvasHeight:
        scenario.value === CUSTOM_CANVAS_SIZE_VALUE
          ? professionalCustomCanvasHeight
          : scenario.height,
      rows: nextRows,
      columns: nextColumns,
    });

    setProfessionalCanvasSize(scenario.value);
    setProfessionalLayoutRows(nextRows);
    setProfessionalLayoutColumns(nextColumns);

    if (nextRecommendedAspectRatio?.option?.value) {
      setProfessionalStoryboardAspectRatio(nextRecommendedAspectRatio.option.value);
    }
  }

  function clearStoryboardWithoutConfirm() {
    if (storyboardHasLoadingCells) {
      return false;
    }

    setStoryboardCells(normalizeStoryboardCells({}, professionalLayoutRows, professionalLayoutColumns));
    setStoryboardClearConfirmOpen(false);
    setPendingScenarioSwitch(null);
    closeStoryboardEditor();
    return true;
  }

  function closePendingScenarioSwitchDialog() {
    setPendingScenarioSwitch(null);
  }

  function handleProfessionalScenarioChange(value) {
    const normalizedValue = normalizeTextValue(value);

    if (!normalizedValue || normalizedValue === professionalCanvasSize) {
      return;
    }

    if (storyboardHasLoadingCells) {
      setStudioError("当前还有分镜在生成中，请等待完成后再切换场景。");
      return;
    }

    if (storyboardHasContent) {
      const targetScenario = getCanvasScenarioOption(normalizedValue, professionalCustomScenarios);
      setStudioError("");
      setPendingScenarioSwitch({
        value: targetScenario.value,
        label: targetScenario.label,
      });
      return;
    }

    applyProfessionalScenarioChange(normalizedValue);
  }

  function buildScenarioManagerDraft(sourceScenario = null) {
    return {
      value: sourceScenario?.value || "",
      label: sourceScenario?.label || "我的场景",
      width: String(
        normalizeCanvasDimensionValue(
          sourceScenario?.width,
          professionalCanvasSizeOption.width || DEFAULT_CUSTOM_CANVAS_WIDTH,
        ),
      ),
      height: String(
        normalizeCanvasDimensionValue(
          sourceScenario?.height,
          professionalCanvasSizeOption.height || DEFAULT_CUSTOM_CANVAS_HEIGHT,
        ),
      ),
      layoutRows: clampLayoutTrack(
        sourceScenario?.layoutRows || professionalLayoutRows || 1,
      ),
      layoutColumns: clampLayoutTrack(
        sourceScenario?.layoutColumns || professionalLayoutColumns || 1,
      ),
    };
  }

  function openScenarioManager() {
    if (activeCustomScenario) {
      setScenarioManagerSelectedType("custom");
      setScenarioManagerSelectedId(activeCustomScenario.value);
      setScenarioManagerDraft(buildScenarioManagerDraft(activeCustomScenario));
      setScenarioManagerOpen(true);
      return;
    }

    if (activeSystemScenario) {
      setScenarioManagerSelectedType("system");
      setScenarioManagerSelectedId(activeSystemScenario.value);
      setScenarioManagerDraft(buildScenarioManagerDraft(activeSystemScenario));
      setScenarioManagerOpen(true);
      return;
    }

    setScenarioManagerSelectedType("new");
    setScenarioManagerSelectedId("");
    setScenarioManagerDraft(buildScenarioManagerDraft());
    setScenarioManagerOpen(true);
  }

  function closeScenarioManager() {
    setScenarioManagerOpen(false);
  }

  function handleScenarioManagerSelect(value) {
    const scenario = professionalCustomScenarios.find((item) => item.value === value);

    if (!scenario) {
      return;
    }

    setScenarioManagerSelectedType("custom");
    setScenarioManagerSelectedId(scenario.value);
    setScenarioManagerDraft(buildScenarioManagerDraft(scenario));
  }

  function handleScenarioManagerSelectSystem(value) {
    const scenario = CANVAS_SIZE_OPTIONS.find((item) => item.value === value);

    if (!scenario) {
      return;
    }

    setScenarioManagerSelectedType("system");
    setScenarioManagerSelectedId(scenario.value);
    setScenarioManagerDraft(buildScenarioManagerDraft(scenario));
  }

  function handleScenarioManagerCreate() {
    setScenarioManagerSelectedType("new");
    setScenarioManagerSelectedId("");
    setScenarioManagerDraft(buildScenarioManagerDraft());
  }

  function handleScenarioManagerDraftLabelChange(value) {
    setScenarioManagerDraft((currentValue) => ({
      ...currentValue,
      label: value,
    }));
  }

  function handleScenarioManagerDraftDimensionChange(field, value) {
    setScenarioManagerDraft((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  function handleScenarioManagerDraftLayoutChange(field, value) {
    setScenarioManagerDraft((currentValue) => ({
      ...currentValue,
      [field]: clampLayoutTrack(value),
    }));
  }

  function handleScenarioManagerSave() {
    const label = normalizeTextValue(scenarioManagerDraft.label);

    if (!label) {
      setStudioError("请先填写常用场景名称");
      return;
    }

    const nextScenario = {
      value: scenarioManagerSelectedId || `custom-scene-${createPersistedRecordId()}`,
      label,
      width: normalizeCanvasDimensionValue(
        scenarioManagerDraft.width,
        DEFAULT_CUSTOM_CANVAS_WIDTH,
      ),
      height: normalizeCanvasDimensionValue(
        scenarioManagerDraft.height,
        DEFAULT_CUSTOM_CANVAS_HEIGHT,
      ),
      layoutRows: clampLayoutTrack(scenarioManagerDraft.layoutRows),
      layoutColumns: clampLayoutTrack(scenarioManagerDraft.layoutColumns),
    };

    setProfessionalCustomScenarios((currentValue) => {
      const nextValue = currentValue.some((item) => item.value === nextScenario.value)
        ? currentValue.map((item) => (item.value === nextScenario.value ? nextScenario : item))
        : [...currentValue, nextScenario];

      return nextValue;
    });

    setScenarioManagerSelectedId(nextScenario.value);
    setScenarioManagerSelectedType("custom");
    setScenarioManagerDraft(buildScenarioManagerDraft(nextScenario));
    setProfessionalCanvasSize(nextScenario.value);
    setProfessionalLayoutRows(nextScenario.layoutRows);
    setProfessionalLayoutColumns(nextScenario.layoutColumns);
    const nextRecommendedAspectRatio = findRecommendedStoryboardAspectRatioForLayout({
      options: availableAspectRatioOptions,
      canvasWidth: nextScenario.width,
      canvasHeight: nextScenario.height,
      rows: nextScenario.layoutRows,
      columns: nextScenario.layoutColumns,
    });

    if (nextRecommendedAspectRatio?.option?.value) {
      setProfessionalStoryboardAspectRatio(nextRecommendedAspectRatio.option.value);
    }

    setStudioError("");
  }

  function handleScenarioManagerDelete(value) {
    if (!value) {
      return;
    }

    setProfessionalCustomScenarios((currentValue) =>
      currentValue.filter((scenario) => scenario.value !== value),
    );

    if (professionalCanvasSize === value) {
      handleProfessionalScenarioChange(CANVAS_SIZE_OPTIONS[0].value);
    }

    setScenarioManagerSelectedId("");
    setScenarioManagerSelectedType("new");
    setScenarioManagerDraft(buildScenarioManagerDraft());
    setStudioError("");
  }

  async function handleDeleteStoredRecord(recordId) {
    try {
      const existingLibraryRecords = await ensureGenerationLibraryLoaded();
      const nextLibraryRecords = existingLibraryRecords.filter((record) => record.id !== recordId);
      const nextBatchResults = generationResults.some((record) => record.id === recordId)
        ? generationResults.filter((record) => record.id !== recordId)
        : generationResults;
      const nextStoredCurrentRecord =
        nextLibraryRecords.find((record) => record.id === generationResult?.id) ||
        nextLibraryRecords[0] ||
        null;
      const nextCurrentRecord =
        generationResult?.id === recordId
          ? nextBatchResults[0] || nextStoredCurrentRecord || null
          : generationResult || nextBatchResults[0] || nextStoredCurrentRecord;
      const normalizedNextBatchResults =
        nextBatchResults.length > 0
          ? nextBatchResults
          : nextCurrentRecord
            ? [nextCurrentRecord]
            : [];

      await Promise.all([
        writePersistedGenerationLibrary(nextLibraryRecords),
        writeLastGenerationRecordId(nextStoredCurrentRecord?.id || ""),
        writeLastGenerationRecord(nextCurrentRecord),
      ]);

      setGenerationLibrary(nextLibraryRecords);
      setGenerationLibraryLoaded(true);
      setCurrentGenerationSelection(normalizedNextBatchResults, nextCurrentRecord);

      if (
        imagePreviewOpen &&
        previewRecord?.id === recordId
      ) {
        closeImagePreview();
      }
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "本地资源删除失败");
    }
  }

  function togglePromptMode() {
    setPromptMode((currentValue) =>
      currentValue === "focus" ? "simple" : "focus",
    );
  }

  function updateStoryboardCell(cellId, updater) {
    setStoryboardCells((currentValue) => {
      const cell = currentValue[cellId];

      if (!cell) {
        return currentValue;
      }

      const nextCell =
        typeof updater === "function"
          ? updater(cell)
          : {
              ...cell,
              ...updater,
            };

      return {
        ...currentValue,
        [cellId]: nextCell,
      };
    });
  }

  function getStoryboardEditorDraft(cellId = storyboardEditorCellId) {
    const draft = storyboardEditorDraftRef.current;
    const normalizedDraftCellId = normalizeTextValue(draft?.cellId);
    const normalizedCellId = normalizeTextValue(cellId);

    if (!normalizedCellId || normalizedDraftCellId !== normalizedCellId) {
      return null;
    }

    return {
      prompt: typeof draft?.prompt === "string" ? draft.prompt : "",
      caption: typeof draft?.caption === "string" ? draft.caption : "",
    };
  }

  function commitStoryboardEditorDraft(cellId = storyboardEditorCellId) {
    const draft = getStoryboardEditorDraft(cellId);

    if (!draft) {
      return;
    }

    applyStoryboardEditorDraft(cellId, draft);
  }

  function openStoryboardEditor(cellId) {
    const cell = storyboardCellsRef.current[cellId];

    if (!cell) {
      return;
    }

    setStoryboardEditorMode(
      cell.record && !normalizeTextValue(cell.prompt)
        ? STORYBOARD_EDITOR_MODE_ASSET
        : STORYBOARD_EDITOR_MODE_GENERATE,
    );
    storyboardEditorDraftRef.current = {
      cellId,
      prompt: typeof cell.prompt === "string" ? cell.prompt : "",
      caption: typeof cell.caption === "string" ? cell.caption : "",
    };
    setStoryboardEditorCellId(cellId);
  }

  function suppressStoryboardCellOpen(cellId) {
    storyboardDragClickSuppressionRef.current = {
      cellId,
      timestamp: Date.now(),
    };
  }

  function isStoryboardCellOpenSuppressed(cellId) {
    const { cellId: suppressedCellId, timestamp } = storyboardDragClickSuppressionRef.current;

    if (!suppressedCellId || suppressedCellId !== cellId) {
      return false;
    }

    if (Date.now() - timestamp > STORYBOARD_DRAG_CLICK_SUPPRESSION_MS) {
      storyboardDragClickSuppressionRef.current = {
        cellId: "",
        timestamp: 0,
      };
      return false;
    }

    return true;
  }

  function handleStoryboardCellOpen(cellId) {
    if (isStoryboardCellOpenSuppressed(cellId)) {
      return;
    }

    openStoryboardEditor(cellId);
  }

  function handleStoryboardDragStart(event) {
    const activeId = String(event.active?.id || "");

    if (!activeId) {
      return;
    }

    setActiveStoryboardDragId(activeId);
  }

  function handleStoryboardDragCancel() {
    const activeId = activeStoryboardDragIdRef.current;

    if (activeId) {
      suppressStoryboardCellOpen(activeId);
    }

    setActiveStoryboardDragId("");
  }

  function handleStoryboardDragEnd(event) {
    const activeId = String(event.active?.id || "");
    const overId = String(event.over?.id || "");

    if (activeId) {
      suppressStoryboardCellOpen(activeId);
    }

    setActiveStoryboardDragId("");

    if (!activeId || !overId || activeId === overId) {
      return;
    }

    setStoryboardCells((currentValue) => swapStoryboardCellContent(currentValue, activeId, overId));
  }

  function closeStoryboardEditor() {
    commitStoryboardEditorDraft();
    setStoryboardEditorCellId("");
    setStoryboardEditorMode(STORYBOARD_EDITOR_MODE_GENERATE);
  }

  function navigateStoryboardEditor(direction) {
    const targetCell =
      direction === "previous" ? previousStoryboardEditorCell : nextStoryboardEditorCell;

    if (!targetCell) {
      return;
    }

    commitStoryboardEditorDraft();
    setStoryboardEditorCellId(targetCell.id);
  }

  function openStoryboardClearConfirm() {
    if (!storyboardHasContent || storyboardHasLoadingCells) {
      return;
    }

    setStoryboardClearConfirmOpen(true);
  }

  function closeStoryboardClearConfirm() {
    setStoryboardClearConfirmOpen(false);
  }

  function handleClearStoryboard() {
    clearStoryboardWithoutConfirm();
  }

  function openStoryboardCellClearConfirm(cellId) {
    const cell = storyboardRuntimeCells[cellId];

    if (!cell || cell.status === "loading" || !doesStoryboardCellHaveContent(cell)) {
      return;
    }

    setStoryboardCellClearConfirmCellId(cellId);
  }

  storyboardCellInteractionRef.current.open = handleStoryboardCellOpen;
  storyboardCellInteractionRef.current.clear = openStoryboardCellClearConfirm;
  storyboardGridActionRef.current.openClearConfirm = openStoryboardClearConfirm;
  storyboardGridActionRef.current.onDragStart = handleStoryboardDragStart;
  storyboardGridActionRef.current.onDragCancel = handleStoryboardDragCancel;
  storyboardGridActionRef.current.onDragEnd = handleStoryboardDragEnd;

  function closeStoryboardCellClearConfirm() {
    setStoryboardCellClearConfirmCellId("");
  }

  function handleConfirmClearStoryboardCell() {
    const cellId = storyboardCellClearConfirmCellId;
    const cell = cellId ? storyboardRuntimeCells[cellId] : null;

    if (!cell || cell.status === "loading") {
      closeStoryboardCellClearConfirm();
      return;
    }

    updateStoryboardCell(cellId, (currentCell) => createStoryboardCellState(currentCell));
    closeStoryboardCellClearConfirm();
  }

  function openRequestTaskCancelConfirm(requestId) {
    const nextRequestId = normalizeTextValue(requestId);
    const targetTask = nextRequestId
      ? requestTasks.find((task) => task.requestId === nextRequestId) || null
      : null;

    if (
      !targetTask ||
      isRequestTaskTerminal(targetTask) ||
      cancellingRequestTaskIds[nextRequestId]
    ) {
      return;
    }

    setRequestTaskCancelConfirmId(nextRequestId);
  }

  function closeRequestTaskCancelConfirm() {
    setRequestTaskCancelConfirmId("");
  }

  async function handleConfirmCancelRequestTask() {
    const targetTask = requestTaskCancelConfirmTask;
    const requestId = normalizeTextValue(targetTask?.requestId);

    if (!activePw || !requestId || isRequestTaskTerminal(targetTask)) {
      closeRequestTaskCancelConfirm();
      return;
    }

    startCancellingRequestTask(requestId);

    try {
      const data = await fetchCancelableGenerationRequest(activePw, requestId);
      const cancelledMessage = data?.message || "任务已取消";

      updateRequestTask(requestId, buildCancelledRequestTaskPatch(cancelledMessage));
      abortRequestAbortController(requestId, createRequestCancelledError());
      setStudioError("");
      setStudioNotice(cancelledMessage);
      closeRequestTaskCancelConfirm();
    } catch (error) {
      if (error?.status === 404) {
        const missingTaskPatch = buildMissingRecoverableRequestTaskPatch(targetTask);
        updateRequestTask(requestId, missingTaskPatch);
        abortRequestAbortController(requestId, createRequestCancelledError());
        setStudioNotice("");
        setStudioError(missingTaskPatch.error);
        closeRequestTaskCancelConfirm();
        return;
      }

      if (error?.status === 409 && normalizeTextValue(error?.message) === "任务已经取消") {
        const cancelledMessage = "任务已取消";
        updateRequestTask(requestId, buildCancelledRequestTaskPatch(cancelledMessage));
        abortRequestAbortController(requestId, createRequestCancelledError());
        setStudioError("");
        setStudioNotice(cancelledMessage);
        closeRequestTaskCancelConfirm();
        return;
      }

      if (error?.status === 409) {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(targetTask);

          if (
            recoveryOutcome.state === "recovered" ||
            recoveryOutcome.state === "failed" ||
            recoveryOutcome.state === "cancelled" ||
            recoveryOutcome.state === "missing"
          ) {
            closeRequestTaskCancelConfirm();
            return;
          }
        } catch {
          // Fall through to the generic error below.
        }
      }

      setStudioError(error instanceof Error ? error.message : "取消任务失败");
    } finally {
      finishCancellingRequestTask(requestId);
    }
  }

  function applyStoryboardEditorDraft(cellId, { prompt, caption } = {}) {
    const normalizedCellId = normalizeTextValue(cellId);

    if (!normalizedCellId) {
      return;
    }

    updateStoryboardCell(normalizedCellId, (cell) => {
      const nextPrompt = typeof prompt === "string" ? prompt : cell.prompt || "";
      const nextCaption = typeof caption === "string" ? caption : cell.caption || "";

      if (nextPrompt === (cell.prompt || "") && nextCaption === (cell.caption || "")) {
        return cell;
      }

      return {
        ...cell,
        prompt: nextPrompt,
        caption: nextCaption,
        error: "",
      };
    });
  }

  async function appendStoryboardLocalImageFiles(
    files,
    successText = "已导入本地图片，仅作用于当前格子",
  ) {
    if (!storyboardEditorCellId) {
      return;
    }

    try {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      const nextFile = imageFiles[0];

      if (!nextFile) {
        updateStoryboardCell(storyboardEditorCellId, (cell) => ({
          ...cell,
          error: "请上传 1 张图片作为当前格子的图片",
        }));
        return;
      }

      const record = await readFileAsGenerationResultRecord(nextFile);

      if (!record) {
        updateStoryboardCell(storyboardEditorCellId, (cell) => ({
          ...cell,
          error: "当前图片导入失败",
        }));
        return;
      }

      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        pendingRequestId: "",
        status: "success",
        statusText: successText,
        error: "",
        record,
      }));
      setStoryboardLibraryPickerOpen(false);
      setStudioError("");
    } catch (error) {
      updateStoryboardCell(storyboardEditorCellId, (cell) => ({
        ...cell,
        error: error instanceof Error ? error.message : "本地图片读取失败",
      }));
    }
  }

  async function handleStoryboardLocalImageFileChange(event) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0 || !storyboardEditorCellId) {
      return;
    }

    try {
      await appendStoryboardLocalImageFiles(files);
    } finally {
      event.target.value = "";
    }
  }

  function handleSelectStoryboardLibraryRecord(record) {
    if (!storyboardEditorCellId) {
      return;
    }

    const clonedRecord = cloneGenerationResultRecord(record);

    if (!clonedRecord) {
      return;
    }

    updateStoryboardCell(storyboardEditorCellId, (cell) => ({
      ...cell,
      pendingRequestId: "",
      status: "success",
      statusText: "已复用资源管理器中的图片，仅作用于当前格子",
      error: "",
      record: clonedRecord,
    }));
    setStoryboardLibraryPickerOpen(false);
  }

  function handleToggleStoryboardLibraryPicker() {
    if (storyboardLibraryPickerPending) {
      return;
    }

    if (storyboardLibraryPickerTimeoutRef.current) {
      window.clearTimeout(storyboardLibraryPickerTimeoutRef.current);
      storyboardLibraryPickerTimeoutRef.current = null;
    }

    if (storyboardLibraryPickerOpen) {
      setStoryboardLibraryPickerOpen(false);
      setStoryboardLibraryPickerPending(false);
      return;
    }

    setStoryboardLibraryPickerPending(true);
    void ensureGenerationLibraryLoaded()
      .then(() => {
        storyboardLibraryPickerTimeoutRef.current = window.setTimeout(() => {
          setStoryboardLibraryPickerOpen(true);
          setStoryboardLibraryPickerPending(false);
          storyboardLibraryPickerTimeoutRef.current = null;
        }, 220);
      })
      .catch((error) => {
        setStudioError(error instanceof Error ? error.message : "资源管理器图片加载失败");
        setStoryboardLibraryPickerPending(false);
      });
  }

  async function handleCopyStoryboardShare() {
    if (!storyboardShareText) {
      return;
    }

    try {
      await copyTextToClipboard(storyboardShareText);
      setStoryboardShareCopyState("success");
    } catch (error) {
      console.warn("Copy storyboard share failed:", error);
      setStoryboardShareCopyState("error");
    }

    if (storyboardShareCopyResetTimeoutRef.current) {
      window.clearTimeout(storyboardShareCopyResetTimeoutRef.current);
    }

    storyboardShareCopyResetTimeoutRef.current = window.setTimeout(() => {
      setStoryboardShareCopyState("idle");
      storyboardShareCopyResetTimeoutRef.current = null;
    }, 1800);
  }

  async function executeStoryboardCellTask({
    editorCell,
    modelId,
    requestedPromptValue,
    storyboardAspectRatio,
    storyboardImageSize,
    globalReferenceImageRecords,
  }) {
    if (!editorCell || !activePw) {
      return;
    }

    const cellId = editorCell.id;
    const previousRecord = editorCell.record || null;
    const requestRecord = upsertRequestTask({
      requestId: createClientRequestId(),
      type: "storyboard",
      mode: "professional",
      canRetry: true,
      promptSnapshot: requestedPromptValue,
      storyboardCellId: cellId,
      storyboardCellLabel: editorCell.label,
      storyboardCellCoordinate: editorCell.coordinateLabel,
      createdAt: new Date().toISOString(),
      status: "accepted",
      stage: "accepted",
      message: `${editorCell.label} 请求已提交，等待后端接收...`,
    });

    if (requestRecord?.requestId) {
      setRequestTaskRetryHandler(requestRecord.requestId, async () => {
        await executeStoryboardCellTask({
          editorCell,
          modelId,
          requestedPromptValue,
          storyboardAspectRatio,
          storyboardImageSize,
          globalReferenceImageRecords,
        });
      });
    }

    updateStoryboardCell(cellId, (cell) => ({
      ...cell,
      pendingRequestId: requestRecord?.requestId || "",
      status: "loading",
      statusText: "banana 正在生图...",
      error: "",
    }));
    const releaseTaskRecoveryPause = beginTaskRecoveryPause();
    const requestAbortController = new AbortController();

    if (requestRecord?.requestId) {
      registerRequestAbortController(requestRecord.requestId, requestAbortController);
    }

    try {
      const mergedReferenceImages = [
        ...buildProfessionalReferenceImages(globalReferenceImageRecords, 1, "style"),
        ...buildProfessionalReferenceImages(
          editorCell.referenceImages,
          STORYBOARD_CELL_REFERENCE_LIMIT,
          "content",
        ),
      ];
      const data = await requestProfessionalGeneration(
        activePw,
        {
          ...buildProfessionalGenerationPayload({
            modelId,
            prompt: requestedPromptValue,
            aspectRatio: storyboardAspectRatio,
            imageSize: storyboardImageSize,
            imageCount: 1,
            layoutRows: 1,
            layoutColumns: 1,
            referenceImages: mergedReferenceImages,
          }),
          clientRequestId: requestRecord?.requestId,
        },
        {
          signal: requestAbortController.signal,
          onStatus: (eventPayload) => {
            bumpDevMetric("stream:storyboardGeneration:onStatus");

            if (!eventPayload?.message) {
              if (requestRecord?.requestId) {
                const nextTaskProgress = normalizeRequestTaskProgress({
                  ...requestRecord,
                  ...eventPayload,
                });

                if (nextTaskProgress) {
                  updateRequestTask(requestRecord.requestId, nextTaskProgress);
                }
              }

              return;
            }

            updateStoryboardCell(cellId, (cell) => ({
              ...cell,
              pendingRequestId: requestRecord?.requestId || cell.pendingRequestId,
              statusText: eventPayload.message,
            }));

            if (requestRecord?.requestId) {
              const nextTaskProgress = normalizeRequestTaskProgress({
                ...requestRecord,
                ...eventPayload,
                message: `${editorCell.label} · ${eventPayload.message}`,
              });

              if (nextTaskProgress) {
                updateRequestTask(requestRecord.requestId, nextTaskProgress);
              }
            }
          },
        },
      );
      const nextResult = buildGeneratedImageRecord(data, {
        promptSnapshot: requestedPromptValue,
        storyboardCellId: cellId,
        storyboardCellLabel: editorCell.label,
        storyboardCellCoordinate: editorCell.coordinateLabel,
      });

      if (!nextResult) {
        throw new Error("banana 没有返回可用图片");
      }

      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        pendingRequestId: "",
        status: "success",
        statusText: "生成完成",
        error: "",
        record: nextResult,
      }));
      setCurrentGenerationSelection([nextResult], nextResult);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));
      updateRequestTask(requestRecord?.requestId, {
        status: "succeeded",
        stage: "result",
        message: `${editorCell.label} 生成完成`,
        error: "",
        queuePosition: 0,
        queueRateLimitWaitMs: 0,
      });

      try {
        await persistGeneratedRecord(nextResult);
      } catch (error) {
        console.warn("Persist storyboard cell result failed:", error);
        updateStoryboardCell(cellId, (cell) => ({
          ...cell,
          error: "图片已生成，但写入本地资源管理器失败",
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "banana 生图失败";

      if (isRequestCancelledError(error)) {
        updateRequestTask(
          requestRecord?.requestId,
          buildCancelledRequestTaskPatch(message || "任务已取消"),
        );
        updateStoryboardCell(cellId, (cell) => ({
          ...cell,
          pendingRequestId: "",
          status: previousRecord ? "success" : "idle",
          statusText: message || "任务已取消",
          error: "",
          record: previousRecord,
        }));
        return;
      }

      if (error?.status) {
        updateRequestTask(requestRecord?.requestId, {
          status: "failed",
          stage: "error",
          message: `${editorCell.label} 生成失败`,
          error: message,
        });
      } else {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(requestRecord);

          if (recoveryOutcome.state === "recovered" && recoveryOutcome.data?.result) {
            const recoveredResult = buildGeneratedImageRecord(recoveryOutcome.data.result, {
              promptSnapshot: requestedPromptValue,
              storyboardCellId: cellId,
              storyboardCellLabel: editorCell.label,
              storyboardCellCoordinate: editorCell.coordinateLabel,
            });

            if (recoveredResult) {
              updateStoryboardCell(cellId, (cell) => ({
                ...cell,
                status: "success",
                statusText: "已恢复上一次请求的图片结果",
                error: "",
                pendingRequestId: "",
                record: recoveredResult,
              }));
              return;
            }
          }

          if (recoveryOutcome.state === "failed" || recoveryOutcome.state === "missing") {
            updateStoryboardCell(cellId, (cell) => ({
              ...cell,
              status: previousRecord ? "success" : "idle",
              statusText: "",
              error: message,
              pendingRequestId: "",
              record: previousRecord,
            }));
            return;
          }
        } catch {
          updateRequestTask(requestRecord?.requestId, {
            status: "processing",
            stage: "processing",
            message: `${editorCell.label} 网络中断，等待自动恢复`,
          });
        }
      }

      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        pendingRequestId: !error?.status && requestRecord?.requestId ? requestRecord.requestId : "",
        status:
          !error?.status && requestRecord?.requestId
            ? "loading"
            : previousRecord
              ? "success"
              : "idle",
        statusText:
          !error?.status && requestRecord?.requestId
            ? "连接已中断，banana 正在后端继续生成，恢复联网后会自动取回结果。"
            : "",
        error: !error?.status && requestRecord?.requestId ? "" : message,
        record: previousRecord,
      }));
    } finally {
      unregisterRequestAbortController(requestRecord?.requestId, requestAbortController);
      releaseTaskRecoveryPause();
    }
  }

  async function handleStoryboardCellGenerate(draftValues = null) {
    if (!storyboardEditorCell || !activePw) {
      return;
    }

    const currentDraftValues = draftValues || getStoryboardEditorDraft();

    if (currentDraftValues) {
      applyStoryboardEditorDraft(storyboardEditorCell.id, currentDraftValues);
    }

    const editorCell =
      currentDraftValues && storyboardEditorCell
        ? {
            ...storyboardEditorCell,
            prompt:
              typeof currentDraftValues.prompt === "string"
                ? currentDraftValues.prompt
                : storyboardEditorCell.prompt,
            caption:
              typeof currentDraftValues.caption === "string"
                ? currentDraftValues.caption
                : storyboardEditorCell.caption,
          }
        : storyboardEditorCell;
    const cellId = editorCell.id;
    const promptValue = normalizeTextValue(editorCell.prompt);
    const requestedPromptValue = buildProfessionalStoryboardPrompt(
      professionalGlobalPrompt,
      promptValue,
    );

    if (!promptValue) {
      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        error: "请先填写这个格子的提示词",
      }));
      return;
    }

    if (!generationModelId) {
      updateStoryboardCell(cellId, (cell) => ({
        ...cell,
        error: "请先选择一个 banana 模型",
      }));
      return;
    }

    await executeStoryboardCellTask({
      editorCell,
      modelId: generationModelId,
      requestedPromptValue,
      storyboardAspectRatio: professionalStoryboardAspectRatioValue,
      storyboardImageSize: professionalStoryboardImageSizeValue,
      globalReferenceImageRecords: referenceImages,
    });
  }

  async function executeGenerationTask({
    mode,
    modelId,
    prompt,
    aspectRatio,
    imageSize,
    imageCount,
    layoutRows,
    layoutColumns,
    referenceImageRecords,
  }) {
    const isSimpleTask = mode === "simple";

    setStudioPending(true);
    setStudioError("");
    setStudioNotice("");
    const releaseBackendRequest = beginBackendRequest(
      "banana 正在生图...",
      secondsToEstimateMs(60),
    );
    const releaseTaskRecoveryPause = beginTaskRecoveryPause();
    const promptSnapshot = prompt;
    const requestRecord = upsertRequestTask({
      requestId: createClientRequestId(),
      type: "generation",
      mode: isSimpleTask ? "simple" : "professional",
      canRetry: true,
      promptSnapshot,
      createdAt: new Date().toISOString(),
      status: "accepted",
      stage: "accepted",
      message: "请求已提交，等待后端接收...",
    });

    if (requestRecord?.requestId) {
      setRequestTaskRetryHandler(requestRecord.requestId, async () => {
        await executeGenerationTask({
          mode,
          modelId,
          prompt,
          aspectRatio,
          imageSize,
          imageCount,
          layoutRows,
          layoutColumns,
          referenceImageRecords,
        });
      });
    }

    const requestAbortController = new AbortController();

    if (requestRecord?.requestId) {
      registerRequestAbortController(requestRecord.requestId, requestAbortController);
    }

    try {
      const payload = isSimpleTask
        ? {
            ...buildSimpleGenerationPayload({
              modelId,
              prompt,
              aspectRatio,
              imageSize,
              imageCount,
              referenceImages: buildProfessionalReferenceImages(
                referenceImageRecords,
                MAX_REFERENCE_IMAGES,
                "content",
              ),
            }),
            clientRequestId: requestRecord?.requestId,
          }
        : {
            ...buildProfessionalGenerationPayload({
              modelId,
              prompt,
              aspectRatio,
              imageSize,
              imageCount,
              layoutRows,
              layoutColumns,
              referenceImages: buildProfessionalReferenceImages(
                referenceImageRecords,
                PROFESSIONAL_STYLE_REFERENCE_LIMIT,
                "style",
              ),
            }),
            clientRequestId: requestRecord?.requestId,
          };

      const requestGenerate = isSimpleTask
        ? requestSimpleGeneration
        : requestProfessionalGeneration;

      const data = await requestGenerate(activePw, payload, {
        signal: requestAbortController.signal,
        onStatus: (eventPayload) => {
          bumpDevMetric("stream:generation:onStatus");

          if (eventPayload?.message) {
            setBackendBusyLabel(eventPayload.message);
          }

          if (requestRecord?.requestId) {
            const nextTaskProgress = normalizeRequestTaskProgress({
              ...requestRecord,
              ...eventPayload,
            });

            if (nextTaskProgress) {
              updateRequestTask(requestRecord.requestId, nextTaskProgress);
            }
          }
        },
        onText: (eventPayload) => {
          bumpDevMetric("stream:generation:onText");

          const previewText = formatStreamPreviewText(
            eventPayload?.aggregatedText || eventPayload?.text,
          );

          if (previewText) {
            setBackendBusyStreamText(previewText);
          }
        },
      });
      const nextResults = buildGeneratedImageRecords(data, {
        promptSnapshot,
      });

      if (nextResults.length === 0) {
        throw new Error("banana 没有返回可用图片");
      }

      setCurrentGenerationSelection(nextResults, nextResults[0]);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));
      setStudioNotice("");
      updateRequestTask(requestRecord?.requestId, {
        status: "succeeded",
        stage: "result",
        message: "生成完成",
        error: "",
        queuePosition: 0,
        queueRateLimitWaitMs: 0,
      });

      try {
        await persistGeneratedRecords(nextResults, nextResults[0].id);
      } catch (error) {
        console.warn("Persist generated result failed:", error);
        setStudioError("图片已生成，但写入本地资源管理器失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "banana 生图失败";

      if (isRequestCancelledError(error)) {
        setStudioError("");
        setStudioNotice(message || "任务已取消");
        updateRequestTask(
          requestRecord?.requestId,
          buildCancelledRequestTaskPatch(message || "任务已取消"),
        );
        return;
      }

      if (error?.status) {
        setStudioNotice("");
        setStudioError(message);
        updateRequestTask(requestRecord?.requestId, {
          status: "failed",
          stage: "error",
          message,
          error: message,
        });
      } else {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(requestRecord);

          if (recoveryOutcome.state === "recovered") {
            return;
          }

          if (recoveryOutcome.state === "failed" || recoveryOutcome.state === "missing") {
            return;
          }
        } catch {
          setStudioNotice("网络波动后已切换到自动恢复模式，恢复联网后会继续补取结果。");
        }

        setStudioError("连接已中断，banana 仍在后端继续生成。恢复联网后会自动取回结果。");
      }
    } finally {
      unregisterRequestAbortController(requestRecord?.requestId, requestAbortController);
      releaseTaskRecoveryPause();
      releaseBackendRequest();
      setStudioPending(false);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (isSimplePanelMode && !simplePrompt.trim()) {
      setStudioError("请输入你希望 banana 生成的画面要求");
      return;
    }

    if (!generationModelId) {
      setStudioError("请先选择一个 banana 模型");
      return;
    }

    await executeGenerationTask({
      mode: isSimplePanelMode ? "simple" : "professional",
      modelId: generationModelId,
      prompt: isSimplePanelMode ? simplePrompt : professionalGlobalPrompt,
      aspectRatio: generationAspectRatio,
      imageSize: generationImageSize,
      imageCount: generationImageCount,
      layoutRows: generationLayoutRows,
      layoutColumns: generationLayoutColumns,
      referenceImageRecords: isSimplePanelMode ? simpleReferenceImages : referenceImages,
    });
  }

  async function executeEnhancementTask({
    sourceGenerationRecord,
    promptSnapshot,
    targetImageSize,
  }) {
    if (!sourceGenerationRecord || !activePw) {
      return;
    }

    setEnhancePending(true);
    setStudioError("");
    setStudioNotice("");
    const releaseBackendRequest = beginBackendRequest(
      targetImageSize
        ? `正在提升到 ${targetImageSize}...`
        : "正在提升清晰度...",
      secondsToEstimateMs(60),
    );
    const releaseTaskRecoveryPause = beginTaskRecoveryPause();
    const requestRecord = upsertRequestTask({
      requestId: createClientRequestId(),
      type: "enhance",
      mode: "enhance",
      canRetry: true,
      promptSnapshot,
      createdAt: new Date().toISOString(),
      status: "accepted",
      stage: "accepted",
      message: "请求已提交，等待后端接收...",
    });

    if (requestRecord?.requestId) {
      setRequestTaskRetryHandler(requestRecord.requestId, async () => {
        await executeEnhancementTask({
          sourceGenerationRecord,
          promptSnapshot,
          targetImageSize,
        });
      });
    }

    const requestAbortController = new AbortController();

    if (requestRecord?.requestId) {
      registerRequestAbortController(requestRecord.requestId, requestAbortController);
    }

    try {
      const payload = {
        modelId: sourceGenerationRecord.bananaModelId,
        prompt: promptSnapshot,
        sourceImage: {
          name: `enhance-source-${sourceGenerationRecord.savedRecord?.id || "current"}.png`,
          mimeType: sourceGenerationRecord.mimeType,
          data: sourceGenerationRecord.imageBase64,
        },
        imageOptions: {
          aspectRatio: sourceGenerationRecord.aspectRatio || professionalDefaultCellAspectRatio,
          imageSize: targetImageSize,
          layoutRows: sourceGenerationRecord.layoutRows || professionalLayoutRows,
          layoutColumns: sourceGenerationRecord.layoutColumns || professionalLayoutColumns,
        },
        // Preserve panel structure through text instructions instead of sending the
        // local guide canvas, which can leak guide visuals into the final image.
        layoutGuideImage: null,
        clientRequestId: requestRecord?.requestId,
      };
      const data = await requestEnhancement(activePw, payload, {
        signal: requestAbortController.signal,
        onStatus: (eventPayload) => {
          bumpDevMetric("stream:enhance:onStatus");

          if (eventPayload?.message) {
            setBackendBusyLabel(eventPayload.message);
          }

          if (requestRecord?.requestId) {
            const nextTaskProgress = normalizeRequestTaskProgress({
              ...requestRecord,
              ...eventPayload,
            });

            if (nextTaskProgress) {
              updateRequestTask(requestRecord.requestId, nextTaskProgress);
            }
          }
        },
        onText: (eventPayload) => {
          bumpDevMetric("stream:enhance:onText");

          const previewText = formatStreamPreviewText(
            eventPayload?.aggregatedText || eventPayload?.text,
          );

          if (previewText) {
            setBackendBusyStreamText(previewText);
          }
        },
      });
      const nextResults = buildGeneratedImageRecords(
        {
          ...(sourceGenerationRecord || {}),
          ...data,
        },
        {
          promptSnapshot,
        },
      );

      const nextResult = nextResults[0];

      if (!nextResult) {
        throw new Error("banana 没有返回可用图片");
      }

      setCurrentGenerationSelection([nextResult], nextResult);
      setRemainingQuota(normalizeRemainingCredits(data?.quota?.remainingCredits));
      setStudioNotice("");
      updateRequestTask(requestRecord?.requestId, {
        status: "succeeded",
        stage: "result",
        message: "提升完成",
        error: "",
        queuePosition: 0,
        queueRateLimitWaitMs: 0,
      });

      try {
        await persistGeneratedRecord(nextResult);
      } catch (error) {
        console.warn("Persist enhanced result failed:", error);
        setStudioError("图片已生成，但写入本地资源管理器失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "提升清晰度失败";

      if (isRequestCancelledError(error)) {
        setStudioError("");
        setStudioNotice(message || "任务已取消");
        updateRequestTask(
          requestRecord?.requestId,
          buildCancelledRequestTaskPatch(message || "任务已取消"),
        );
        return;
      }

      if (error?.status) {
        setStudioNotice("");
        setStudioError(message);
        updateRequestTask(requestRecord?.requestId, {
          status: "failed",
          stage: "error",
          message,
          error: message,
        });
      } else {
        try {
          const recoveryOutcome = await recoverRequestTaskFromServer(requestRecord);

          if (recoveryOutcome.state === "recovered") {
            return;
          }

          if (recoveryOutcome.state === "failed" || recoveryOutcome.state === "missing") {
            return;
          }
        } catch {
          setStudioNotice("网络波动后已切换到自动恢复模式，恢复联网后会继续补取结果。");
        }

        setStudioError("连接已中断，后端仍在继续提升图片。恢复联网后会自动取回结果。");
      }
    } finally {
      unregisterRequestAbortController(requestRecord?.requestId, requestAbortController);
      releaseTaskRecoveryPause();
      releaseBackendRequest();
      setEnhancePending(false);
    }
  }

  async function handleEnhanceGeneration() {
    if (!generationResult || !canEnhanceGeneration || !activePw) {
      return;
    }

    await executeEnhancementTask({
      sourceGenerationRecord: generationResult,
      promptSnapshot: generationResult?.promptSnapshot || simplePrompt,
      targetImageSize: enhancementTargetImageSize,
    });
  }

  function openResourceManager() {
    if (resourceManagerOpen || resourceManagerPending) {
      return;
    }

    setResourceManagerPending(true);
    void ensureGenerationLibraryLoaded()
      .then(() => {
        setResourceManagerOpen(true);
      })
      .catch((error) => {
        setStudioError(error instanceof Error ? error.message : "资源管理器加载失败");
      })
      .finally(() => {
        setResourceManagerPending(false);
      });
  }

  function handlePreviewStoredRecord(record) {
    setCurrentGenerationSelection([record], record);
    void Promise.all([
      writeLastGenerationRecordId(record.id),
      writeLastGenerationRecord(record),
    ]);
    openImagePreview(record);
  }

  if (sessionState === "checking") {
    return (
      <div className="page-shell">
        <main className="status-card">
          <p className="eyebrow">BANANA ACCESS</p>
          <h1>正在校验提取码</h1>
          <p>如果当前 pw 仍有效，会自动进入 banana 工作台。</p>
          {generationResult ? (
            <div className="restored-result-card">
              <div className="restored-result-copy">
                <strong>已恢复上次结果</strong>
                <span>
                  {generationResult.imageSize || "已保存"} · {generationResult.aspectRatio || "原图"}
                </span>
              </div>
              <img
                className="restored-result-image"
                src={generationResult.previewUrl}
                alt="Restored Banana result"
                decoding="async"
              />
            </div>
          ) : null}
        </main>
        {backendBusyOverlay}
      </div>
    );
  }

  if (routeMode === "studio" && sessionState !== "ready" && !shouldAutoVerifyStudioPassword) {
    return <RouteRedirect to={LOGIN_PATH} />;
  }

  if (sessionState !== "ready") {
    return (
      <div className="page-shell">
        <main className="gate-layout">
          <section className="gate-hero">
            <img
              className="gate-hero-image"
              src="/bg/002.png"
              alt="Banana Studio 展示图"
              decoding="async"
            />
          </section>

          <section className="gate-panel">
            <img
              className="gate-panel-logo"
              src="/logo.png"
              alt="Banana Studio logo"
              decoding="async"
            />
            <form className="gate-form" onSubmit={handleVerifySubmit}>
              <label htmlFor="password">提取码</label>
              <input
                id="password"
                name="password"
                type="text"
                autoComplete="one-time-code"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入提取码"
              />
              <button type="submit" disabled={authPending || !password.trim()}>
                {authPending ? "校验中..." : "进入"}
              </button>
              {authError ? <p className="error-text">{authError}</p> : null}
            </form>
            <p className="panel-note">
              当前链接参数自动填入值：
              <strong>{readSearchParam("pw") || "未提供"}</strong>
            </p>
          </section>
        </main>
        {backendBusyOverlay}
      </div>
    );
  }

  return (
    <div className="page-shell studio-shell">
      <header className="studio-topbar">
        <div className="studio-brand">
          <img className="studio-brand-logo" src="/logo.png" alt="Banana Studio" decoding="async" />
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`resource-manager-trigger task-manager-trigger${taskManagerOpen ? " is-active" : ""}`}
            onClick={() => setTaskManagerOpen(true)}
            aria-label={activeRequestTaskCount > 0 ? `打开任务列表，当前有 ${activeRequestTaskCount} 个进行中的任务` : "打开任务列表"}
            title="任务列表"
          >
            <span
              className={`task-manager-indicator${activeRequestTaskCount > 0 ? " is-active" : ""}`}
              aria-hidden="true"
            >
              <span className="task-manager-indicator-core">
                {activeRequestTaskCount > 0 ? (
                  <span className="task-manager-indicator-count">{activeRequestTaskCount}</span>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 6h12" />
                    <path d="M8 12h12" />
                    <path d="M8 18h12" />
                    <path d="M4 6h.01" />
                    <path d="M4 12h.01" />
                    <path d="M4 18h.01" />
                  </svg>
                )}
              </span>
            </span>
            <span className="resource-manager-trigger-label" aria-hidden="true">
              任务
            </span>
          </button>
          <button
            type="button"
            className={`resource-manager-trigger${resourceManagerPending ? " is-pending" : ""}`}
            onClick={openResourceManager}
            aria-label={resourceManagerPending ? "资源管理器加载中" : "打开资源管理器"}
            aria-busy={resourceManagerPending ? "true" : undefined}
            title={resourceManagerPending ? "资源管理器加载中" : "资源管理器"}
            disabled={resourceManagerPending}
          >
            <span className="sr-only">资源管理器</span>
            {resourceManagerPending ? (
              <span className="resource-manager-trigger-spinner" aria-hidden="true" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="8" height="18" x="3" y="3" rx="1" />
                <path d="M7 3v18" />
                <path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" />
              </svg>
            )}
            <span className="resource-manager-trigger-label" aria-hidden="true">
              {resourceManagerPending ? "加载中" : "库"}
            </span>
          </button>
        </div>
      </header>

      <main className={`studio-layout${isProfessionalPanelMode ? " is-professional-layout" : ""}`}>
        {showResultPanel || showProfessionalExportPanel ? (
          <section className={`studio-panel result-panel${showProfessionalExportPanel ? " professional-export-panel" : ""}`}>
            {showResultPanel ? (
              <>
                <div className="section-title">
                  <h2>生成结果</h2>
                  <p>完成后可以直接预览和下载。</p>
                </div>

                {generationResult ? (
                  <div className="result-card">
                    <div className="result-toolbar">
                      {generationResult.imageSize ? (
                        <span className="result-chip">
                          {generationResults.length > 1 ? `已生成 ${generationResults.length} 张独立图片 · ` : ""}
                          {generationResult.imageSize}
                          {generationResult.aspectRatio
                            ? ` · ${generationResult.aspectRatio}`
                            : isSimplePanelMode
                              ? " · 自动比例"
                              : ""}
                        </span>
                      ) : null}
                      <div className="result-toolbar-actions">
                        {canEnhanceGeneration ? (
                          <button
                            type="button"
                            className="enhance-button"
                            onClick={handleEnhanceGeneration}
                            disabled={enhancePending || studioPending}
                          >
                            {enhancePending
                              ? `提升到 ${enhancementTargetImageSize} 中...`
                              : `提升清晰度 · 目标 ${enhancementTargetImageSize}`}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {generationResults.length > 1 ? (
                      <div className="result-variant-grid">
                        {generationResults.map((record, index) => {
                          const isActive = record.id === generationResult.id;

                          return (
                            <button
                              key={record.id}
                              type="button"
                              className={`result-variant-button${isActive ? " is-active" : ""}`}
                              onClick={() => handleSelectGenerationResult(record)}
                              aria-pressed={isActive}
                            >
                              <span className="result-variant-media">
                                <img
                                  className="result-variant-image"
                                  src={record.previewUrl}
                                  alt={`Banana generated variant ${index + 1}`}
                                  draggable="false"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <span className="result-variant-label">{index + 1}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="result-image-button"
                      onClick={() => openImagePreview(generationResult)}
                      aria-label="打开图片预览"
                    >
                      <img
                        className="result-image"
                        src={generationResult.previewUrl}
                        alt="Banana generated result"
                        draggable="false"
                        decoding="async"
                      />
                    </button>
                    <a
                      className="download-link"
                      href={generationResult.previewUrl}
                      download={generationResult.downloadName}
                    >
                      下载图片
                    </a>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>结果区还没有图片。</p>
                    <small>选好 banana 模型，写下要求后生成。</small>
                  </div>
                )}
              </>
            ) : null}

            {showProfessionalExportPanel ? (
              <>
                <div className="section-title">
                  <h2>专业模式导出预览</h2>
                  <p>下载时会由后端使用 Playwright 对下方表格截图并返回 PNG。</p>
                </div>

                <div className="professional-export-card" ref={setProfessionalExportCardElement}>
                  <div className="result-toolbar">
                    <span className="result-chip">
                      {professionalCanvasSizeOption.label} · {professionalLayoutRows} 行 × {professionalLayoutColumns} 列
                    </span>
                    <div className="result-toolbar-actions professional-export-toolbar-actions">
                      <input
                        ref={professionalSceneImportInputRef}
                        className="sr-only"
                        type="file"
                        accept="application/json,.json"
                        onChange={handleImportProfessionalSceneFileChange}
                      />
                      <button
                        type="button"
                        className="ghost-button professional-export-transfer-button"
                        onClick={handleOpenProfessionalSceneImport}
                        disabled={!professionalSceneTransferReady || professionalSceneTransferPending}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M10 3.8v8.8" />
                          <path d="m6.8 9.5 3.2 3.2 3.2-3.2" />
                          <path d="M4.2 14.8h11.6" />
                          <path d="M5.3 14.8v.8c0 .8.6 1.4 1.4 1.4h6.6c.8 0 1.4-.6 1.4-1.4v-.8" />
                        </svg>
                        <span>{professionalSceneTransferPending ? "处理中..." : "导入场景"}</span>
                      </button>
                      <button
                        type="button"
                        className="ghost-button professional-export-transfer-button"
                        onClick={() => openProfessionalSceneExportDialog("json")}
                        disabled={!professionalSceneTransferReady || professionalSceneTransferPending}
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M10 16.2V7.4" />
                          <path d="m6.8 10.6 3.2-3.2 3.2 3.2" />
                          <path d="M4.2 5.2h11.6" />
                          <path d="M5.3 5.2v-.8c0-.8.6-1.4 1.4-1.4h6.6c.8 0 1.4.6 1.4 1.4v.8" />
                        </svg>
                        <span>{professionalSceneTransferPending ? "处理中..." : "导出场景"}</span>
                      </button>
                      <button
                        type="button"
                        className="ghost-button professional-export-toggle-button"
                        onClick={() =>
                          setProfessionalExportPreviewVisible((currentValue) => !currentValue)
                        }
                        aria-pressed={professionalExportPreviewVisible}
                        aria-label={professionalExportPreviewVisible ? "隐藏预览" : "显示预览"}
                        title={professionalExportPreviewVisible ? "隐藏预览" : "显示预览"}
                      >
                        {professionalExportPreviewVisible ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M1.8 10s3-5 8.2-5 8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" />
                            <circle cx="10" cy="10" r="2.7" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M1.8 10s3-5 8.2-5c1.8 0 3.3.6 4.5 1.4 2.3 1.7 3.7 3.6 3.7 3.6s-3 5-8.2 5c-2 0-3.8-.7-5.2-1.7C2.9 11.7 1.8 10 1.8 10Z" />
                            <circle cx="10" cy="10" r="2.7" />
                            <path d="M3.5 3.5 16.5 16.5" />
                          </svg>
                        )}
                        <span className="sr-only">
                          {professionalExportPreviewVisible ? "隐藏预览" : "显示预览"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`ghost-button storyboard-share-button${storyboardShareCopyState === "success" ? " is-success" : storyboardShareCopyState === "error" ? " is-error" : ""}`}
                        onClick={handleCopyStoryboardShare}
                        disabled={!storyboardShareText}
                        aria-label={
                          storyboardShareCopyState === "success"
                            ? "已复制分享"
                            : storyboardShareCopyState === "error"
                              ? "复制失败"
                              : "复制分享"
                        }
                        title={
                          storyboardShareCopyState === "success"
                            ? "已复制分享"
                            : storyboardShareCopyState === "error"
                              ? "复制失败"
                              : "复制分享"
                        }
                      >
                        {storyboardShareCopyState === "success" ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="m4.5 10.5 3.2 3.2 7.8-7.8" />
                          </svg>
                        ) : storyboardShareCopyState === "error" ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M10 5.2v5.8" />
                            <path d="M10 14.4h.01" />
                            <path d="M10 17.2a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M7 6.2V5.1c0-.9.7-1.6 1.6-1.6h6.3c.9 0 1.6.7 1.6 1.6v8.3c0 .9-.7 1.6-1.6 1.6H13" />
                            <path d="M5.1 6.4h6.3c.9 0 1.6.7 1.6 1.6v6.9c0 .9-.7 1.6-1.6 1.6H5.1c-.9 0-1.6-.7-1.6-1.6V8c0-.9.7-1.6 1.6-1.6Z" />
                          </svg>
                        )}
                        <span className="sr-only">
                          {storyboardShareCopyState === "success"
                            ? "已复制分享"
                            : storyboardShareCopyState === "error"
                              ? "复制失败"
                              : "复制分享"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {normalizeTextValue(professionalGlobalPrompt) ? (
                    <p className="professional-export-global-prompt">
                      全局提示词与画风参考图：{normalizeTextValue(professionalGlobalPrompt)}
                    </p>
                  ) : null}
                  {shouldRenderProfessionalExportPreview ? (
                    <div className="professional-export-stage">
                      <div className="professional-export-viewport" style={professionalExportViewportStyle}>
                        <div className="professional-export-sheet" style={professionalExportSheetStyle}>
                          <div
                            id="professional-export-preview-capture"
                            className="professional-export-grid"
                            style={professionalExportGridStyle}
                          >
                            {storyboardCellList.map((cell) => (
                              <div
                                key={cell.id}
                                className={`professional-export-cell${cell.record ? " has-image" : ""}${normalizeTextValue(cell.caption) ? " has-caption" : ""}`}
                              >
                                {cell.record ? (
                                  <img
                                    className="professional-export-cell-image"
                                    src={cell.record.previewUrl}
                                    alt={`${cell.label} 导出预览`}
                                    draggable="false"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="professional-export-placeholder">
                                    {normalizeTextValue(cell.prompt) || "待生成"}
                                  </div>
                                )}
                                {normalizeTextValue(cell.caption) ? (
                                  <span className="professional-export-cell-caption">
                                    <span className="professional-export-cell-caption-text">
                                      {normalizeTextValue(cell.caption)}
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="professional-export-stage professional-export-stage-placeholder">
                      <p>
                        {isMobilePerformanceMode
                          ? "移动端默认关闭导出预览，避免重复渲染整张大画布。需要时再手动展开。"
                          : "导出预览已隐藏，展开后会重新渲染整张导出画布。"}
                      </p>
                    </div>
                  )}
                  <div className="professional-export-download-row">
                    <button
                      type="button"
                      className="primary-button professional-export-download-button"
                      onClick={handleDownloadProfessionalExport}
                      disabled={professionalExportPending || !professionalExportHasRenderableContent}
                    >
                      {professionalExportPending ? "正在导出..." : "下载 PNG"}
                    </button>
                    <button
                      type="button"
                      className="primary-button professional-export-download-button professional-export-zip-button"
                      onClick={() => openProfessionalSceneExportDialog("zip")}
                      disabled={!professionalSceneTransferReady || professionalSceneTransferPending}
                    >
                      <svg
                        className="professional-export-zip-button-icon"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path d="M6.2 3.1h6.3l2.5 2.6v8.1a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2V5.1a2 2 0 0 1 2-2Z" />
                        <path d="M12.5 3.1v2.6h2.5" />
                        <path d="M10 6.1v1.2" />
                        <path d="M10 8.5v1.2" />
                        <path d="M10 10.9v1.2" />
                        <path d="M8.3 8.5h3.4" />
                        <path d="M8.3 10.9h3.4" />
                        <path d="M8.3 13.3h3.4" />
                      </svg>
                      <span>
                        {professionalSceneTransferPending ? "处理中..." : "下载图片素材包"}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <section
          className={`studio-panel prompt-panel${isPromptFocusMode ? " is-focus-mode" : ""}`}
        >
          <form
            className={`prompt-form${isPromptFocusMode ? " is-focus-mode" : ""}${isSimplePanelMode ? " is-simple-panel" : ""}`}
            onSubmit={handleGenerate}
          >
            <div className="panel-mode-switcher" role="tablist" aria-label="右侧面板模式">
              <button
                type="button"
                role="tab"
                aria-selected={isSimplePanelMode}
                className={`panel-mode-button${isSimplePanelMode ? " is-active" : ""}`}
                onClick={() => setPanelMode(PANEL_MODE_SIMPLE)}
              >
                简易模式
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isProfessionalPanelMode}
                className={`panel-mode-button${isProfessionalPanelMode ? " is-active" : ""}`}
                onClick={() => setPanelMode(PANEL_MODE_PROFESSIONAL)}
              >
                专业模式
              </button>
            </div>
            {showPromptField ? (
              <>
                <div className="prompt-field-header">
                  <label className="field-label" htmlFor="prompt">
                    文本要求
                  </label>
                </div>
                <textarea
                  ref={promptTextareaRef}
                  id="prompt"
                  name="prompt"
                  rows={PROMPT_TEXTAREA_MIN_ROWS}
                  value={simplePrompt}
                  onChange={(event) => setSimplePrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (isPromptFocusMode && event.key === "Escape") {
                      event.preventDefault();
                      setPromptMode("simple");
                    }
                  }}
                  placeholder="描述你想要的 banana 画面、风格、镜头、材质、色调和构图"
                />

                {isPromptFocusMode ? (
                  <div className="focus-mode-note">按 `Esc` 也可以退出专注输入。</div>
                ) : null}

                <div
                  className={`storyboard-style-disclosure simple-reference-disclosure${simpleReferenceDisclosureOpen ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className={`storyboard-style-toggle${simpleReferenceDisclosureOpen ? " is-open" : ""}`}
                    aria-expanded={simpleReferenceDisclosureOpen}
                    aria-controls="simple-reference-controls"
                    onClick={() =>
                      setSimpleReferenceDisclosureOpen((currentValue) => !currentValue)
                    }
                  >
                    <span>简易模式参考图</span>
                    <span className="storyboard-style-toggle-meta">
                      {simpleStyleReference ? `已上传：${simpleStyleReference.name}` : "未设置，可选"}
                    </span>
                    <span className="storyboard-style-toggle-icon" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {simpleReferenceDisclosureOpen ? (
                    <div className="storyboard-style-controls-shell">
                      <div
                        id="simple-reference-controls"
                        className="simple-reference-panel"
                        aria-label="简易模式参考图设置"
                      >
                        <p className="simple-reference-note">
                          可选上传 1 张参考图。简易模式不会限制长宽比，交给模型自行判断更合适的画幅。
                        </p>

                        {simpleStyleReference ? (
                          <div className="professional-style-reference-card">
                            <div className="professional-style-reference-media">
                              <img
                                src={simpleStyleReference.previewUrl}
                                alt={simpleStyleReference.name}
                                draggable="false"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                            <div className="professional-style-reference-copy">
                              <strong title={simpleStyleReference.name}>
                                {simpleStyleReference.name}
                              </strong>
                              <span>这张图会作为简易模式的参考图，帮助模型理解主体和风格。</span>
                              {getReferenceImageOptimizationSummary(simpleStyleReference) ? (
                                <span>{getReferenceImageOptimizationSummary(simpleStyleReference)}</span>
                              ) : null}
                            </div>
                            <div className="professional-style-reference-actions">
                              <label
                                className="ghost-button professional-style-reference-action"
                                aria-label="更换简易模式参考图"
                                title="上传新图"
                              >
                                <svg viewBox="0 0 20 20" aria-hidden="true">
                                  <path d="M10 13V4.5" />
                                  <path d="m6.8 7.7 3.2-3.2 3.2 3.2" />
                                  <path d="M4.5 14.5v.6c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4v-.6" />
                                </svg>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleSimpleReferenceFileChange}
                                />
                              </label>
                              <button
                                type="button"
                                className="ghost-button professional-style-reference-action professional-style-reference-action-danger"
                                onClick={() => handleRemoveSimpleReferenceImage(simpleStyleReference.id)}
                                aria-label="移除简易模式参考图"
                                title="移除图片"
                              >
                                <svg viewBox="0 0 20 20" aria-hidden="true">
                                  <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
                                  <path d="M4 6h12" />
                                  <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
                                  <path d="M8 9v4.5" />
                                  <path d="M12 9v4.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label
                            className={`upload-box professional-style-upload${uploadDragActive ? " is-drag-active" : ""}`}
                            onDragOver={handleUploadDragOver}
                            onDragLeave={handleUploadDragLeave}
                            onDrop={handleSimpleReferenceUploadDrop}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleSimpleReferenceFileChange}
                            />
                            <span>上传简易模式参考图</span>
                            <small>支持点击选择或拖入图片，最多 1 张。超大图片会自动压缩后上传。</small>
                          </label>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {showProfessionalPanelControls ? (
              <>
                <div className="layout-config-card">
                  <div className="layout-control-row">
                    <div className="image-option-field layout-select-field canvas-size-full-row-field">
                      <label className="field-label" htmlFor="canvasSizeSelector">
                        常用场景
                      </label>
                      <div className="scenario-select-row">
                        <select
                          id="canvasSizeSelector"
                          name="canvasSizeSelector"
                          className="model-selector compact-selector scenario-compact-selector"
                          value={professionalCanvasSize}
                          disabled={professionalSceneTransferPending}
                          onChange={(event) => handleCanvasSizeSelectorChange(event.target.value)}
                        >
                          {EXAMPLE_SCENE_OPTIONS.length > 0 ? (
                            <optgroup label="示例场景">
                              {EXAMPLE_SCENE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          {allCanvasScenarioOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="ghost-button scenario-manager-trigger"
                          onClick={openScenarioManager}
                          aria-label="打开常用场景管理面板"
                          title="管理常用场景"
                          disabled={professionalSceneTransferPending}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M4.5 5.5h11" />
                            <path d="M4.5 10h11" />
                            <path d="M4.5 14.5h11" />
                            <path d="M7 4.5v11" />
                            <path d="M13 4.5v11" />
                          </svg>
                        </button>
                      </div>
                      {exampleSceneLoadingLabel ? (
                        <p className="scenario-select-loading" role="status" aria-live="polite">
                          <span className="scenario-select-loading-spinner" aria-hidden="true" />
                          <span>正在加载示例场景“{exampleSceneLoadingLabel}”...</span>
                        </p>
                      ) : null}
                    </div>

                    {isSimplePanelMode ? (
                      <label className="image-option-field image-count-field" htmlFor="imageCountSelector">
                        <span className="field-label">生成张数</span>
                        <select
                          id="imageCountSelector"
                          name="imageCountSelector"
                          className="model-selector compact-selector"
                          value={professionalSelectedImageCount}
                          onChange={(event) =>
                            setProfessionalSelectedImageCount(
                              normalizeImageCountValue(event.target.value),
                            )
                          }
                        >
                          {IMAGE_COUNT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                  </div>

                  <div className="professional-storyboard-global-panel">
                    <label className="field-label" htmlFor="professionalGlobalPrompt">
                      全局提示词与画风参考图
                    </label>
                    <textarea
                      className="professional-global-prompt-textarea"
                      id="professionalGlobalPrompt"
                      name="professionalGlobalPrompt"
                      rows={2}
                      value={professionalGlobalPrompt}
                      onChange={(event) => setProfessionalGlobalPrompt(event.target.value)}
                      placeholder="补充所有分镜共享的人物设定、画风、服装一致性、镜头语言和整体氛围"
                    />

                    <div className="professional-style-reference-panel">
                      {professionalStyleReference ? (
                        <div className="professional-style-reference-card">
                          <div className="professional-style-reference-media">
                            <img
                              src={professionalStyleReference.previewUrl}
                              alt={professionalStyleReference.name}
                              draggable="false"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="professional-style-reference-copy">
                            <strong title={professionalStyleReference.name}>
                              {professionalStyleReference.name}
                            </strong>
                            <span>这张图会自动附加到每个格子的生图请求里。</span>
                            {getReferenceImageOptimizationSummary(professionalStyleReference) ? (
                              <span>{getReferenceImageOptimizationSummary(professionalStyleReference)}</span>
                            ) : null}
                          </div>
                          <div className="professional-style-reference-actions">
                            <label
                              className="ghost-button professional-style-reference-action"
                              aria-label="更换整体画风参考图"
                              title="上传新图"
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M10 13V4.5" />
                                <path d="m6.8 7.7 3.2-3.2 3.2 3.2" />
                                <path d="M4.5 14.5v.6c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4v-.6" />
                              </svg>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                              />
                            </label>
                            <button
                              type="button"
                              className="ghost-button professional-style-reference-action professional-style-reference-action-danger"
                              onClick={() => handleRemoveReferenceImage(professionalStyleReference.id)}
                              aria-label="移除整体画风参考图"
                              title="移除图片"
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
                                <path d="M4 6h12" />
                                <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
                                <path d="M8 9v4.5" />
                                <path d="M12 9v4.5" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label
                          className={`upload-box professional-style-upload${uploadDragActive ? " is-drag-active" : ""}`}
                          onDragOver={handleUploadDragOver}
                          onDragLeave={handleUploadDragLeave}
                          onDrop={handleUploadDrop}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                          <span>上传整体画风参考图</span>
                          <small>支持点击选择或拖入图片，最多 1 张。超大图片会自动压缩后上传。</small>
                        </label>
                      )}
                    </div>
                  </div>

                  <ProfessionalStoryboardGridSection
                    clearButtonDisabled={!storyboardHasContent || storyboardHasLoadingCells}
                    actionRef={storyboardGridActionRef}
                    storyboardShellStyle={storyboardShellStyle}
                    storyboardDragSensors={storyboardDragSensors}
                    storyboardGridStyle={storyboardGridStyle}
                    isSorting={Boolean(activeStoryboardDragId)}
                    storyboardSortableIds={storyboardSortableIds}
                    storyboardCellList={storyboardCellList}
                    isMobilePerformanceMode={isMobilePerformanceMode}
                    interactionRef={storyboardCellInteractionRef}
                    activeStoryboardDragCell={activeStoryboardDragCell}
                  />

                  <div
                    className={`storyboard-style-disclosure professional-storyboard-disclosure${storyboardImageControlsCollapsed ? "" : " is-open"}`}
                  >
                    <button
                      type="button"
                      className={`storyboard-style-toggle${storyboardImageControlsCollapsed ? "" : " is-open"}`}
                      aria-expanded={!storyboardImageControlsCollapsed}
                      aria-controls="storyboard-image-controls"
                      onClick={() =>
                        setStoryboardImageControlsCollapsed((currentValue) => !currentValue)
                      }
                    >
                      <span>图片设置</span>
                      <span className="storyboard-style-toggle-meta">
                        底模 {selectedModel?.name || professionalSelectedModelId || "未选择"} · 比例 {professionalStoryboardAspectRatioValue} · 分辨率 {professionalStoryboardImageSizeValue}
                      </span>
                      <span className="storyboard-style-toggle-icon" aria-hidden="true">
                        ▾
                      </span>
                    </button>

                    {!storyboardImageControlsCollapsed ? (
                      <div className="storyboard-style-controls-shell">
                        <div
                          id="storyboard-image-controls"
                          className="layout-preview-controls storyboard-style-controls-panel"
                          aria-label="分镜表格图片设置"
                        >
                          <label
                            className="image-option-field storyboard-model-field"
                            htmlFor="bananaModelSelector"
                          >
                            <span className="field-label">底模选择</span>
                            <select
                              id="bananaModelSelector"
                              name="bananaModelSelector"
                              className="model-selector compact-selector"
                              value={professionalSelectedModelId}
                              onChange={(event) => setProfessionalSelectedModelId(event.target.value)}
                            >
                              {models.map((model) => (
                                <option key={model.id} value={model.id}>
                                  {model.name} · {model.priceLabel}
                                </option>
                              ))}
                            </select>
                            {selectedModel ? (
                              <small className="model-helper-text">{selectedModel.description}</small>
                            ) : null}
                          </label>

                          <label
                            className="image-option-field"
                            htmlFor="storyboardGlobalAspectRatio"
                          >
                            <span className="field-label-inline">
                              <span className="field-label">图片比例</span>
                              {recommendedStoryboardAspectRatio ? (
                                <small className="field-label-recommendation">
                                  推荐比例 {recommendedStoryboardAspectRatio.option.value}
                                  {recommendedStoryboardAspectRatio.option.value ===
                                  professionalStoryboardAspectRatioValue
                                    ? "（当前）"
                                    : ""}
                                </small>
                              ) : null}
                            </span>
                            <select
                              id="storyboardGlobalAspectRatio"
                              name="storyboardGlobalAspectRatio"
                              className="model-selector compact-selector"
                              value={professionalStoryboardAspectRatioValue}
                              onChange={(event) =>
                                setProfessionalStoryboardAspectRatio(
                                  normalizeAspectRatioValue(event.target.value),
                                )
                              }
                            >
                              {availableAspectRatioOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {recommendedStoryboardAspectRatio ? (
                              <div className="field-helper-row">
                                <small className="field-helper-text">
                                  按当前分镜单格的实际长宽比计算，选择{" "}
                                  {recommendedStoryboardAspectRatio.option.label} 时预计裁剪最少
                                  （约 {formatCropPercentValue(recommendedStoryboardAspectRatio.cropFraction)}）。
                                </small>
                                {canApplyRecommendedStoryboardAspectRatio ? (
                                  <button
                                    type="button"
                                    className="ghost-button field-helper-action"
                                    onClick={() =>
                                      setProfessionalStoryboardAspectRatio(
                                        recommendedStoryboardAspectRatio.option.value,
                                      )
                                    }
                                  >
                                    一键应用
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </label>

                          <label
                            className="image-option-field"
                            htmlFor="storyboardGlobalImageSize"
                          >
                            <span className="field-label">分辨率</span>
                            <select
                              id="storyboardGlobalImageSize"
                              name="storyboardGlobalImageSize"
                              className="model-selector compact-selector"
                              value={professionalStoryboardImageSizeValue}
                              onChange={(event) =>
                                setProfessionalStoryboardImageSize(
                                  normalizeImageSizeValue(event.target.value),
                                )
                              }
                            >
                              {availableImageSizeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`storyboard-style-disclosure professional-storyboard-disclosure${storyboardStyleControlsCollapsed ? "" : " is-open"}`}
                  >
                    <button
                      type="button"
                      className={`storyboard-style-toggle${storyboardStyleControlsCollapsed ? "" : " is-open"}`}
                      aria-expanded={!storyboardStyleControlsCollapsed}
                      aria-controls="storyboard-style-controls"
                      onClick={() =>
                        setStoryboardStyleControlsCollapsed((currentValue) => !currentValue)
                      }
                    >
                      <span>表格样式设置</span>
                      <span className="storyboard-style-toggle-meta">
                        布局 {professionalLayoutRows} × {professionalLayoutColumns} · 分割线 {professionalStoryboardDividerWidthPx}px · 配文字号 {professionalStoryboardCaptionFontSizePercent}%
                      </span>
                      <span className="storyboard-style-toggle-icon" aria-hidden="true">
                        ▾
                      </span>
                    </button>

                    {!storyboardStyleControlsCollapsed ? (
                      <div className="storyboard-style-controls-shell">
                        <div
                          id="storyboard-style-controls"
                          className="layout-preview-controls storyboard-style-controls-panel"
                          aria-label="分镜表格样式设置"
                        >
                          <label className="image-option-field layout-track-field" htmlFor="layoutRows">
                            <span className="field-label">行数</span>
                            <select
                              id="layoutRows"
                              name="layoutRows"
                              className="model-selector compact-selector"
                              value={professionalLayoutRows}
                              onChange={(event) => {
                                const nextRows = clampLayoutTrack(event.target.value);
                                const nextRecommendedAspectRatio =
                                  findRecommendedStoryboardAspectRatioForLayout({
                                    options: availableAspectRatioOptions,
                                    canvasWidth: professionalCanvasSizeOption.width,
                                    canvasHeight: professionalCanvasSizeOption.height,
                                    rows: nextRows,
                                    columns: professionalLayoutColumns,
                                  });

                                setProfessionalLayoutRows(nextRows);

                                if (nextRecommendedAspectRatio?.option?.value) {
                                  setProfessionalStoryboardAspectRatio(
                                    nextRecommendedAspectRatio.option.value,
                                  );
                                }
                              }}
                            >
                              {LAYOUT_TRACK_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="image-option-field layout-track-field" htmlFor="layoutColumns">
                            <span className="field-label">列数</span>
                            <select
                              id="layoutColumns"
                              name="layoutColumns"
                              className="model-selector compact-selector"
                              value={professionalLayoutColumns}
                              onChange={(event) => {
                                const nextColumns = clampLayoutTrack(event.target.value);
                                const nextRecommendedAspectRatio =
                                  findRecommendedStoryboardAspectRatioForLayout({
                                    options: availableAspectRatioOptions,
                                    canvasWidth: professionalCanvasSizeOption.width,
                                    canvasHeight: professionalCanvasSizeOption.height,
                                    rows: professionalLayoutRows,
                                    columns: nextColumns,
                                  });

                                setProfessionalLayoutColumns(nextColumns);

                                if (nextRecommendedAspectRatio?.option?.value) {
                                  setProfessionalStoryboardAspectRatio(
                                    nextRecommendedAspectRatio.option.value,
                                  );
                                }
                              }}
                            >
                              {LAYOUT_TRACK_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label
                            className="image-option-field compact-range-field"
                            htmlFor="storyboardDividerWidth"
                          >
                            <span className="field-label">
                              分割线
                              <strong>{professionalStoryboardDividerWidthPx}px</strong>
                            </span>
                            <input
                              id="storyboardDividerWidth"
                              name="storyboardDividerWidth"
                              type="range"
                              min={MIN_STORYBOARD_DIVIDER_WIDTH_PX}
                              max={MAX_STORYBOARD_DIVIDER_WIDTH_PX}
                              step="1"
                              value={professionalStoryboardDividerWidthPx}
                              onChange={(event) =>
                                setProfessionalStoryboardDividerWidthPx(
                                  normalizeStoryboardDividerWidthPx(event.target.value),
                                )
                              }
                            />
                          </label>

                          <label
                            className="image-option-field compact-range-field"
                            htmlFor="storyboardCaptionFontSize"
                          >
                            <span className="field-label">
                              配文字号
                              <strong>{professionalStoryboardCaptionFontSizePercent}%</strong>
                            </span>
                            <input
                              id="storyboardCaptionFontSize"
                              name="storyboardCaptionFontSize"
                              type="range"
                              min={MIN_STORYBOARD_CAPTION_FONT_SIZE_PERCENT}
                              max={MAX_STORYBOARD_CAPTION_FONT_SIZE_PERCENT}
                              step="5"
                              value={professionalStoryboardCaptionFontSizePercent}
                              onChange={(event) =>
                                setProfessionalStoryboardCaptionFontSizePercent(
                                  normalizeStoryboardCaptionFontSizePercent(event.target.value),
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {studioError ? <p className="error-text">{studioError}</p> : null}
            {studioNotice ? <p className="info-text">{studioNotice}</p> : null}

            {showSimplePanelSubmit ? (
              <>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={studioPending || !generationModelId}
                >
                  {studioPending ? "banana 正在生图..." : "开始生成"}
                </button>
              </>
            ) : null}
            {showProfessionalPanelControls && remainingQuota !== null ? (
              <p className="quota-hint">剩余{remainingQuota}张额度</p>
            ) : null}
          </form>
        </section>
      </main>
      <ProfessionalSceneExportDialog
        dialog={professionalSceneExportDialog}
        pending={professionalSceneTransferPending}
        onClose={closeProfessionalSceneExportDialog}
        onFileNameChange={handleProfessionalSceneExportFileNameChange}
        onConfirm={handleConfirmProfessionalSceneExport}
      />
      <TaskManagerDialog
        open={taskManagerOpen}
        activeRequestTaskCount={activeRequestTaskCount}
        sortedRequestTasks={sortedRequestTasks}
        clearableRequestTaskCount={clearableRequestTaskCount}
        retryingRequestTaskIds={retryingRequestTaskIds}
        cancellingRequestTaskIds={cancellingRequestTaskIds}
        requestTaskCancelConfirmId={requestTaskCancelConfirmId}
        onClose={() => setTaskManagerOpen(false)}
        onClearTerminal={clearTerminalRequestTasks}
        onConfirmCancel={handleConfirmCancelRequestTask}
        onCloseCancelConfirm={closeRequestTaskCancelConfirm}
        onOpenCancelConfirm={openRequestTaskCancelConfirm}
        onRetryRequestTask={handleRetryRequestTask}
      />
      <ScenarioManagerDialog
        open={scenarioManagerOpen}
        systemScenarios={CANVAS_SIZE_OPTIONS}
        customScenarios={professionalCustomScenarios}
        selectedType={scenarioManagerSelectedType}
        selectedId={scenarioManagerSelectedId}
        draft={scenarioManagerDraft}
        onClose={closeScenarioManager}
        onSelectSystem={handleScenarioManagerSelectSystem}
        onCreate={handleScenarioManagerCreate}
        onSelectCustom={handleScenarioManagerSelect}
        onDraftLabelChange={handleScenarioManagerDraftLabelChange}
        onDraftDimensionChange={handleScenarioManagerDraftDimensionChange}
        onDraftLayoutChange={handleScenarioManagerDraftLayoutChange}
        onDelete={handleScenarioManagerDelete}
        onSave={handleScenarioManagerSave}
        onUseSelectedSystemScenario={() => {
          const shouldCloseImmediately =
            !storyboardHasContent &&
            !storyboardHasLoadingCells &&
            normalizeTextValue(scenarioManagerSelectedId) &&
            scenarioManagerSelectedId !== professionalCanvasSize;

          handleProfessionalScenarioChange(scenarioManagerSelectedId);

          if (shouldCloseImmediately) {
            closeScenarioManager();
          }
        }}
      />
      <StoryboardEditorDialog
        open={storyboardEditorOpen}
        cell={storyboardEditorCell}
        professionalStyleReference={professionalStyleReference}
        isGenerateMode={isStoryboardEditorGenerateMode}
        isAssetMode={isStoryboardEditorAssetMode}
        generationLibrary={generationLibrary}
        libraryPickerOpen={storyboardLibraryPickerOpen}
        libraryPickerPending={storyboardLibraryPickerPending}
        requestTaskCancelConfirmId={requestTaskCancelConfirmId}
        cancellingRequestTaskIds={cancellingRequestTaskIds}
        generationModelId={generationModelId}
        professionalStoryboardImageSizeValue={professionalStoryboardImageSizeValue}
        professionalStoryboardAspectRatioValue={professionalStoryboardAspectRatioValue}
        previousCell={previousStoryboardEditorCell}
        nextCell={nextStoryboardEditorCell}
        totalCellCount={storyboardCellList.length}
        draftRef={storyboardEditorDraftRef}
        onClose={closeStoryboardEditor}
        onSetGenerateMode={() => setStoryboardEditorMode(STORYBOARD_EDITOR_MODE_GENERATE)}
        onSetAssetMode={() => setStoryboardEditorMode(STORYBOARD_EDITOR_MODE_ASSET)}
        onReferenceFileChange={handleStoryboardReferenceFileChange}
        onRemoveReferenceImage={handleRemoveStoryboardReferenceImage}
        onLocalImageFileChange={handleStoryboardLocalImageFileChange}
        onToggleLibraryPicker={handleToggleStoryboardLibraryPicker}
        onSelectLibraryRecord={handleSelectStoryboardLibraryRecord}
        onOpenCellClearConfirm={openStoryboardCellClearConfirm}
        onConfirmCancelRequestTask={handleConfirmCancelRequestTask}
        onCloseRequestTaskCancelConfirm={closeRequestTaskCancelConfirm}
        onOpenRequestTaskCancelConfirm={openRequestTaskCancelConfirm}
        onGenerateCell={handleStoryboardCellGenerate}
        onOpenPreview={openImagePreview}
        onNavigatePrevious={() => navigateStoryboardEditor("previous")}
        onNavigateNext={() => navigateStoryboardEditor("next")}
      />
      <StoryboardClearConfirmDialog
        open={storyboardClearConfirmOpen}
        onClose={closeStoryboardClearConfirm}
        onConfirm={handleClearStoryboard}
      />
      <PendingScenarioSwitchDialog
        scenario={pendingScenarioSwitch}
        onClose={closePendingScenarioSwitchDialog}
        onExportThenSwitch={handleSwitchScenarioWithExport}
        onDiscardThenSwitch={handleSwitchScenarioWithoutSaving}
      />
      <StoryboardCellClearConfirmDialog
        cell={storyboardCellClearConfirmCell}
        onClose={closeStoryboardCellClearConfirm}
        onConfirm={handleConfirmClearStoryboardCell}
      />
      <ResourceManagerDialog
        open={resourceManagerOpen}
        finderFilters={finderFilters}
        activeFinderFilter={activeFinderFilter}
        filteredGenerationLibrary={filteredGenerationLibrary}
        onClose={() => setResourceManagerOpen(false)}
        onSelectFilter={setResourceManagerFilter}
        onPreviewRecord={handlePreviewStoredRecord}
        onDeleteRecord={handleDeleteStoredRecord}
      />
      <ImagePreviewDialog
        open={imagePreviewOpen}
        previewRecord={previewRecord}
        imagePreviewTransform={imagePreviewTransform}
        imagePreviewDragging={imagePreviewDragging}
        imagePreviewBaseStyle={imagePreviewBaseStyle}
        imagePreviewViewportRef={imagePreviewViewportRef}
        minPreviewScale={MIN_PREVIEW_SCALE}
        onClose={closeImagePreview}
        onDeleteRecord={handleDeleteStoredRecord}
        onResetTransform={() =>
          setImagePreviewTransform({
            scale: MIN_PREVIEW_SCALE,
            x: 0,
            y: 0,
          })
        }
        onApplyPreviewScale={applyPreviewScale}
        onSetTransform={setImagePreviewTransform}
        onWheel={handleImagePreviewWheel}
        onPointerDown={handleImagePreviewPointerDown}
        onPointerMove={handleImagePreviewPointerMove}
        onPointerEnd={handleImagePreviewPointerEnd}
        onImageLoad={(event) => {
          setImagePreviewNaturalSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
        }}
      />
      {isProfessionalPanelMode ? backendBusyOverlay : null}
    </div>
  );
}

function RouteRedirect({ to }) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const targetUrl = `${to}${window.location.search || ""}${window.location.hash || ""}`;

    if (window.location.pathname === to) {
      return;
    }

    window.location.replace(targetUrl);
  }, [to]);

  return (
    <div className="page-shell">
      <main className="status-card">
        <p className="eyebrow">BANANA STUDIO</p>
        <h1>正在跳转</h1>
        <p>正在进入 Banana Studio...</p>
      </main>
    </div>
  );
}

export { BananaStudioApp, RouteRedirect };
