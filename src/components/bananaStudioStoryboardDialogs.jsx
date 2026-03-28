import { useEffect, useRef, useState } from "react";
import {
  LAYOUT_TRACK_OPTIONS,
  buildProfessionalSceneArchiveDownloadName,
  buildProfessionalSceneArchiveZipDownloadName,
  doesStoryboardCellHaveContent,
  formatPersistedAt,
  getReferenceImageOptimizationSummary,
  resizePromptTextarea,
} from "../bananaStudioShared.jsx";
import { useDevRenderMetric } from "../devMetrics.js";

function DialogOverlay({ className, ariaLabel, onClose, children }) {
  return (
    <div
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      {children}
    </div>
  );
}

function ProfessionalSceneExportDialog({
  dialog = null,
  pending = false,
  onClose,
  onFileNameChange,
  onConfirm,
}) {
  if (!dialog) {
    return null;
  }

  const resolvedFileName = dialog.fileName || dialog.defaultFileName;
  const nextDownloadName =
    dialog.kind === "zip"
      ? buildProfessionalSceneArchiveZipDownloadName(resolvedFileName)
      : buildProfessionalSceneArchiveDownloadName(resolvedFileName);

  return (
    <DialogOverlay
      className="storyboard-confirm-overlay"
      ariaLabel={dialog.kind === "zip" ? "下载图片素材包" : "导出 JSON 配置"}
      onClose={onClose}
    >
      <section className="storyboard-confirm-panel professional-scene-export-dialog">
        <strong>{dialog.kind === "zip" ? "下载图片素材包" : "导出 JSON 配置"}</strong>
        <p>
          {dialog.kind === "zip"
            ? "会把当前专业模式配置导出为一个 ZIP，里面包含一份去掉内嵌图片的 JSON 和 images 文件夹。后续如果要直接回导到 banana，请使用 JSON 导出。"
            : "确认这次导出的配置名。默认名已经带时间戳，你也可以直接改成更好记的名字。"}
        </p>
        <label className="image-option-field" htmlFor="professionalSceneExportFileName">
          <span className="field-label">配置名</span>
          <input
            id="professionalSceneExportFileName"
            name="professionalSceneExportFileName"
            type="text"
            autoFocus
            value={dialog.fileName}
            onChange={(event) => onFileNameChange?.(event.target.value)}
            placeholder={dialog.defaultFileName}
          />
        </label>
        <p className="professional-scene-export-dialog-note">
          将保存为 <strong>{nextDownloadName}</strong>
        </p>
        <div className="storyboard-confirm-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onClose?.()}
            disabled={pending}
          >
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => onConfirm?.()}
            disabled={pending}
          >
            {pending ? "处理中..." : dialog.kind === "zip" ? "下载图片素材包" : "下载 JSON"}
          </button>
        </div>
      </section>
    </DialogOverlay>
  );
}

function ScenarioManagerDialog({
  open = false,
  systemScenarios = [],
  customScenarios = [],
  selectedType = "new",
  selectedId = "",
  draft,
  onClose,
  onSelectSystem,
  onCreate,
  onSelectCustom,
  onDraftLabelChange,
  onDraftDimensionChange,
  onDraftLayoutChange,
  onDelete,
  onSave,
  onUseSelectedSystemScenario,
}) {
  if (!open || !draft) {
    return null;
  }

  return (
    <DialogOverlay
      className="scenario-manager-overlay"
      ariaLabel="常用场景管理"
      onClose={onClose}
    >
      <section className="scenario-manager-panel">
        <div className="scenario-manager-windowbar">
          <span className="finder-window-spacer" aria-hidden="true" />
          <strong>常用场景管理</strong>
          <button
            type="button"
            className="finder-close-button"
            onClick={() => onClose?.()}
            aria-label="关闭常用场景管理"
            title="关闭"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10" />
              <path d="M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="scenario-manager-layout">
          <aside className="scenario-manager-sidebar">
            <div className="scenario-manager-section">
              <div className="section-title-inline">
                <strong>系统场景</strong>
                <span>内置预设可直接使用，不支持删除。</span>
              </div>
              <div className="scenario-manager-list">
                {systemScenarios.map((scenario) => (
                  <button
                    key={scenario.value}
                    type="button"
                    className={`scenario-manager-item scenario-manager-item-button${selectedType === "system" && selectedId === scenario.value ? " is-active" : ""}`}
                    onClick={() => onSelectSystem?.(scenario.value)}
                  >
                    <span className="scenario-manager-item-copy">
                      <strong>{scenario.label}</strong>
                      <span>
                        {scenario.layoutRows} 行 × {scenario.layoutColumns} 列
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="scenario-manager-section">
              <div className="scenario-manager-section-header">
                <div className="section-title-inline">
                  <strong>自定义场景</strong>
                  <span>支持新增、修改、删除，保存后会出现在下拉里。</span>
                </div>
                <button
                  type="button"
                  className="ghost-button scenario-manager-add-button"
                  onClick={() => onCreate?.()}
                >
                  新建
                </button>
              </div>

              {customScenarios.length > 0 ? (
                <div className="scenario-manager-list">
                  {customScenarios.map((scenario) => (
                    <button
                      key={scenario.value}
                      type="button"
                      className={`scenario-manager-item scenario-manager-item-button${selectedId === scenario.value ? " is-active" : ""}`}
                      onClick={() => onSelectCustom?.(scenario.value)}
                    >
                      <span className="scenario-manager-item-copy">
                        <strong>{scenario.label}</strong>
                        <span>
                          {scenario.width} × {scenario.height} · {scenario.layoutRows} 行 × {scenario.layoutColumns} 列
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state scenario-manager-empty-state">
                  <p>还没有自定义场景。</p>
                  <small>点右上角“新建”即可创建一个可复用场景。</small>
                </div>
              )}
            </div>
          </aside>

          <section className="scenario-manager-editor">
            <div className="section-title-inline">
              <strong>
                {selectedType === "system"
                  ? "查看系统场景"
                  : selectedId
                    ? "编辑自定义场景"
                    : "新建自定义场景"}
              </strong>
              <span>
                {selectedType === "system"
                  ? "系统场景仅支持查看和使用，不支持修改或删除。"
                  : "场景会同时保存画板尺寸、行、列设置。"}
              </span>
            </div>

            {selectedType === "system" ? (
              <>
                <div className="scenario-manager-preview">
                  <strong>{draft.label}</strong>
                  <span>
                    {draft.width} × {draft.height} · {draft.layoutRows} 行 × {draft.layoutColumns} 列
                  </span>
                </div>

                <div className="scenario-manager-actions">
                  <button type="button" className="ghost-button" onClick={() => onClose?.()}>
                    关闭
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onUseSelectedSystemScenario?.()}
                  >
                    使用这个场景
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="image-option-field" htmlFor="scenarioManagerLabel">
                  <span className="field-label">场景名称</span>
                  <input
                    id="scenarioManagerLabel"
                    name="scenarioManagerLabel"
                    type="text"
                    value={draft.label}
                    onChange={(event) => onDraftLabelChange?.(event.target.value)}
                    placeholder="例如：四宫格故事封面"
                  />
                </label>

                <div className="scenario-manager-form-grid">
                  <label className="image-option-field" htmlFor="scenarioManagerWidth">
                    <span className="field-label">宽度 px</span>
                    <input
                      id="scenarioManagerWidth"
                      name="scenarioManagerWidth"
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={draft.width}
                      onChange={(event) => onDraftDimensionChange?.("width", event.target.value)}
                    />
                  </label>

                  <label className="image-option-field" htmlFor="scenarioManagerHeight">
                    <span className="field-label">高度 px</span>
                    <input
                      id="scenarioManagerHeight"
                      name="scenarioManagerHeight"
                      type="number"
                      step="1"
                      inputMode="numeric"
                      value={draft.height}
                      onChange={(event) => onDraftDimensionChange?.("height", event.target.value)}
                    />
                  </label>

                  <label className="image-option-field" htmlFor="scenarioManagerRows">
                    <span className="field-label">行</span>
                    <select
                      id="scenarioManagerRows"
                      name="scenarioManagerRows"
                      className="model-selector compact-selector"
                      value={draft.layoutRows}
                      onChange={(event) => onDraftLayoutChange?.("layoutRows", event.target.value)}
                    >
                      {LAYOUT_TRACK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="image-option-field" htmlFor="scenarioManagerColumns">
                    <span className="field-label">列</span>
                    <select
                      id="scenarioManagerColumns"
                      name="scenarioManagerColumns"
                      className="model-selector compact-selector"
                      value={draft.layoutColumns}
                      onChange={(event) =>
                        onDraftLayoutChange?.("layoutColumns", event.target.value)
                      }
                    >
                      {LAYOUT_TRACK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="scenario-manager-preview">
                  <strong>预览</strong>
                  <span>
                    {draft.width} × {draft.height} · {draft.layoutRows} 行 × {draft.layoutColumns} 列
                  </span>
                </div>

                <div className="scenario-manager-actions">
                  {selectedId ? (
                    <button
                      type="button"
                      className="ghost-button scenario-manager-delete-button"
                      onClick={() => onDelete?.(selectedId)}
                    >
                      删除
                    </button>
                  ) : null}
                  <button type="button" className="ghost-button" onClick={() => onClose?.()}>
                    关闭
                  </button>
                  <button type="button" className="primary-button" onClick={() => onSave?.()}>
                    {selectedId ? "保存修改" : "保存场景"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </DialogOverlay>
  );
}

function StoryboardEditorDialog({
  open = false,
  cell = null,
  professionalStyleReference = null,
  isGenerateMode = false,
  isAssetMode = false,
  generationLibrary = [],
  libraryPickerOpen = false,
  libraryPickerPending = false,
  requestTaskCancelConfirmId = "",
  cancellingRequestTaskIds = {},
  generationModelId = "",
  professionalStoryboardImageSizeValue = "",
  professionalStoryboardAspectRatioValue = "",
  previousCell = null,
  nextCell = null,
  totalCellCount = 0,
  draftRef,
  onClose,
  onSetGenerateMode,
  onSetAssetMode,
  onReferenceFileChange,
  onRemoveReferenceImage,
  onLocalImageFileChange,
  onToggleLibraryPicker,
  onSelectLibraryRecord,
  onOpenCellClearConfirm,
  onConfirmCancelRequestTask,
  onCloseRequestTaskCancelConfirm,
  onOpenRequestTaskCancelConfirm,
  onGenerateCell,
  onOpenPreview,
  onNavigatePrevious,
  onNavigateNext,
}) {
  useDevRenderMetric("StoryboardEditorDialog", cell?.id || "closed");
  const [draftPrompt, setDraftPrompt] = useState(cell?.prompt || "");
  const [draftCaption, setDraftCaption] = useState(cell?.caption || "");
  const captionTextareaRef = useRef(null);
  const draftPromptRef = useRef(cell?.prompt || "");
  const draftCaptionRef = useRef(cell?.caption || "");

  useEffect(() => {
    if (!cell) {
      return;
    }

    setDraftPrompt(cell.prompt || "");
    setDraftCaption(cell.caption || "");
    draftPromptRef.current = cell.prompt || "";
    draftCaptionRef.current = cell.caption || "";
    if (draftRef) {
      draftRef.current = {
        cellId: cell.id,
        prompt: cell.prompt || "",
        caption: cell.caption || "",
      };
    }
  }, [cell?.id, cell?.prompt, cell?.caption]);

  useEffect(() => {
    if (!cell) {
      return;
    }

    resizePromptTextarea(captionTextareaRef.current);
  }, [cell, draftCaption]);

  if (!open || !cell) {
    return null;
  }

  const promptValue = draftPrompt;
  const captionValue = draftCaption;
  const draftCell = {
    ...cell,
    prompt: promptValue,
    caption: captionValue,
  };

  return (
    <div
      className="storyboard-editor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${cell.label} 输入面板`}
    >
      <section className="storyboard-editor-panel">
        <div className="storyboard-editor-windowbar">
          <span className="storyboard-editor-windowbar-spacer" aria-hidden="true" />
          <strong>
            {cell.label} · 行 {cell.row} / 列 {cell.column}
          </strong>
          <button
            type="button"
            className="finder-close-button"
            onClick={() => onClose?.()}
            aria-label="关闭输入面板"
            title="关闭"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10" />
              <path d="M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="storyboard-editor-mode-row">
          <div className="storyboard-editor-mode-switcher" role="tablist" aria-label="当前格子编辑模式">
            <button
              type="button"
              role="tab"
              aria-selected={isGenerateMode}
              className={`storyboard-editor-mode-button${isGenerateMode ? " is-active" : ""}`}
              onClick={() => onSetGenerateMode?.()}
            >
              传统生图
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isAssetMode}
              className={`storyboard-editor-mode-button${isAssetMode ? " is-active" : ""}`}
              onClick={() => onSetAssetMode?.()}
            >
              选择图片
            </button>
          </div>
        </div>

        <div className="storyboard-editor-layout has-preview">
          <div className="storyboard-editor-form">
            <p className="storyboard-editor-mode-note">
              当前模式只会修改这个格子，不会影响其它格子。
            </p>

            {isGenerateMode ? (
              <>
                <label className="field-label" htmlFor="storyboardCellPrompt">
                  当前格子提示词
                </label>
                <textarea
                  className="storyboard-editor-prompt-textarea"
                  id="storyboardCellPrompt"
                  name="storyboardCellPrompt"
                  rows={6}
                  value={promptValue}
                  onChange={(event) => {
                    draftPromptRef.current = event.target.value;
                    if (draftRef) {
                      draftRef.current = {
                        cellId: cell.id,
                        prompt: event.target.value,
                        caption: draftCaptionRef.current,
                      };
                    }
                    setDraftPrompt(event.target.value);
                  }}
                  placeholder="描述这个格子的主体、镜头、动作、光线、材质和氛围"
                />
                <div className="storyboard-reference-panel">
                  <div className="storyboard-reference-panel-header">
                    <div className="section-title-inline">
                      <strong>当前格子的参考图</strong>
                      <span>只影响这个格子，生成时会继续叠加整体画风参考图。弹窗打开时支持 Ctrl/Command + V 粘贴剪贴板图片。</span>
                    </div>
                    {professionalStyleReference ? (
                      <span className="storyboard-reference-parent-hint">已继承整体画风参考图</span>
                    ) : null}
                  </div>

                    {cell.referenceImages?.[0] ? (
                    <div className="professional-style-reference-card storyboard-reference-card">
                      <div className="professional-style-reference-media storyboard-reference-media">
                        <img
                          src={cell.referenceImages[0].previewUrl}
                          alt={cell.referenceImages[0].name}
                          draggable="false"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="professional-style-reference-copy">
                        <strong title={cell.referenceImages[0].name}>{cell.referenceImages[0].name}</strong>
                        <span>这张图会作为当前格子的额外参考，不会影响其它格子。</span>
                        {getReferenceImageOptimizationSummary(cell.referenceImages[0]) ? (
                          <span>{getReferenceImageOptimizationSummary(cell.referenceImages[0])}</span>
                        ) : null}
                      </div>
                      <div className="professional-style-reference-actions">
                        <label
                          className="ghost-button professional-style-reference-action"
                          aria-label="更换当前格子的参考图"
                          title="上传新图"
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M10 13V4.5" />
                            <path d="m6.8 7.7 3.2-3.2 3.2 3.2" />
                            <path d="M4.5 14.5v.6c0 .8.6 1.4 1.4 1.4h8.2c.8 0 1.4-.6 1.4-1.4v-.6" />
                          </svg>
                          <input type="file" accept="image/*" onChange={onReferenceFileChange} />
                        </label>
                        <button
                          type="button"
                          className="ghost-button professional-style-reference-action professional-style-reference-action-danger"
                          onClick={() => onRemoveReferenceImage?.(cell.referenceImages[0].id)}
                          aria-label="移除当前格子的参考图"
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
                    <label className="upload-box professional-style-upload storyboard-reference-upload">
                      <input type="file" accept="image/*" onChange={onReferenceFileChange} />
                      <span>上传当前格子的参考图</span>
                      <small>支持 1 张图片，只作用于这个格子。超大图片会自动压缩后上传。</small>
                    </label>
                  )}
                </div>
              </>
            ) : (
              <div className="storyboard-editor-asset-panel">
                <div className="section-title-inline">
                  <strong>当前格子图片</strong>
                  <span>可从本地上传，或从资源管理器选择一张图片放进当前格子。弹窗打开时也支持 Ctrl/Command + V 粘贴剪贴板图片。</span>
                </div>

                {cell.record ? (
                  <div className="storyboard-editor-selected-asset-card">
                    <span className="storyboard-editor-selected-asset-media">
                      <img
                        src={cell.record.previewUrl}
                        alt={cell.record.downloadName || `${cell.label} 当前图片`}
                        draggable="false"
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className="storyboard-editor-selected-asset-copy">
                      <strong title={cell.record.downloadName || `${cell.label} 当前图片`}>
                        {cell.record.downloadName || `${cell.label} 当前图片`}
                      </strong>
                      <span>
                        {cell.record.imageSize === "本地导入"
                          ? cell.statusText || "已导入当前格子的本地图片"
                          : cell.statusText === "已复用资源管理器中的图片，仅作用于当前格子"
                            ? cell.statusText
                            : "当前格子正在使用这张图片。"}
                      </span>
                    </span>
                  </div>
                ) : null}

                <label className="upload-box storyboard-editor-asset-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onLocalImageFileChange}
                    disabled={cell.status === "loading"}
                  />
                  <span>上传本地图片到当前格子</span>
                  <small>只替换这个格子的图片，不会影响其它格子。</small>
                </label>

                <button
                  type="button"
                  className={`ghost-button storyboard-editor-library-button${libraryPickerPending ? " is-pending" : ""}`}
                  onClick={() => onToggleLibraryPicker?.()}
                  disabled={cell.status === "loading" || libraryPickerPending}
                >
                  {libraryPickerPending ? (
                    <>
                      <span className="storyboard-editor-library-spinner" aria-hidden="true" />
                      历史图片加载中...
                    </>
                  ) : libraryPickerOpen ? (
                    "收起资源管理器图片"
                  ) : (
                    "从资源管理器选择图片"
                  )}
                </button>

                {libraryPickerOpen ? (
                  generationLibrary.length > 0 ? (
                    <div className="storyboard-library-picker" role="list" aria-label="资源管理器图片列表">
                      {generationLibrary.map((record) => {
                        const isSelected = cell.record?.id === record.id;
                        const fileTitle = record.downloadName || `banana-${record.id}.png`;

                        return (
                          <button
                            key={record.id}
                            type="button"
                            role="listitem"
                            className={`storyboard-library-item${isSelected ? " is-selected" : ""}`}
                            onClick={() => onSelectLibraryRecord?.(record)}
                          >
                            <span className="storyboard-library-item-media">
                              <img
                                src={record.previewUrl}
                                alt={fileTitle}
                                draggable="false"
                                loading="lazy"
                                decoding="async"
                              />
                            </span>
                            <span className="storyboard-library-item-copy">
                              <strong title={fileTitle}>{fileTitle}</strong>
                              <span>
                                {record.imageSize || "已保存"}
                                {record.aspectRatio ? ` · ${record.aspectRatio}` : ""}
                              </span>
                              <small>{formatPersistedAt(record.persistedAt)}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state storyboard-library-empty-state">
                      <p>资源管理器里还没有图片。</p>
                      <small>先生成一张图，之后就可以在这里复用。</small>
                    </div>
                  )
                ) : null}
              </div>
            )}
            <div className="storyboard-caption-field">
              <div className="storyboard-caption-field-header">
                <label className="field-label" htmlFor="storyboardCellCaption">
                  配文
                </label>
                <span className="storyboard-caption-field-hint">支持回车换行，导出会保留排版</span>
              </div>
              <textarea
                ref={captionTextareaRef}
                id="storyboardCellCaption"
                name="storyboardCellCaption"
                className="storyboard-caption-textarea"
                rows={2}
                value={captionValue}
                onChange={(event) => {
                  draftCaptionRef.current = event.target.value;
                  if (draftRef) {
                    draftRef.current = {
                      cellId: cell.id,
                      prompt: draftPromptRef.current,
                      caption: event.target.value,
                    };
                  }
                  setDraftCaption(event.target.value);
                }}
                placeholder={"输入要显示在格子底部的文案\n例如：原神启动"}
              />
            </div>
            {cell.statusText ? <p className="storyboard-editor-status">{cell.statusText}</p> : null}
            {cell.error ? <p className="error-text">{cell.error}</p> : null}
            <div className="storyboard-editor-actions">
              <button
                type="button"
                className="ghost-button storyboard-clear-button"
                onClick={() => onOpenCellClearConfirm?.(cell.id)}
                disabled={cell.status === "loading" || !doesStoryboardCellHaveContent(draftCell)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5.5 6.5 6.2 16h7.6l.7-9.5" />
                  <path d="M4 6h12" />
                  <path d="M7.5 6V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V6" />
                  <path d="M8 9v4.5" />
                  <path d="M12 9v4.5" />
                </svg>
                <span>清空当前格子</span>
              </button>
              {isGenerateMode && cell.status === "loading" ? (
                cell.pendingRequestId &&
                requestTaskCancelConfirmId === cell.pendingRequestId &&
                !cancellingRequestTaskIds[cell.pendingRequestId] ? (
                  <div className="inline-confirm-actions">
                    <button
                      type="button"
                      className="primary-button storyboard-confirm-danger"
                      onClick={() => onConfirmCancelRequestTask?.()}
                    >
                      确认取消任务
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onCloseRequestTaskCancelConfirm?.()}
                    >
                      放弃取消任务
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ghost-button storyboard-clear-button"
                    onClick={() => onOpenRequestTaskCancelConfirm?.(cell.pendingRequestId)}
                    disabled={
                      !cell.pendingRequestId || Boolean(cancellingRequestTaskIds[cell.pendingRequestId])
                    }
                  >
                    <span>
                      {cell.pendingRequestId && cancellingRequestTaskIds[cell.pendingRequestId]
                        ? "取消中..."
                        : "取消当前任务"}
                    </span>
                  </button>
                )
              ) : null}
              {isGenerateMode ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    onGenerateCell?.({
                      prompt: draftPromptRef.current,
                      caption: draftCaptionRef.current,
                    });
                  }}
                  disabled={cell.status === "loading" || !generationModelId}
                >
                  {cell.status === "loading"
                    ? "banana 正在生图..."
                    : cell.record
                      ? "重新生成图片"
                      : "生成图片"}
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={`storyboard-editor-preview-card${cell.status === "loading" && cell.record ? " is-refreshing" : ""}`}
          >
            {cell.record ? (
              <button
                type="button"
                className="storyboard-editor-preview-button"
                onClick={() => onOpenPreview?.(cell.record)}
                aria-label="查看这个格子的图片"
              >
                <img
                  src={cell.record.previewUrl}
                  alt={`${cell.label} 生成结果`}
                  draggable="false"
                  decoding="async"
                />
              </button>
            ) : (
              <div className="storyboard-editor-preview-empty">
                <strong>当前还没有图片</strong>
                <span>
                  {isAssetMode
                    ? "可以从本地上传，或从资源管理器里挑一张图片放进当前格子。"
                    : "填写提示词后直接生成，也可以补一张当前格子的参考图。"}
                </span>
              </div>
            )}
            <div className="storyboard-editor-preview-meta">
              <strong>
                {cell.record ? (isAssetMode ? "当前图片" : "已生成图片") : "图片预览区"}
              </strong>
              <span>
                {cell.record
                  ? `${cell.record.imageSize || professionalStoryboardImageSizeValue}${
                      cell.record.aspectRatio
                        ? ` · ${cell.record.aspectRatio}`
                        : ` · ${professionalStoryboardAspectRatioValue}`
                    }`
                  : `目标生成规格 · ${professionalStoryboardImageSizeValue} · ${professionalStoryboardAspectRatioValue}`}
              </span>
            </div>
          </div>
        </div>
        <div className="storyboard-editor-footer">
          <div className="storyboard-editor-pager" aria-label="切换分镜格子">
            <button
              type="button"
              className="ghost-button storyboard-editor-nav-button"
              onClick={() => onNavigatePrevious?.()}
              disabled={!previousCell}
            >
              上一格
            </button>
            <span className="storyboard-editor-pager-status">
              第 {cell.index} 格 / 共 {totalCellCount} 格
            </span>
            <button
              type="button"
              className="ghost-button storyboard-editor-nav-button"
              onClick={() => onNavigateNext?.()}
              disabled={!nextCell}
            >
              下一格
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SimpleConfirmationDialog({
  open = false,
  ariaLabel,
  title,
  description,
  onClose,
  actions,
}) {
  if (!open) {
    return null;
  }

  return (
    <DialogOverlay
      className="storyboard-confirm-overlay"
      ariaLabel={ariaLabel}
      onClose={onClose}
    >
      <section className="storyboard-confirm-panel">
        <strong>{title}</strong>
        <p>{description}</p>
        <div className="storyboard-confirm-actions">{actions}</div>
      </section>
    </DialogOverlay>
  );
}

function PendingScenarioSwitchDialog({
  scenario = null,
  onClose,
  onExportThenSwitch,
  onDiscardThenSwitch,
}) {
  if (!scenario) {
    return null;
  }

  return (
    <DialogOverlay
      className="storyboard-confirm-overlay"
      ariaLabel={`切换到 ${scenario.label}`}
      onClose={onClose}
    >
      <section className="storyboard-confirm-panel">
        <strong>切换到 {scenario.label} 前先处理当前内容</strong>
        <p>
          当前分镜表格里还有已填写内容或已生成图片。你可以先导出一份场景 JSON
          再切换，或者放弃这次修改直接切换。
        </p>
        <div className="storyboard-confirm-actions storyboard-confirm-actions-split">
          <button type="button" className="ghost-button" onClick={() => onClose?.()}>
            取消
          </button>
          <button type="button" className="ghost-button" onClick={() => onExportThenSwitch?.()}>
            导出场景后切换
          </button>
          <button
            type="button"
            className="primary-button storyboard-confirm-danger"
            onClick={() => onDiscardThenSwitch?.()}
          >
            放弃修改直接切换
          </button>
        </div>
      </section>
    </DialogOverlay>
  );
}

function StoryboardCellClearConfirmDialog({
  cell = null,
  onClose,
  onConfirm,
}) {
  return (
    <SimpleConfirmationDialog
      open={Boolean(cell)}
      ariaLabel={cell ? `确认清空${cell.label}` : "确认清空当前格子"}
      title={cell ? `确认清空 ${cell.label}？` : "确认清空当前格子？"}
      description="这个操作会清掉当前格子的提示词、配文、参考图和已生成图片，刷新后也无法恢复。"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ghost-button" onClick={() => onClose?.()}>
            取消
          </button>
          <button
            type="button"
            className="primary-button storyboard-confirm-danger"
            onClick={() => onConfirm?.()}
          >
            确认清空
          </button>
        </>
      }
    />
  );
}

function StoryboardClearConfirmDialog({ open = false, onClose, onConfirm }) {
  return (
    <SimpleConfirmationDialog
      open={open}
      ariaLabel="确认清空分镜表格"
      title="确认清空表格？"
      description="这个操作会清掉当前表格里的提示词和已生成图片，刷新后也无法恢复。"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ghost-button" onClick={() => onClose?.()}>
            取消
          </button>
          <button
            type="button"
            className="primary-button storyboard-confirm-danger"
            onClick={() => onConfirm?.()}
          >
            确认清空
          </button>
        </>
      }
    />
  );
}

export {
  PendingScenarioSwitchDialog,
  ProfessionalSceneExportDialog,
  ScenarioManagerDialog,
  StoryboardCellClearConfirmDialog,
  StoryboardClearConfirmDialog,
  StoryboardEditorDialog,
};
