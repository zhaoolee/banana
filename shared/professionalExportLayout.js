function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getProfessionalExportLayoutMetrics({
  canvasWidth,
  canvasHeight,
  rows,
  columns,
}) {
  const gridGap = 1;
  const shellPadding = 1;
  const safeCanvasWidth = Math.max(Number(canvasWidth) || 1, 1);
  const safeCanvasHeight = Math.max(Number(canvasHeight) || 1, 1);
  const safeRows = Math.max(Number(rows) || 1, 1);
  const safeColumns = Math.max(Number(columns) || 1, 1);
  const cellWidth = Math.max(
    (safeCanvasWidth - shellPadding * 2 - Math.max(safeColumns - 1, 0) * gridGap) /
      safeColumns,
    1,
  );
  const cellHeight = Math.max(
    (safeCanvasHeight - shellPadding * 2 - Math.max(safeRows - 1, 0) * gridGap) /
      safeRows,
    1,
  );
  const cellMinSize = Math.min(cellWidth, cellHeight);
  const placeholderPadding = Math.round(clamp(cellMinSize * 0.06, 16, 28));
  const placeholderFontSize = Math.round(clamp(cellMinSize * 0.09, 24, 40));
  const captionInset = Math.round(clamp(cellMinSize * 0.022, 6, 14));
  const captionPaddingY = Math.round(clamp(cellMinSize * 0.016, 5, 12));
  const captionPaddingX = Math.round(clamp(cellMinSize * 0.026, 7, 16));
  const captionFontSize = Math.round(clamp(cellMinSize * 0.075, 18, 30));
  const captionRadius = Math.round(Math.max(captionFontSize * 0.42, 10));

  return {
    gridGap,
    shellPadding,
    cellWidth,
    cellHeight,
    placeholderPadding,
    placeholderFontSize,
    captionInset,
    captionPaddingY,
    captionPaddingX,
    captionFontSize,
    captionRadius,
  };
}
