const { loadImage } = require("canvas");
const {
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
  loadTeamLogo,
} = require("../utils/imageLoader");
const { createCanvasContext } = require("../utils/canvasSetup");
const theme = require("../constants/theme");

const CARD_HEIGHT = 220;
const CARD_GAP = 24;

function drawPlaceholderCircle(ctx, x, y, size) {
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

async function renderStatistics(payload) {
  const {
    matchday = "J16",
    averagePoints = 0,
    mostFailedMatch = null,
    homeTeamLogoUrl = null,
    awayTeamLogoUrl = null,
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
      w
    );
    ctx.globalAlpha = 1;
  }

  ctx.font = `bold ${theme.TITLE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  const titleText = `ESTADÍSTICAS ${matchday}`;
  const titleWidth = ctx.measureText(titleText).width;
  ctx.fillStyle = theme.TITLE_COLOR;
  ctx.fillText(titleText, (theme.CANVAS_WIDTH - titleWidth) / 2, 98 + theme.TITLE_FONT_SIZE);

  let y = 160;

  const cardWidth = theme.CANVAS_WIDTH - theme.PADDING * 2;
  const cardX = theme.PADDING;

  const logoSize = 64;

  if (mostFailedMatch) {
    ctx.fillStyle = theme.SCORE_RECT_COLOR;
    ctx.fillRect(cardX, y, cardWidth, CARD_HEIGHT);

    ctx.font = `${theme.LEAGUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.LEAGUE_LABEL_COLOR;
    ctx.fillText("PARTIDO MÁS FALLADO", cardX + 24, y + 40);

    const centerX = theme.CANVAS_WIDTH / 2;
    const leftLogoX = centerX - logoSize - 80;
    const rightLogoX = centerX + 80;

    let homeLogoImg = null;
    let awayLogoImg = null;
    if (homeTeamLogoUrl) {
      const buf = await loadTeamLogo(homeTeamLogoUrl);
      if (buf) homeLogoImg = await loadImage(buf);
    }
    if (awayTeamLogoUrl) {
      const buf = await loadTeamLogo(awayTeamLogoUrl);
      if (buf) awayLogoImg = await loadImage(buf);
    }

    const logoY = y + 70;
    if (homeLogoImg) {
      ctx.drawImage(homeLogoImg, leftLogoX, logoY, logoSize, logoSize);
    } else {
      drawPlaceholderCircle(ctx, leftLogoX, logoY, logoSize);
    }

    ctx.font = `bold ${theme.LEAGUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.TEXT_WHITE;
    ctx.fillText("VS", centerX - 15, logoY + logoSize / 2 + theme.LEAGUE_FONT_SIZE / 3);

    if (awayLogoImg) {
      ctx.drawImage(awayLogoImg, rightLogoX, logoY, logoSize, logoSize);
    } else {
      drawPlaceholderCircle(ctx, rightLogoX, logoY, logoSize);
    }

    ctx.font = `${theme.LEADERBOARD_USER_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.TEXT_WHITE;
    const homeName = mostFailedMatch.homeTeam || "—";
    const awayName = mostFailedMatch.awayTeam || "—";
    ctx.fillText(homeName, leftLogoX, y + CARD_HEIGHT - 30);
    ctx.fillText(awayName, rightLogoX, y + CARD_HEIGHT - 30);

    y += CARD_HEIGHT + CARD_GAP;
  }

  ctx.fillStyle = theme.SCORE_RECT_COLOR;
  ctx.fillRect(cardX, y, cardWidth, CARD_HEIGHT);

  ctx.font = `${theme.LEAGUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.LEAGUE_LABEL_COLOR;
  ctx.fillText("MEDIA DE PUNTOS", cardX + 24, y + 70);

  ctx.font = `bold ${theme.RESULTS_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TITLE_COLOR;
  ctx.fillText(String(averagePoints.toFixed(2)), cardX + 24, y + 140);

  y += CARD_HEIGHT + CARD_GAP;

  const correctCount = mostFailedMatch?.correctGuessesCount ?? 0;
  ctx.fillStyle = theme.SCORE_RECT_COLOR;
  ctx.fillRect(cardX, y, cardWidth, CARD_HEIGHT);

  ctx.font = `${theme.LEAGUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.LEAGUE_LABEL_COLOR;
  ctx.fillText("ACIERTOS PARTIDO MÁS FALLADO", cardX + 24, y + 70);

  ctx.font = `bold ${theme.RESULTS_FONT_SIZE}px ${theme.FONT_FAMILY}`;
  ctx.fillStyle = theme.TITLE_COLOR;
  ctx.fillText(String(correctCount), cardX + 24, y + 140);

  return canvas.toDataURL("image/png");
}

module.exports = { renderStatistics };
