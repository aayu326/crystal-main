import { drawClippedPhoto, strokeArchPath, canvasToBlob, truncate } from '../utils/imageUtils.js';
import { t } from '../data/translations.js';
import posterOverlayUrl from '../assets/poster-overlay.webp';

// Poster artwork (Crystal KGR-T) with the photo window cut out (transparent).
// The user's photo is drawn first, then this overlay on top.
let posterOverlay = null;
export function preloadPoster() {
  return new Promise((resolve) => {
    if (posterOverlay) return resolve(posterOverlay);
    const im = new Image();
    im.onload = () => {
      posterOverlay = im;
      resolve(im);
    };
    im.onerror = () => resolve(null);
    im.src = posterOverlayUrl;
  });
}

export const TEMPLATE_WIDTH = 1600;
export const TEMPLATE_HEIGHT = 2000;

// ---------------------------------------------------------------------------
// Per-language font stacks.
//
// Manrope/Fraunces (the brand's Latin fonts) are always listed first so Latin
// glyphs (brand names, numerals, punctuation) keep the existing look. Each
// language then falls back to the correct Noto family for its script, so the
// generated poster never shows tofu boxes / missing-glyph squares no matter
// which of the 9 languages is selected.
//
// IMPORTANT: these are *font-family* names only. The actual font files must
// be loaded on the page (e.g. via a Google Fonts <link> in index.html) before
// they can be used on the canvas — see ensureFonts() below, which uses the
// Font Loading API to make sure each family is ready before drawing.
// ---------------------------------------------------------------------------
const FONT_STACKS = {
  en: {
    sans: `Manrope, sans-serif`,
    serif: `Fraunces, serif`,
  },
  hi: {
    sans: `Manrope, 'Noto Sans Devanagari', sans-serif`,
    serif: `Fraunces, 'Noto Serif Devanagari', sans-serif`,
  },
  mr: {
    sans: `Manrope, 'Noto Sans Devanagari', sans-serif`,
    serif: `Fraunces, 'Noto Serif Devanagari', sans-serif`,
  },
  pa: {
    sans: `Manrope, 'Noto Sans Gurmukhi', sans-serif`,
    serif: `Fraunces, 'Noto Serif Gurmukhi', 'Noto Sans Gurmukhi', sans-serif`,
  },
  gu: {
    sans: `Manrope, 'Noto Sans Gujarati', sans-serif`,
    serif: `Fraunces, 'Noto Serif Gujarati', sans-serif`,
  },
  ta: {
    sans: `Manrope, 'Noto Sans Tamil', sans-serif`,
    serif: `Fraunces, 'Noto Serif Tamil', sans-serif`,
  },
  te: {
    sans: `Manrope, 'Noto Sans Telugu', sans-serif`,
    serif: `Fraunces, 'Noto Serif Telugu', sans-serif`,
  },
  kn: {
    sans: `Manrope, 'Noto Sans Kannada', sans-serif`,
    serif: `Fraunces, 'Noto Serif Kannada', sans-serif`,
  },
  ml: {
    sans: `Manrope, 'Noto Sans Malayalam', sans-serif`,
    serif: `Fraunces, 'Noto Serif Malayalam', sans-serif`,
  },
};

// A short sample string per script, used to force-load that script's font
// (document.fonts.load needs at least one glyph from the target font to
// actually resolve the fallback family it should fetch).
const FONT_SAMPLES = {
  en: 'Aa',
  hi: 'दिवाळी Aa',
  mr: 'दिवाळी Aa',
  pa: 'ਦੀਵਾਲੀ Aa',
  gu: 'દિવાળી Aa',
  ta: 'தீபாவளி Aa',
  te: 'దీపావళి Aa',
  kn: 'ದೀಪಾವಳಿ Aa',
  ml: 'ദീപാവലി Aa',
};

function getFontStack(lang) {
  return FONT_STACKS[lang] || FONT_STACKS.en;
}

const COLORS = {
  gold: '#f2c14e',
  cream: '#fbf8f1',
  red: '#c0392b',
  green: '#2c7a3d',
  ink: '#1c1c1c',
};

export function getFrameGeometry(width = TEMPLATE_WIDTH, height = TEMPLATE_HEIGHT) {
  // Photo window inside the poster: x 670-1895, y 440-2067 of 2048x2560.
  const left = (670 / 2048) * width;
  const right = (1895 / 2048) * width;
  const top = (440 / 2560) * height;
  const bottom = (2067 / 2560) * height;
  return {
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
    archRadius: 0,
  };
}

/**
 * Canvas draws with whatever font is loaded at that moment. Call this (and
 * redraw) before the first render, otherwise the first export can use fallback
 * fonts. Pass the active `lang` so only the fonts actually needed are loaded.
 */
export async function ensureFonts(lang = 'en') {
  if (!document.fonts || !document.fonts.load) return;
  const sample = FONT_SAMPLES[lang] || FONT_SAMPLES.en;
  const stack = getFontStack(lang);
  try {
    await Promise.all([
      // Brand Latin fonts (always needed: header pill, JIVORA®, numerals, etc.)
      document.fonts.load('700 40px Manrope', 'Aa'),
      document.fonts.load('500 20px Manrope', 'Aa'),
      document.fonts.load('700 58px Fraunces', 'Aa'),
      // Localized sans/serif for the active language's script.
      document.fonts.load(`700 40px ${stack.sans}`, sample),
      document.fonts.load(`600 20px ${stack.sans}`, sample),
      document.fonts.load(`700 58px ${stack.serif}`, sample),
      document.fonts.load(`500 24px ${stack.sans}`, sample),
    ]);
  } catch {
    /* ignore – fall back to stack */
  }
}

function scaleFont(base, width) {
  return Math.round(base * (width / TEMPLATE_WIDTH));
}

/** Sets ctx.font so `text` fits `maxWidth`, shrinking from `basePx` down to 60%. */
function fitFont(ctx, text, maxWidth, basePx, weight, family, w) {
  let size = scaleFont(basePx, w);
  const min = Math.round(size * 0.6);
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > min) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Greedy word wrap using the current ctx.font. */
function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, w * 0.15, h);
  grad.addColorStop(0, '#0f3d24');
  grad.addColorStop(0.55, '#0b2e1b');
  grad.addColorStop(1, '#082014');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Soft warm glow behind the photo frame – adds depth without clutter.
  const glow = ctx.createRadialGradient(w / 2, h * 0.5, w * 0.1, w / 2, h * 0.5, w * 0.7);
  glow.addColorStop(0, 'rgba(242,193,78,0.16)');
  glow.addColorStop(1, 'rgba(242,193,78,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const dotColors = ['rgba(255,215,120,0.18)', 'rgba(255,255,255,0.08)'];
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 40; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = dotColors[i % 2];
    const r = 2 + rand() * (w * 0.006);
    ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarigoldGarland(ctx, w) {
  const y = w * 0.03;
  const flowerR = w * 0.024;
  const gap = flowerR * 1.9;
  const count = Math.ceil(w / gap) + 2;
  for (let i = 0; i < count; i += 1) {
    const x = i * gap - gap / 2;
    const bob = Math.sin(i * 0.9) * (w * 0.012);
    ctx.save();
    ctx.translate(x, y + bob + flowerR);
    ctx.fillStyle = i % 2 === 0 ? '#f5a623' : '#f7c948';
    for (let p = 0; p < 8; p += 1) {
      ctx.rotate((Math.PI * 2) / 8);
      ctx.beginPath();
      ctx.ellipse(0, -flowerR * 0.55, flowerR * 0.34, flowerR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.fillStyle = '#c96a1a';
    ctx.arc(0, 0, flowerR * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (i % 2 === 0) {
      ctx.save();
      ctx.translate(x, y + flowerR * 1.7);
      ctx.fillStyle = '#3f7d4a';
      ctx.beginPath();
      ctx.ellipse(0, 0, flowerR * 0.22, flowerR * 0.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Brand header text (CRYSTAL / Inspiring Growth) is always Latin, so it keeps
// using the plain Manrope stack regardless of the active language.
function drawBrandHeader(ctx, w, h) {
  const pillW = w * 0.34;
  const pillH = h * 0.056;
  const pillX = w / 2 - pillW / 2;
  const pillY = h * 0.08;
  ctx.save();
  ctx.fillStyle = COLORS.cream;
  roundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${scaleFont(40, w)}px Manrope, sans-serif`;
  ctx.fillStyle = COLORS.red;
  ctx.fillText('CRYSTAL', w / 2, pillY + pillH * 0.4);
  ctx.font = `600 ${scaleFont(15, w)}px Manrope, sans-serif`;
  ctx.fillStyle = COLORS.green;
  ctx.fillText('Inspiring Growth', w / 2, pillY + pillH * 0.79);
  ctx.restore();
}

/** "From Crystal family" label + headline, wrapped onto max 2 lines so nothing is clipped. */
function drawHeadline(ctx, w, h, lang) {
  const { sans, serif } = getFontStack(lang);
  const maxW = w * 0.84;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = COLORS.gold;
  fitFont(ctx, t(lang, 'fromCrystal'), maxW, 28, 600, sans, w);
  ctx.fillText(t(lang, 'fromCrystal'), w / 2, h * 0.163);

  ctx.fillStyle = '#fdfaf3';
  const text = t(lang, 'diwaliWish');
  let size = scaleFont(60, w);
  ctx.font = `700 ${size}px ${serif}`;
  let lines = wrapLines(ctx, text, maxW);
  // If it needs more than 2 lines, shrink until it fits.
  while (lines.length > 2 && size > scaleFont(38, w)) {
    size -= 2;
    ctx.font = `700 ${size}px ${serif}`;
    lines = wrapLines(ctx, text, maxW);
  }
  const lineH = size * 1.22;
  const startY = lines.length === 1 ? h * 0.225 : h * 0.212;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineH));
  ctx.restore();
}

/** Fills the arch-shaped area behind the photo (so no dark rectangle corners show). */
function fillArchBackdrop(ctx, frame) {
  const { cx, cy, width, height } = frame;
  const left = cx - width / 2;
  const right = cx + width / 2;
  const top = cy - height / 2;
  const bottom = cy + height / 2;
  const r = width / 2;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, '#154a2c');
  grad.addColorStop(1, '#0a2f1b');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top + r);
  ctx.arc(cx, top + r, r, Math.PI, 0, false);
  ctx.lineTo(right, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiyas(ctx, frame, w, h) {
  const r = w * 0.04;
  const diyaY = frame.cy + frame.height / 2 - h * 0.012;
  // Pushed clear of the gold frame so they never overlap it.
  const offset = frame.width / 2 + w * 0.075;
  [frame.cx - offset, frame.cx + offset].forEach((x) => {
    const flameGrad = ctx.createRadialGradient(x, diyaY - r * 1.5, 1, x, diyaY - r * 1.5, r * 0.9);
    flameGrad.addColorStop(0, '#fff6d0');
    flameGrad.addColorStop(0.5, '#ffb84d');
    flameGrad.addColorStop(1, 'rgba(255,140,0,0)');
    ctx.save();
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.ellipse(x, diyaY - r * 1.55, r * 0.45, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8a4a1e';
    ctx.beginPath();
    ctx.ellipse(x, diyaY, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b5651d';
    ctx.beginPath();
    ctx.ellipse(x, diyaY - r * 0.18, r * 0.82, r * 0.4, 0, 0, Math.PI, true);
    ctx.fill();
    ctx.restore();
  });
}

function drawCottonFlowers(ctx, w, h) {
  const spots = [
    [w * 0.09, h * 0.38],
    [w * 0.91, h * 0.36],
    [w * 0.08, h * 0.66],
    [w * 0.92, h * 0.68],
  ];
  spots.forEach(([x, y]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#faf7ef';
    for (let i = 0; i < 5; i += 1) {
      const ang = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * w * 0.018, Math.sin(ang) * w * 0.018, w * 0.017, w * 0.013, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f4d35e';
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.008, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawArchDecor(ctx, frame, w) {
  strokeArchPath(ctx, frame.cx, frame.cy, frame.width + w * 0.012, frame.height + w * 0.012, frame.archRadius, (c) => {
    c.lineWidth = w * 0.014;
    c.strokeStyle = COLORS.gold;
  });
  strokeArchPath(ctx, frame.cx, frame.cy, frame.width - w * 0.006, frame.height - w * 0.006, frame.archRadius, (c) => {
    c.lineWidth = w * 0.003;
    c.strokeStyle = 'rgba(255,255,255,0.55)';
  });
}

function drawEmptyFramePlaceholder(ctx, frame, w) {
  const r = w * 0.032;
  const y = frame.cy - w * 0.02;
  ctx.save();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(frame.cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#123';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(frame.cx - r * 0.45, y);
  ctx.lineTo(frame.cx + r * 0.45, y);
  ctx.moveTo(frame.cx, y - r * 0.45);
  ctx.lineTo(frame.cx, y + r * 0.45);
  ctx.stroke();
  ctx.restore();
}

// Name badge draws the user-entered name and district/state, both of which
// may be typed in the active language's script — so it now takes `lang` and
// uses that language's sans stack instead of a hardcoded font.
function drawNameBadge(ctx, frame, w, name, districtState, lang) {
  const { sans } = getFontStack(lang);
  const hasSub = Boolean(districtState);
  const badgeW = frame.width * 0.78;
  const badgeH = w * (hasSub ? 0.088 : 0.062);
  const badgeX = frame.cx - badgeW / 2;
  const badgeY = frame.cy + frame.height / 2 - badgeH * 0.5;
  const innerW = badgeW - badgeH * 0.9;

  ctx.save();
  // subtle drop shadow so the badge lifts off the photo
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = w * 0.012;
  ctx.shadowOffsetY = w * 0.004;
  ctx.fillStyle = COLORS.red;
  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const nameText = truncate(name || '', 22);
  fitFont(ctx, nameText, innerW, 30, 700, sans, w);
  ctx.fillText(nameText, frame.cx, badgeY + badgeH * (hasSub ? 0.36 : 0.5));

  if (hasSub) {
    const subText = truncate(districtState, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    fitFont(ctx, subText, innerW, 20, 500, sans, w);
    ctx.fillText(subText, frame.cx, badgeY + badgeH * 0.72);
  }
  ctx.restore();
}

function drawFooterBanner(ctx, w, h, lang) {
  const { sans } = getFontStack(lang);
  const bannerH = h * 0.16;
  const bannerY = h - bannerH;

  ctx.save();
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.moveTo(0, bannerY + bannerH * 0.28);
  ctx.quadraticCurveTo(w / 2, bannerY - bannerH * 0.12, w, bannerY + bannerH * 0.28);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const padX = w * 0.07;
  const contentW = w - padX * 2;
  const rowOneY = bannerY + bannerH * 0.5;
  const rowTwoY = bannerY + bannerH * 0.8;
  const pillW = w * 0.2;
  const pillH = bannerH * 0.26;

  // Product pill – brand name JIVORA® stays Latin/Manrope regardless of lang.
  ctx.save();
  ctx.fillStyle = COLORS.red;
  roundedRect(ctx, padX, rowOneY - pillH / 2, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${scaleFont(24, w)}px Manrope, sans-serif`;
  ctx.fillText('JIVORA®', padX + pillW / 2, rowOneY + 1);
  ctx.restore();

  // Tagline – localized text, fitted to the space right of the pill.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.ink;
  const taglineX = padX + pillW + w * 0.025;
  const tagline = t(lang, 'jivoraTagline');
  fitFont(ctx, tagline, w - padX - taglineX, 24, 500, sans, w);
  ctx.fillText(tagline, taglineX, rowOneY + 1);
  ctx.restore();

  // Second row: brand line (left, kept as fixed transliteration) + hashtag
  // (right, always Latin) — each gets its own width budget.
  const hashtag = t(lang, 'hashtag');
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.red;
  const hashSize = fitFont(ctx, hashtag, contentW * 0.32, 21, 700, `Manrope, sans-serif`, w);
  const hashW = ctx.measureText(hashtag).width;
  ctx.fillText(hashtag, w - padX, rowTwoY);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.green;
  const brand = t(lang, 'brandLine');
  // brandLine is stored in Devanagari across all languages (a fixed
  // transliterated tagline, not translated per-language), so it always needs
  // the Devanagari-aware sans stack to render, regardless of the active lang.
  fitFont(ctx, brand, contentW - hashW - w * 0.03, Math.max(21, hashSize), 700, `Manrope, 'Noto Sans Devanagari', sans-serif`, w);
  ctx.fillText(brand, padX, rowTwoY);
  ctx.restore();
}

export function drawPortrait(ctx, { width, height, img, transform, name, districtState, lang = 'en' }) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#1d5fb4';
  ctx.fillRect(0, 0, width, height);

  const frame = getFrameGeometry(width, height);
  ctx.fillStyle = '#eaf3ff';
  ctx.fillRect(frame.cx - frame.width / 2, frame.cy - frame.height / 2, frame.width, frame.height);

  if (img) {
    drawClippedPhoto(ctx, img, frame, transform || {});
  } else {
    drawEmptyFramePlaceholder(ctx, frame, width);
  }

  if (posterOverlay) {
    ctx.drawImage(posterOverlay, 0, 0, width, height);
  }

  if (name || districtState) {
    // Keep the badge inside the visible (right/lower) part of the window.
    const badgeFrame = {
      ...frame,
      cx: frame.cx + frame.width * 0.08,
      width: frame.width * 0.86,
      height: frame.height - width * 0.03,
    };
    drawNameBadge(ctx, badgeFrame, width, name, districtState, lang);
  }
}

export async function generatePortraitBlob({ img, transform, name, districtState, lang }) {
  await ensureFonts(lang);
  await preloadPoster();
  const canvas = document.createElement('canvas');
  canvas.width = TEMPLATE_WIDTH;
  canvas.height = TEMPLATE_HEIGHT;
  const ctx = canvas.getContext('2d');
  drawPortrait(ctx, {
    width: TEMPLATE_WIDTH,
    height: TEMPLATE_HEIGHT,
    img,
    transform,
    name,
    districtState,
    lang,
  });
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.80);
  return { blob, canvas };
}