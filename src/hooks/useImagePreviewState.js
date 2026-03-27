import { useEffect, useMemo, useRef, useState } from "react";

function useImagePreviewState({
  minPreviewScale,
  clampPreviewScale,
  getPointerDistance,
}) {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewRecord, setImagePreviewRecord] = useState(null);
  const [imagePreviewDragging, setImagePreviewDragging] = useState(false);
  const [imagePreviewViewportSize, setImagePreviewViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const [imagePreviewNaturalSize, setImagePreviewNaturalSize] = useState({
    width: 0,
    height: 0,
  });
  const [imagePreviewTransform, setImagePreviewTransform] = useState({
    scale: minPreviewScale,
    x: 0,
    y: 0,
  });
  const imagePreviewViewportRef = useRef(null);
  const imagePreviewPointersRef = useRef(new Map());
  const imagePreviewPanRef = useRef(null);
  const imagePreviewPinchRef = useRef(null);

  function clearImagePreviewInteraction() {
    imagePreviewPointersRef.current.clear();
    imagePreviewPanRef.current = null;
    imagePreviewPinchRef.current = null;
  }

  function resetImagePreviewTransform() {
    setImagePreviewTransform({
      scale: minPreviewScale,
      x: 0,
      y: 0,
    });
  }

  const imagePreviewBaseStyle = useMemo(() => {
    const { width: naturalWidth, height: naturalHeight } = imagePreviewNaturalSize;
    const { width: viewportWidth, height: viewportHeight } = imagePreviewViewportSize;

    if (!naturalWidth || !naturalHeight || !viewportWidth || !viewportHeight) {
      return null;
    }

    const devicePixelRatio =
      typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
        ? window.devicePixelRatio
        : 1;
    const stageWidth = Math.max(viewportWidth - 48, 0);
    const stageHeight = Math.max(viewportHeight - 176, 0);
    const containScale = Math.min(
      stageWidth / naturalWidth,
      stageHeight / naturalHeight,
      1 / Math.max(devicePixelRatio, 1),
    );
    const safeScale = Number.isFinite(containScale) && containScale > 0 ? containScale : 1;

    return {
      width: `${naturalWidth * safeScale}px`,
      height: `${naturalHeight * safeScale}px`,
    };
  }, [imagePreviewNaturalSize, imagePreviewViewportSize]);

  useEffect(() => {
    if (!imagePreviewOpen) {
      return;
    }

    resetImagePreviewTransform();
    setImagePreviewNaturalSize({
      width: 0,
      height: 0,
    });
    setImagePreviewDragging(false);
    clearImagePreviewInteraction();
  }, [imagePreviewOpen, imagePreviewRecord?.previewUrl]);

  function openImagePreview(record) {
    if (!record?.previewUrl) {
      return;
    }

    setImagePreviewRecord(record);
    resetImagePreviewTransform();
    setImagePreviewDragging(false);
    clearImagePreviewInteraction();
    setImagePreviewViewportSize({
      width: typeof window !== "undefined" ? window.innerWidth : 0,
      height: typeof window !== "undefined" ? window.innerHeight : 0,
    });
    setImagePreviewOpen(true);
  }

  function closeImagePreview() {
    setImagePreviewOpen(false);
    setImagePreviewRecord(null);
    setImagePreviewDragging(false);
    clearImagePreviewInteraction();
  }

  function getPreviewRelativePoint(clientPoint) {
    const viewport = imagePreviewViewportRef.current;

    if (!viewport) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();

    return {
      x: clientPoint.x - rect.left - rect.width / 2,
      y: clientPoint.y - rect.top - rect.height / 2,
    };
  }

  function getPreviewImagePoint(clientPoint, transform = imagePreviewTransform) {
    const relativePoint = getPreviewRelativePoint(clientPoint);

    if (!relativePoint) {
      return null;
    }

    return {
      x: (relativePoint.x - transform.x) / transform.scale,
      y: (relativePoint.y - transform.y) / transform.scale,
    };
  }

  function applyPreviewScale(nextScaleInput, anchorClientPoint = null) {
    setImagePreviewTransform((currentValue) => {
      const nextScale = clampPreviewScale(nextScaleInput);

      if (nextScale === currentValue.scale) {
        return currentValue;
      }

      if (!anchorClientPoint) {
        return {
          scale: nextScale,
          x: nextScale === minPreviewScale ? 0 : currentValue.x,
          y: nextScale === minPreviewScale ? 0 : currentValue.y,
        };
      }

      const anchorPoint = getPreviewRelativePoint(anchorClientPoint);

      if (!anchorPoint) {
        return {
          scale: nextScale,
          x: nextScale === minPreviewScale ? 0 : currentValue.x,
          y: nextScale === minPreviewScale ? 0 : currentValue.y,
        };
      }

      const scaleRatio = nextScale / currentValue.scale;
      const nextX = anchorPoint.x - (anchorPoint.x - currentValue.x) * scaleRatio;
      const nextY = anchorPoint.y - (anchorPoint.y - currentValue.y) * scaleRatio;

      return {
        scale: nextScale,
        x: nextScale === minPreviewScale ? 0 : nextX,
        y: nextScale === minPreviewScale ? 0 : nextY,
      };
    });
  }

  function zoomImagePreview(delta) {
    setImagePreviewTransform((currentValue) => {
      const nextScale = clampPreviewScale(currentValue.scale + delta);
      return {
        scale: nextScale,
        x: nextScale === minPreviewScale ? 0 : currentValue.x,
        y: nextScale === minPreviewScale ? 0 : currentValue.y,
      };
    });
  }

  function handleImagePreviewWheel(event) {
    const delta = event.deltaY < 0 ? 0.24 : -0.24;
    applyPreviewScale(imagePreviewTransform.scale + delta, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleImagePreviewPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    imagePreviewPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (imagePreviewPointersRef.current.size === 1) {
      imagePreviewPanRef.current = {
        startPointer: { x: event.clientX, y: event.clientY },
        origin: {
          x: imagePreviewTransform.x,
          y: imagePreviewTransform.y,
        },
      };
      return;
    }

    if (imagePreviewPointersRef.current.size === 2) {
      const [firstPointer, secondPointer] = Array.from(
        imagePreviewPointersRef.current.values(),
      );
      const midpoint = {
        x: (firstPointer.x + secondPointer.x) / 2,
        y: (firstPointer.y + secondPointer.y) / 2,
      };
      const anchorImagePoint = getPreviewImagePoint(midpoint);

      if (!anchorImagePoint) {
        return;
      }

      imagePreviewPinchRef.current = {
        startDistance: Math.max(getPointerDistance(firstPointer, secondPointer), 1),
        startScale: imagePreviewTransform.scale,
        anchorImagePoint,
      };
      imagePreviewPanRef.current = null;
    }
  }

  function handleImagePreviewPointerMove(event) {
    if (!imagePreviewPointersRef.current.has(event.pointerId)) {
      return;
    }

    imagePreviewPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (imagePreviewPointersRef.current.size >= 2 && imagePreviewPinchRef.current) {
      const [firstPointer, secondPointer] = Array.from(
        imagePreviewPointersRef.current.values(),
      );
      const midpoint = {
        x: (firstPointer.x + secondPointer.x) / 2,
        y: (firstPointer.y + secondPointer.y) / 2,
      };
      const midpointRelativePoint = getPreviewRelativePoint(midpoint);

      if (!midpointRelativePoint) {
        return;
      }

      const nextScale = clampPreviewScale(
        imagePreviewPinchRef.current.startScale *
          (getPointerDistance(firstPointer, secondPointer) /
            imagePreviewPinchRef.current.startDistance),
      );

      setImagePreviewTransform({
        scale: nextScale,
        x:
          nextScale === minPreviewScale
            ? 0
            : midpointRelativePoint.x -
              imagePreviewPinchRef.current.anchorImagePoint.x * nextScale,
        y:
          nextScale === minPreviewScale
            ? 0
            : midpointRelativePoint.y -
              imagePreviewPinchRef.current.anchorImagePoint.y * nextScale,
      });
      setImagePreviewDragging(true);
      return;
    }

    if (!imagePreviewPanRef.current || imagePreviewTransform.scale <= minPreviewScale) {
      return;
    }

    const currentPan = imagePreviewPanRef.current;

    if (!currentPan) {
      return;
    }

    setImagePreviewTransform((currentValue) => ({
      ...currentValue,
      x: currentPan.origin.x + (event.clientX - currentPan.startPointer.x),
      y: currentPan.origin.y + (event.clientY - currentPan.startPointer.y),
    }));
    setImagePreviewDragging(true);
  }

  function handleImagePreviewPointerEnd(event) {
    imagePreviewPointersRef.current.delete(event.pointerId);

    if (imagePreviewPointersRef.current.size < 2) {
      imagePreviewPinchRef.current = null;
    }

    if (imagePreviewPointersRef.current.size === 1) {
      const [remainingPointer] = Array.from(imagePreviewPointersRef.current.values());
      imagePreviewPanRef.current = {
        startPointer: remainingPointer,
        origin: {
          x: imagePreviewTransform.x,
          y: imagePreviewTransform.y,
        },
      };
    } else {
      imagePreviewPanRef.current = null;
    }

    if (imagePreviewPointersRef.current.size === 0) {
      setImagePreviewDragging(false);
    }
  }

  return {
    imagePreviewOpen,
    imagePreviewRecord,
    imagePreviewDragging,
    imagePreviewViewportSize,
    imagePreviewNaturalSize,
    imagePreviewTransform,
    imagePreviewBaseStyle,
    imagePreviewViewportRef,
    setImagePreviewOpen,
    setImagePreviewRecord,
    setImagePreviewDragging,
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
  };
}

export { useImagePreviewState };
