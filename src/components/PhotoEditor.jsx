import { useCallback, useEffect, useRef, useState } from 'react';
import {
  drawPortrait,
  TEMPLATE_WIDTH,
  TEMPLATE_HEIGHT,
} from '../services/portraitGenerator.js';
import { clamp } from '../utils/imageUtils.js';
import { t } from '../data/translations.js';

const MIN_SCALE = 0.6;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.15;

export const DEFAULT_TRANSFORM = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

function distance(a, b) {
  return Math.hypot(
    a.clientX - b.clientX,
    a.clientY - b.clientY
  );
}

export default function PhotoEditor({
  img,
  transform,
  onTransformChange,
  name,
  districtState,
  lang,
  onRetake,
  displayWidth = 340,
}) {
  const canvasRef = useRef(null);

  // Current transform used for smooth preview rendering.
  const transformRef = useRef(transform);

  // Drag / pinch state.
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  // requestAnimationFrame handle.
  const rafRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);

  const displayHeight = Math.round(
    (displayWidth * TEMPLATE_HEIGHT) / TEMPLATE_WIDTH
  );

  const toTemplateScale = TEMPLATE_WIDTH / displayWidth;

  /*
   * Keep ref synchronized with React state.
   * React state is still the source of truth outside gestures.
   */
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  /*
   * Draw the portrait using the supplied transform.
   */
  const drawWithTransform = useCallback(
    (nextTransform) => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      drawPortrait(ctx, {
        width: canvas.width,
        height: canvas.height,
        img,
        transform: nextTransform,
        name,
        districtState,
        lang,
      });
    },
    [img, name, districtState, lang]
  );

  /*
   * Schedule only one canvas redraw per animation frame.
   */
  const scheduleDraw = useCallback(
    (nextTransform) => {
      transformRef.current = nextTransform;

      if (rafRef.current !== null) {
        return;
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        drawWithTransform(transformRef.current);
      });
    },
    [drawWithTransform]
  );

  /*
   * Cancel pending animation frame on unmount.
   */
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /*
   * Initial / external redraw.
   */
  useEffect(() => {
    transformRef.current = transform;
    drawWithTransform(transform);
  }, [transform, drawWithTransform]);

  /*
   * Keep transform values inside safe limits.
   */
  const normalizeTransform = useCallback((next) => {
    return {
      ...next,
      scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
      x: clamp(
        next.x,
        -TEMPLATE_WIDTH * 0.5,
        TEMPLATE_WIDTH * 0.5
      ),
      y: clamp(
        next.y,
        -TEMPLATE_HEIGHT * 0.5,
        TEMPLATE_HEIGHT * 0.5
      ),
    };
  }, []);

  /*
   * Commit a transform to React state.
   * Used for buttons, slider and when a gesture finishes.
   */
  const commitTransform = useCallback(
    (next) => {
      const normalized = normalizeTransform(next);

      transformRef.current = normalized;

      onTransformChange(() => normalized);
    },
    [normalizeTransform, onTransformChange]
  );

  /*
   * Update only the local preview during dragging.
   */
  const previewTransform = useCallback(
    (partial) => {
      const next = normalizeTransform({
        ...transformRef.current,
        ...partial,
      });

      scheduleDraw(next);
    },
    [normalizeTransform, scheduleDraw]
  );

  /*
   * Finish gesture and send final transform to React.
   */
  const finishGesture = useCallback(() => {
    const finalTransform = transformRef.current;

    if (gestureRef.current) {
      gestureRef.current = null;
    }

    pointersRef.current.clear();

    setIsDragging(false);

    commitTransform(finalTransform);
  }, [commitTransform]);

  /*
   * -------------------------
   * Pointer events
   * -------------------------
   *
   * Pointer events work for:
   * - mouse
   * - trackpad
   * - touchscreen
   *
   * This means we don't need separate touch handlers.
   */

  const handlePointerDown = (e) => {
    if (!img) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);

    pointersRef.current.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const pointers = Array.from(pointersRef.current.values());

    /*
     * Two pointers = pinch zoom.
     */
    if (pointers.length === 2) {
      const startDistance = distance(
        pointers[0],
        pointers[1]
      );

      gestureRef.current = {
        type: 'pinch',
        startDistance,
        startScale: transformRef.current.scale,
      };

      setIsDragging(true);
      return;
    }

    /*
     * One pointer = drag.
     */
    gestureRef.current = {
      type: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    };

    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!img) return;

    if (!pointersRef.current.has(e.pointerId)) {
      return;
    }

    pointersRef.current.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const gesture = gestureRef.current;

    if (!gesture) return;

    /*
     * Pinch zoom.
     */
    if (gesture.type === 'pinch') {
      const pointers = Array.from(
        pointersRef.current.values()
      );

      if (pointers.length < 2) return;

      const currentDistance = distance(
        pointers[0],
        pointers[1]
      );

      if (!gesture.startDistance) return;

      const ratio =
        currentDistance / gesture.startDistance;

      previewTransform({
        scale: gesture.startScale * ratio,
      });

      e.preventDefault();
      return;
    }

    /*
     * Single pointer drag.
     */
    if (gesture.type === 'drag') {
      const dx =
        (e.clientX - gesture.startX) *
        toTemplateScale;

      const dy =
        (e.clientY - gesture.startY) *
        toTemplateScale;

      previewTransform({
        x: gesture.originX + dx,
        y: gesture.originY + dy,
      });

      e.preventDefault();
    }
  };

  const handlePointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);

    /*
     * If one finger remains after a pinch,
     * switch back to drag from the current position.
     */
    const remaining = Array.from(
      pointersRef.current.values()
    );

    if (remaining.length === 1) {
      const pointer = remaining[0];

      gestureRef.current = {
        type: 'drag',
        startX: pointer.clientX,
        startY: pointer.clientY,
        originX: transformRef.current.x,
        originY: transformRef.current.y,
      };

      return;
    }

    /*
     * No pointers remaining.
     */
    if (remaining.length === 0) {
      finishGesture();
    }
  };

  const handlePointerCancel = () => {
    finishGesture();
  };

  /*
   * -------------------------
   * Mouse / trackpad wheel
   * -------------------------
   */

  const handleWheel = (e) => {
    if (!img) return;

    e.preventDefault();

    const delta =
      e.deltaY > 0
        ? -ZOOM_STEP / 3
        : ZOOM_STEP / 3;

    commitTransform({
      ...transformRef.current,
      scale:
        transformRef.current.scale + delta,
    });
  };

  /*
   * -------------------------
   * Buttons
   * -------------------------
   */

  const zoomOut = () => {
    commitTransform({
      ...transformRef.current,
      scale:
        transformRef.current.scale - ZOOM_STEP,
    });
  };

  const zoomIn = () => {
    commitTransform({
      ...transformRef.current,
      scale:
        transformRef.current.scale + ZOOM_STEP,
    });
  };

  const rotate = () => {
    commitTransform({
      ...transformRef.current,
      rotation:
        (transformRef.current.rotation + 90) % 360,
    });
  };

  const reset = () => {
    commitTransform(DEFAULT_TRANSFORM);
  };

  const handleSliderChange = (e) => {
    commitTransform({
      ...transformRef.current,
      scale: parseFloat(e.target.value),
    });
  };

  const tr = (key) => t(lang, key);

  return (
    <div className="photo-editor">
      <canvas
        ref={canvasRef}
        width={TEMPLATE_WIDTH}
        height={TEMPLATE_HEIGHT}
        className={`portrait-canvas editable ${
          isDragging ? 'dragging' : ''
        }`}
        style={{
          width: displayWidth,
          height: displayHeight,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onWheel={handleWheel}
      />

      {img && (
        <>
          <p className="editor-hint">
            {tr('drag')}
          </p>

          <div className="editor-controls">
            <button
              type="button"
              className="icon-btn"
              onClick={zoomOut}
              aria-label={tr('zoom') + ' -'}
            >
              −
            </button>

            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={transformRef.current.scale}
              onChange={handleSliderChange}
              aria-label={tr('zoom')}
            />

            <button
              type="button"
              className="icon-btn"
              onClick={zoomIn}
              aria-label={tr('zoom') + ' +'}
            >
              +
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={rotate}
              aria-label={tr('rotate')}
              title={tr('rotate')}
            >
              ↻
            </button>

            <button
              type="button"
              className="text-btn"
              onClick={reset}
            >
              {tr('reset')}
            </button>
          </div>

          <button
            type="button"
            className="link-btn"
            onClick={onRetake}
          >
            {tr('retake')}
          </button>
        </>
      )}
    </div>
  );
}