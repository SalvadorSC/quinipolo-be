const sharp = require("sharp");
const { loadImage } = require("canvas");

const DEFAULT_PLACEHOLDER_COLOR = "rgba(255,255,255,0.3)";
const SKIP_WORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "i",
  "e",
  "en",
  "al",
  "a",
  "d",
]);

/**
 * Get initials from team name. E.g. "Club natació Sant Feliu" → "CNSF", "Club Natació Molins de Rei" → "CNMR".
 * Skips common short words (de, la, el, etc.).
 * @param {string} teamName
 * @param {number} [maxLetters=4]
 * @returns {string}
 */
function getInitials(teamName, maxLetters = 4) {
  if (!teamName || typeof teamName !== "string") return "";
  const words = teamName
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !SKIP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return "";
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  const letters = [];
  for (const w of words) {
    if (w.length === 2 && w === w.toUpperCase()) {
      letters.push(w[0], w[1]);
    } else if (w.length >= 1) {
      letters.push(w[0].toUpperCase());
    }
    if (letters.length >= maxLetters) break;
  }
  return letters.slice(0, maxLetters).join("");
}

/**
 * Extract average RGB from image buffer by resizing to 1x1.
 * @param {Buffer} buffer - Image buffer (PNG, JPEG, etc.)
 * @returns {{ r: number, g: number, b: number } | null}
 */
async function extractAverageColor(buffer) {
  try {
    const pixelBuffer = await sharp(buffer)
      .resize(1, 1)
      .ensureAlpha()
      .raw()
      .toBuffer();
    return {
      r: pixelBuffer[0],
      g: pixelBuffer[1],
      b: pixelBuffer[2],
    };
  } catch {
    return null;
  }
}

/**
 * Get complement (inverse) of RGB color as rgba string.
 * @param {{ r: number, g: number, b: number }} rgb
 * @param {number} [alpha=1]
 * @returns {string}
 */
function rgbToComplementRgba(rgb, alpha = 1) {
  const r = Math.round(255 - rgb.r);
  const g = Math.round(255 - rgb.g);
  const b = Math.round(255 - rgb.b);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawCircle(ctx, x, y, size) {
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlaceholderCircle(ctx, x, y, size) {
  ctx.fillStyle = DEFAULT_PLACEHOLDER_COLOR;
  drawCircle(ctx, x, y, size);
}

function drawPlaceholderWithInitials(ctx, x, y, size, initials, theme) {
  ctx.fillStyle = DEFAULT_PLACEHOLDER_COLOR;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  if (initials) {
    const fontSize = Math.round(size * 0.35);
    ctx.font = `bold ${fontSize}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.TEXT_WHITE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, x + size / 2, y + size / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}

/**
 * Draw a reusable team component: background (with optional auto-complement) + logo.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - Left position
 * @param {number} y - Top position
 * @param {number} size - Width and height of the component
 * @param {Object} options
 * @param {Buffer|null} options.logoBuffer - Team logo image buffer (from loadTeamLogo). If null, draws placeholder with initials.
 * @param {string|null} options.teamName - Team name for initials when no logo (e.g. "Club Natació Sant Feliu" → "CNSF").
 * @param {string|null} options.bgColor - Background color (e.g. '#fff', 'rgba(255,0,0,0.5)'). If null and logo exists, uses complement of logo's average color.
 * @param {number} [options.radius] - Corner radius for background rect. Defaults to size * 0.2.
 * @param {number} [options.padding] - Inset for logo/placeholder from container edges.
 * @param {Object} options.theme - Theme object (FONT_FAMILY, TEXT_WHITE). Required when logoBuffer is null.
 */
async function drawTeamComponent(ctx, x, y, size, options = {}) {
  const {
    logoBuffer,
    teamName,
    bgColor,
    radius = Math.round(size * 0.2),
    padding = 0,
    theme,
  } = options;

  const innerSize = size - 2 * padding;

  if (!logoBuffer) {
    const initials = getInitials(teamName || "");
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    drawRoundRect(ctx, x, y, size, size, radius);
    if (initials) {
      drawPlaceholderWithInitials(
        ctx,
        x + padding,
        y + padding,
        innerSize,
        initials,
        theme,
      );
    }
    return;
  }

  let effectiveBgColor = bgColor;
  if (!effectiveBgColor) {
    const avgColor = await extractAverageColor(logoBuffer);
    if (avgColor) {
      effectiveBgColor = rgbToComplementRgba(avgColor, 0.9);
    } else {
      effectiveBgColor = "rgba(255,255,255,0.4)";
    }
  }

  ctx.fillStyle = effectiveBgColor;
  drawRoundRect(ctx, x, y, size, size, radius);

  const clipX = x + padding;
  const clipY = y + padding;
  const clipSize = innerSize;
  const innerRadius = Math.max(0, radius - padding);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clipX + innerRadius, clipY);
  ctx.lineTo(clipX + clipSize - innerRadius, clipY);
  ctx.quadraticCurveTo(
    clipX + clipSize,
    clipY,
    clipX + clipSize,
    clipY + innerRadius,
  );
  ctx.lineTo(clipX + clipSize, clipY + clipSize - innerRadius);
  ctx.quadraticCurveTo(
    clipX + clipSize,
    clipY + clipSize,
    clipX + clipSize - innerRadius,
    clipY + clipSize,
  );
  ctx.lineTo(clipX + innerRadius, clipY + clipSize);
  ctx.quadraticCurveTo(
    clipX,
    clipY + clipSize,
    clipX,
    clipY + clipSize - innerRadius,
  );
  ctx.lineTo(clipX, clipY + innerRadius);
  ctx.quadraticCurveTo(clipX, clipY, clipX + innerRadius, clipY);
  ctx.clip();
  const logoImg = await loadImage(logoBuffer);
  const imgW = logoImg.width;
  const imgH = logoImg.height;
  const scale = Math.min(clipSize / imgW, clipSize / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = clipX + (clipSize - drawW) / 2;
  const offsetY = clipY + (clipSize - drawH) / 2;
  ctx.drawImage(logoImg, 0, 0, imgW, imgH, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

module.exports = {
  drawTeamComponent,
  getInitials,
  extractAverageColor,
  rgbToComplementRgba,
  drawPlaceholderCircle,
};
