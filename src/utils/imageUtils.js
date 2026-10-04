/** Loads a File/Blob/URL into an HTMLImageElement, resolving once decoded. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/** Reads a File into a data URL. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Draws the user's photo, transformed by {x, y, scale, rotation}, into the
 * arch-shaped clip path of the given canvas context. `frame` describes the
 * clip area in the SAME coordinate space the caller is drawing in.
 *
 * x/y are offsets (in canvas px) of the image centre from the frame centre.
 * scale is a multiplier on the image's "cover" base scale.
 * rotation is in degrees.
 */
export function drawClippedPhoto(ctx, img, frame, transform) {
  const { cx, cy, width, height, archRadius } = frame;
  const { x = 0, y = 0, scale = 1, rotation = 0 } = transform;

  ctx.save();
  clipArchPath(ctx, cx, cy, width, height, archRadius);

  // Base "cover" scale so the shorter dimension fills the frame.
  const baseScale = Math.max(width / img.width, height / img.height);
  const finalScale = baseScale * scale;

  ctx.translate(cx + x, cy + y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(finalScale, finalScale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  ctx.restore();
}

/** Builds an arch (rounded-top) clip path centred at (cx, cy). */
export function clipArchPath(ctx, cx, cy, width, height, archRadius) {
  const left = cx - width / 2;
  const right = cx + width / 2;
  const top = cy - height / 2;
  const bottom = cy + height / 2;
  const r = Math.min(archRadius, width / 2);

  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top + r);
  ctx.arcTo(left, top, left + r, top, r);
  ctx.lineTo(right - r, top);
  ctx.arcTo(right, top, right, top + r, r);
  ctx.lineTo(right, bottom);
  ctx.closePath();
  ctx.clip();
}

/** Strokes the same arch path (used for the decorative gold border). */
export function strokeArchPath(ctx, cx, cy, width, height, archRadius, styleFn) {
  ctx.save();
  clipArchPathNoClip(ctx, cx, cy, width, height, archRadius);
  styleFn(ctx);
  ctx.stroke();
  ctx.restore();
}

function clipArchPathNoClip(ctx, cx, cy, width, height, archRadius) {
  const left = cx - width / 2;
  const right = cx + width / 2;
  const top = cy - height / 2;
  const bottom = cy + height / 2;
  const r = Math.min(archRadius, width / 2);

  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top + r);
  ctx.arcTo(left, top, left + r, top, r);
  ctx.lineTo(right - r, top);
  ctx.arcTo(right, top, right, top + r, r);
  ctx.lineTo(right, bottom);
}

/** Clamp helper. */
export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Converts a canvas to a Blob (Promise wrapper). */
export function canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Truncates long names/locations for the badge, adding an ellipsis. */
export function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
export async function compressImage(
  file,
  {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.82,
    type = 'image/jpeg',
  } = {}
) {
  const img = await loadImage(await fileToDataUrl(file));

  const scale = Math.min(
    1,
    maxWidth / img.width,
    maxHeight / img.height
  );

  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, type, quality);

  if (!blob) {
    throw new Error('IMAGE_COMPRESSION_FAILED');
  }

  return new File(
    [blob],
    `selfie-${Date.now()}.jpg`,
    { type }
  );
}