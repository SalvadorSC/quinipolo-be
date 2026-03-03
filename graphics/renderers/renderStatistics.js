const { loadImage } = require("canvas");
const {
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
  loadTeamLogo,
} = require("../utils/imageLoader");
const { createCanvasContext } = require("../utils/canvasSetup");
const theme = require("../constants/theme");
const { drawTeamComponent } = require("../components/teamComponent");
const { drawBrandingBottom } = require("../utils/drawBranding");
const teamNameToImage = require("../data/teamNameToImage.json");

const CARD_GAP = 24;
const CONTENT_GAP = 40;

function getStatsCardDimensions(imgHeight) {
  const blocksTotalHeight = imgHeight * 0.7;
  const cardHeight = (blocksTotalHeight - 2 * CARD_GAP) / 3;
  return { cardHeight, cardGap: CARD_GAP };
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

async function renderStatistics(payload) {
  const {
    matchday = "J16",
    averagePoints = 0,
    mostFailedMatch = null,
  } = payload;

  const height = theme.STATISTICS_HEIGHT;
  const { canvas, ctx } = createCanvasContext(theme.CANVAS_WIDTH, height);

  const [bgBuffer, logoBuffer] = await Promise.all([
    loadBackgroundBuffer(theme.CANVAS_WIDTH, height),
    loadLogoWatermarkBuffer(theme.WATERMARK_SIZE),
  ]);

  if (bgBuffer) {
    const bgImage = await loadImage(bgBuffer);
    ctx.drawImage(bgImage, 0, 0, theme.CANVAS_WIDTH, height);
  }

  if (logoBuffer) {
    const watermarkImg = await loadImage(logoBuffer);
    ctx.globalAlpha = theme.WATERMARK_OPACITY;
    const w = theme.WATERMARK_SIZE;
    ctx.drawImage(
      watermarkImg,
      (theme.CANVAS_WIDTH - w) / 2,
      (height - w) / 2,
      w,
      w,
    );
    ctx.globalAlpha = 1;
  }

  ctx.font = `bold ${theme.TITLE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  const titleText = `ESTADÍSTICAS ${matchday}`;
  const titleWidth = ctx.measureText(titleText).width;
  ctx.fillStyle = theme.TITLE_COLOR;
  ctx.fillText(
    titleText,
    (theme.CANVAS_WIDTH - titleWidth) / 2,
    98 + theme.TITLE_FONT_SIZE,
  );

  if (logoBuffer) {
    const logoImg = await loadImage(logoBuffer);
    const cornerLogoSize = Math.round(theme.LEADERBOARD_LOGO_SIZE * 1.2);
    ctx.globalAlpha = 1;
    ctx.drawImage(
      logoImg,
      theme.CANVAS_WIDTH - theme.PADDING - cornerLogoSize,
      98,
      cornerLogoSize,
      cornerLogoSize,
    );
  }

  const { cardHeight } = getStatsCardDimensions(height);
  const horizontalInset = theme.STATS_CARD_HORIZONTAL_INSET ?? 0;
  const cardWidth = theme.CANVAS_WIDTH - theme.PADDING * 2 - horizontalInset;
  const cardX = theme.PADDING + horizontalInset / 2;
  const radius = theme.STATS_CARD_RADIUS ?? 16;

  const blocksTotalHeight = height * 0.7;
  const startY = (height - blocksTotalHeight) / 2;
  let y = startY;

  const logoSize = 110;

  if (mostFailedMatch) {
    ctx.fillStyle = theme.STATS_CARD_COLOR;
    drawRoundRect(ctx, cardX, y, cardWidth, cardHeight, radius);

    const content1Height = theme.STATS_TITLE_FONT_SIZE + CONTENT_GAP + logoSize;
    const content1Top = y + (cardHeight - content1Height) / 2;

    const heading1Y = content1Top + theme.STATS_TITLE_FONT_SIZE;
    ctx.font = `bold ${theme.STATS_TITLE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.TEXT_WHITE;
    const heading1 = "PARTIDO MÁS FALLADO";
    const heading1Width = ctx.measureText(heading1).width;
    ctx.fillText(heading1, (theme.CANVAS_WIDTH - heading1Width) / 2, heading1Y);

    const centerX = theme.CANVAS_WIDTH / 2;
    const leftLogoX = centerX - logoSize - 80;
    const rightLogoX = centerX + 80;
    const logoY = content1Top + theme.STATS_TITLE_FONT_SIZE + CONTENT_GAP;

    const homeLogoSource =
      mostFailedMatch.homeTeamLogoUrl ??
      mostFailedMatch.homeTeamImageName ??
      teamNameToImage[mostFailedMatch.homeTeam];
    const awayLogoSource =
      mostFailedMatch.awayTeamLogoUrl ??
      mostFailedMatch.awayTeamImageName ??
      teamNameToImage[mostFailedMatch.awayTeam];

    const homeLogoBuffer = homeLogoSource
      ? await loadTeamLogo(homeLogoSource, logoSize)
      : null;
    const awayLogoBuffer = awayLogoSource
      ? await loadTeamLogo(awayLogoSource, logoSize)
      : null;

    await drawTeamComponent(ctx, leftLogoX, logoY, logoSize, {
      logoBuffer: homeLogoBuffer,
      teamName: mostFailedMatch.homeTeam,
      bgColor: mostFailedMatch.homeTeamBgColor ?? null,
    });

    ctx.font = `bold ${theme.STATS_VS_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.TEXT_WHITE;
    ctx.fillText(
      "VS",
      centerX - 15,
      logoY + logoSize / 2 + theme.STATS_VS_FONT_SIZE / 3,
    );

    await drawTeamComponent(ctx, rightLogoX, logoY, logoSize, {
      logoBuffer: awayLogoBuffer,
      teamName: mostFailedMatch.awayTeam,
      bgColor: mostFailedMatch.awayTeamBgColor ?? null,
    });

    y += cardHeight + CARD_GAP;
  }

  ctx.fillStyle = theme.STATS_CARD_COLOR;
  drawRoundRect(ctx, cardX, y, cardWidth, cardHeight, radius);

  const content2Height =
    theme.STATS_TITLE_FONT_SIZE + CONTENT_GAP + theme.STATS_VALUE_FONT_SIZE;
  const content2Top = y + (cardHeight - content2Height) / 2;

  const heading2Y = content2Top + theme.STATS_TITLE_FONT_SIZE;
  ctx.font = `bold ${theme.STATS_TITLE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TEXT_WHITE;
  const heading2 = "MEDIA DE PUNTOS";
  const heading2Width = ctx.measureText(heading2).width;
  ctx.fillText(heading2, (theme.CANVAS_WIDTH - heading2Width) / 2, heading2Y);

  const value2Y =
    content2Top +
    theme.STATS_TITLE_FONT_SIZE +
    CONTENT_GAP +
    theme.STATS_VALUE_FONT_SIZE;
  ctx.font = `bold ${theme.STATS_VALUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TEXT_WHITE;
  const value2 = String(averagePoints.toFixed(2));
  const value2Width = ctx.measureText(value2).width;
  ctx.fillText(value2, (theme.CANVAS_WIDTH - value2Width) / 2, value2Y);

  y += cardHeight + CARD_GAP;

  const correctCount = mostFailedMatch?.correctGuessesCount ?? 0;
  ctx.fillStyle = theme.STATS_CARD_COLOR;
  drawRoundRect(ctx, cardX, y, cardWidth, cardHeight, radius);

  const content3Height =
    theme.STATS_TITLE_FONT_SIZE + CONTENT_GAP + theme.STATS_VALUE_FONT_SIZE;
  const content3Top = y + (cardHeight - content3Height) / 2;

  const line1Y = content3Top + theme.STATS_TITLE_FONT_SIZE;
  ctx.font = `bold ${theme.STATS_TITLE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TEXT_WHITE;
  const line1 = "ACIERTOS PARTIDO MÁS FALLADO";
  const line1Width = ctx.measureText(line1).width;
  ctx.fillText(line1, (theme.CANVAS_WIDTH - line1Width) / 2, line1Y);

  const value3Y =
    content3Top +
    theme.STATS_TITLE_FONT_SIZE +
    CONTENT_GAP +
    theme.STATS_VALUE_FONT_SIZE;
  ctx.font = `bold ${theme.STATS_VALUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TEXT_WHITE;
  const value3 = String(correctCount);
  const value3Width = ctx.measureText(value3).width;
  ctx.fillText(value3, (theme.CANVAS_WIDTH - value3Width) / 2, value3Y);

  drawBrandingBottom(ctx, theme.CANVAS_WIDTH, height);

  return canvas.toDataURL("image/png");
}

module.exports = { renderStatistics };
