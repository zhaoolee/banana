import { canRetryRequestTask, isRequestTaskTerminal } from "../stores/taskStore.js";
import {
  ResourceCard,
  FinderSidebarItem,
  buildRequestTaskMeta,
  getRequestTaskStatusLabel,
  buildRequestTaskQueueSummary,
} from "../bananaStudioShared.jsx";

function TaskManagerDialog({
  open = false,
  activeRequestTaskCount = 0,
  sortedRequestTasks = [],
  clearableRequestTaskCount = 0,
  retryingRequestTaskIds = {},
  cancellingRequestTaskIds = {},
  requestTaskCancelConfirmId = "",
  onClose,
  onClearTerminal,
  onConfirmCancel,
  onCloseCancelConfirm,
  onOpenCancelConfirm,
  onRetryRequestTask,
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="task-manager-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="任务列表"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="task-manager-panel">
        <div className="scenario-manager-windowbar">
          <span className="finder-window-spacer" aria-hidden="true" />
          <strong>任务列表</strong>
          <button
            type="button"
            className="finder-close-button"
            onClick={() => onClose?.()}
            aria-label="关闭任务列表"
            title="关闭"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10" />
              <path d="M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="task-manager-body">
          <div className="finder-browser-toolbar task-manager-toolbar">
            <div className="finder-browser-title">
              <strong>当前与历史任务</strong>
              <span>这里会显示正在请求中的任务，以及断网后恢复过的任务状态。</span>
            </div>
            <div className="finder-browser-meta">
              <span>活跃 {activeRequestTaskCount}</span>
              <span>总计 {sortedRequestTasks.length}</span>
              <button
                type="button"
                className="ghost-button task-manager-clear-button"
                onClick={() => onClearTerminal?.()}
                disabled={clearableRequestTaskCount === 0}
              >
                清理历史
              </button>
            </div>
          </div>

          {sortedRequestTasks.length > 0 ? (
            <div className="task-manager-list">
              {sortedRequestTasks.map((task) => (
                <article key={task.requestId} className={`task-manager-item is-${task.status}`}>
                  <div className="task-manager-item-header">
                    <div className="task-manager-item-copy">
                      <strong>{buildRequestTaskMeta(task)}</strong>
                      <span>{task.message || "等待状态更新..."}</span>
                    </div>
                    <span className={`task-manager-status-badge is-${task.status}`}>
                      {getRequestTaskStatusLabel(task)}
                    </span>
                  </div>
                  {buildRequestTaskQueueSummary(task) ? (
                    <p className="task-manager-queue-note">{buildRequestTaskQueueSummary(task)}</p>
                  ) : null}
                  {task.error ? <p className="error-text task-manager-error">{task.error}</p> : null}
                  {canRetryRequestTask(task) || !isRequestTaskTerminal(task) ? (
                    <div className="task-manager-actions">
                      {!isRequestTaskTerminal(task) ? (
                        cancellingRequestTaskIds[task.requestId] ? (
                          <button
                            type="button"
                            className="ghost-button task-manager-retry-button"
                            disabled
                          >
                            取消中...
                          </button>
                        ) : requestTaskCancelConfirmId === task.requestId ? (
                          <>
                            <button
                              type="button"
                              className="primary-button storyboard-confirm-danger task-manager-retry-button"
                              onClick={() => onConfirmCancel?.()}
                            >
                              确认取消任务
                            </button>
                            <button
                              type="button"
                              className="ghost-button task-manager-retry-button"
                              onClick={() => onCloseCancelConfirm?.()}
                            >
                              放弃取消任务
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="ghost-button task-manager-retry-button"
                            onClick={() => onOpenCancelConfirm?.(task.requestId)}
                          >
                            取消任务
                          </button>
                        )
                      ) : null}
                      {canRetryRequestTask(task) ? (
                        <button
                          type="button"
                          className="ghost-button task-manager-retry-button"
                          onClick={() => onRetryRequestTask?.(task)}
                          disabled={Boolean(retryingRequestTaskIds[task.requestId])}
                        >
                          {retryingRequestTaskIds[task.requestId] ? "重试中..." : "重试"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state task-manager-empty-state">
              <p>还没有任务。</p>
              <small>发起一次生图或提升清晰度后，这里会实时显示任务状态。</small>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ResourceManagerDialog({
  open = false,
  finderFilters = [],
  activeFinderFilter = null,
  filteredGenerationLibrary = [],
  onClose,
  onSelectFilter,
  onPreviewRecord,
  onDeleteRecord,
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="resource-manager-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="资源管理器"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="resource-manager-panel">
        <div className="resource-manager-windowbar">
          <span className="finder-window-spacer" aria-hidden="true" />
          <strong>资源管理器</strong>
          <button
            type="button"
            className="finder-close-button"
            onClick={() => onClose?.()}
            aria-label="关闭资源管理器"
            title="关闭"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10" />
              <path d="M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="finder-layout">
          <aside className="finder-sidebar">
            <div className="finder-sidebar-group">
              <div className="finder-sidebar-list">
                {finderFilters.map((item) => (
                  <FinderSidebarItem
                    key={item.id}
                    item={item}
                    isActive={activeFinderFilter?.id === item.id}
                    onSelect={onSelectFilter}
                  />
                ))}
              </div>
            </div>
          </aside>

          <section className="finder-browser">
            <div className="finder-browser-toolbar">
              <div className="finder-browser-title">
                <strong>{activeFinderFilter?.label || "全部图片"}</strong>
                <span>{filteredGenerationLibrary.length} 个项目</span>
              </div>
              <div className="finder-browser-meta">
                <span>按保存时间排序</span>
                <span>
                  {new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(
                    new Date(),
                  )}
                </span>
              </div>
            </div>

            {filteredGenerationLibrary.length > 0 ? (
              <div className="finder-grid">
                {filteredGenerationLibrary.map((record) => (
                  <ResourceCard
                    key={record.id}
                    record={record}
                    onPreview={onPreviewRecord}
                    onDelete={onDeleteRecord}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state resource-empty-state">
                <p>当前分组里还没有图片。</p>
                <small>换一个边栏分组，或者先生成一张图。</small>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function ImagePreviewDialog({
  open = false,
  previewRecord = null,
  imagePreviewTransform,
  imagePreviewDragging = false,
  imagePreviewBaseStyle,
  imagePreviewViewportRef,
  minPreviewScale,
  onClose,
  onDeleteRecord,
  onResetTransform,
  onApplyPreviewScale,
  onSetTransform,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onImageLoad,
}) {
  if (!open || !previewRecord) {
    return null;
  }

  return (
    <div
      className="image-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="image-preview-topbar">
        <div className="image-preview-status">
          <strong>图片预览</strong>
          <span>{Math.round(imagePreviewTransform.scale * 100)}%</span>
        </div>
        <div className="image-preview-actions">
          <a
            className="image-preview-action"
            href={previewRecord.previewUrl}
            download={previewRecord.downloadName}
          >
            下载
          </a>
          <button
            type="button"
            className="image-preview-action"
            onClick={() => onResetTransform?.()}
          >
            还原
          </button>
          <button
            type="button"
            className="image-preview-action image-preview-delete"
            onClick={() => {
              if (previewRecord?.id) {
                void onDeleteRecord?.(previewRecord.id);
              }
            }}
          >
            删除
          </button>
          <button
            type="button"
            className="image-preview-action image-preview-close"
            onClick={() => onClose?.()}
          >
            退出
          </button>
        </div>
      </div>

      <div
        ref={imagePreviewViewportRef}
        className={`image-preview-stage${imagePreviewDragging ? " is-dragging" : ""}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        onDoubleClick={(event) => {
          const targetScale =
            imagePreviewTransform.scale > minPreviewScale ? minPreviewScale : 2;

          onApplyPreviewScale?.(targetScale, {
            x: event.clientX,
            y: event.clientY,
          });
        }}
      >
        <img
          className="image-preview-media"
          src={previewRecord.previewUrl}
          alt="Banana generated preview"
          draggable="false"
          decoding="async"
          onLoad={onImageLoad}
          style={{
            ...(imagePreviewBaseStyle || {}),
            transform: `translate(${imagePreviewTransform.x}px, ${imagePreviewTransform.y}px) scale(${imagePreviewTransform.scale})`,
          }}
        />
      </div>

      <div className="image-preview-zoombar">
        <button
          type="button"
          className="image-preview-action"
          onClick={() => onApplyPreviewScale?.(imagePreviewTransform.scale - 0.4)}
        >
          -
        </button>
        <button
          type="button"
          className="image-preview-action"
          onClick={() =>
            onSetTransform?.({
              scale: minPreviewScale,
              x: 0,
              y: 0,
            })
          }
        >
          {Math.round(imagePreviewTransform.scale * 100)}%
        </button>
        <button
          type="button"
          className="image-preview-action"
          onClick={() => onApplyPreviewScale?.(imagePreviewTransform.scale + 0.4)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export { ImagePreviewDialog, ResourceManagerDialog, TaskManagerDialog };
