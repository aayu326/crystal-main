import { forwardRef, useEffect, useRef } from 'react';
import { drawPortrait, TEMPLATE_WIDTH, TEMPLATE_HEIGHT } from '../services/portraitGenerator.js';

/**
 * Renders the shared festive-portrait canvas at a given DISPLAY width; the
 * drawing routine always works in TEMPLATE_WIDTH x TEMPLATE_HEIGHT fractional
 * space so the on-screen preview matches the final export pixel-for-pixel.
 */
const PortraitTemplate = forwardRef(function PortraitTemplate(
  { img, transform, name, districtState, lang, displayWidth = 360, className = '' },
  externalRef
) {
  const localRef = useRef(null);
  const canvasRef = externalRef || localRef;
  const displayHeight = Math.round((displayWidth * TEMPLATE_HEIGHT) / TEMPLATE_WIDTH);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawPortrait(ctx, {
      width: canvas.width,
      height: canvas.height,
      img,
      transform,
      name,
      districtState,
      lang,
    });
  }, [img, transform, name, districtState, lang, canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      width={TEMPLATE_WIDTH}
      height={TEMPLATE_HEIGHT}
      className={`portrait-canvas ${className}`}
      style={{ width: displayWidth, height: displayHeight }}
    />
  );
});

export default PortraitTemplate;
