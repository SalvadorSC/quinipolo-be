const BRANDING_TEXT = "QUINIPOLO.com";
const BRANDING_FONT_SIZE = 32;
const BRANDING_OPACITY = 0.3;

/**
 * Draw "QUINIPOLO.com" vertically on the right side of the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {Object} theme - Theme object (FONT_FAMILY, TEXT_WHITE, PADDING)
 */
function drawBrandingVertical(ctx, canvasWidth, canvasHeight, theme) {
  ctx.save();
  ctx.globalAlpha = BRANDING_OPACITY;
  ctx.font = `bold ${BRANDING_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TEXT_WHITE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const brandingX = canvasWidth - theme.PADDING - 20;
  const brandingY = canvasHeight / 2;
  ctx.translate(brandingX, brandingY);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(BRANDING_TEXT, 0, 0);
  ctx.restore();
}

/**
 * Draw "QUINIPOLO.com" horizontally at the bottom center of the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {Object} theme - Theme object (FONT_FAMILY, TEXT_WHITE, PADDING)
 */
function drawBrandingBottom(ctx, canvasWidth, canvasHeight, theme) {
  ctx.save();
  ctx.globalAlpha = BRANDING_OPACITY;
  ctx.font = `bold ${BRANDING_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TEXT_WHITE;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const brandingY = canvasHeight - theme.PADDING;
  ctx.fillText(BRANDING_TEXT, canvasWidth / 2, brandingY);
  ctx.restore();
}

module.exports = { drawBrandingVertical, drawBrandingBottom };
