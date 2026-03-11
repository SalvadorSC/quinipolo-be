const { loadImage } = require("canvas");
const {
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
  loadTeamLogo,
} = require("../utils/imageLoader");
const { createCanvasContext } = require("../utils/canvasSetup");
const { statisticsTheme } = require("../constants/theme");
const { drawTeamComponent } = require("../components/teamComponent");
const { drawBrandingBottom } = require("../utils/drawBranding");
const teamNameToImage = require("../data/teamNameToImage.json");
const {
  extractBgColorFromFilename,
  resolveTeamLogoSource,
} = require("../utils/teamLogoResolver");

const CARD_GAP = 24;
const CONTENT_GAP = 40;
const TITLE_VALUE_GAP = 20;
const LAST_TWO_CARDS_CONTENT_OFFSET_UP = 15;

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

  const height = statisticsTheme.STATISTICS_HEIGHT;
  const { canvas, ctx } = createCanvasContext(
    statisticsTheme.CANVAS_WIDTH,
    height,
  );

  const [bgBuffer, logoBuffer] = await Promise.all([
    loadBackgroundBuffer(statisticsTheme.CANVAS_WIDTH, height),
    loadLogoWatermarkBuffer(statisticsTheme.WATERMARK_SIZE),
  ]);

  if (bgBuffer) {
    const bgImage = await loadImage(bgBuffer);
    ctx.drawImage(bgImage, 0, 0, statisticsTheme.CANVAS_WIDTH, height);
  }

  if (logoBuffer) {
    const watermarkImg = await loadImage(logoBuffer);
    ctx.globalAlpha = statisticsTheme.WATERMARK_OPACITY;
    const w = statisticsTheme.WATERMARK_SIZE;
    ctx.drawImage(
      watermarkImg,
      (statisticsTheme.CANVAS_WIDTH - w) / 2,
      (height - w) / 2,
      w,
      w,
    );
    ctx.globalAlpha = 1;
  }

  ctx.font = `bold ${statisticsTheme.TITLE_FONT_SIZE}px ${statisticsTheme.FONT_FAMILY}`;
  const titleText = `ESTADÍSTICAS ${matchday}`;
  const titleWidth = ctx.measureText(titleText).width;
  ctx.fillStyle = statisticsTheme.TITLE_COLOR;
  ctx.fillText(
    titleText,
    (statisticsTheme.CANVAS_WIDTH - titleWidth) / 2,
    98 + statisticsTheme.TITLE_FONT_SIZE,
  );

  const { cardHeight } = getStatsCardDimensions(height);
  const horizontalInset = statisticsTheme.STATS_CARD_HORIZONTAL_INSET ?? 0;
  const cardWidth =
    statisticsTheme.CANVAS_WIDTH -
    statisticsTheme.PADDING * 2 -
    horizontalInset;
  const cardX = statisticsTheme.PADDING + horizontalInset / 2;
  const radius = statisticsTheme.STATS_CARD_RADIUS ?? 16;

  const blocksTotalHeight = height * 0.7;
  const startY = (height - blocksTotalHeight) / 2 + 30;
  let y = startY;

  const logoSize = 180;

  if (mostFailedMatch) {
    ctx.fillStyle = statisticsTheme.STATS_RECT_COLOR;
    drawRoundRect(ctx, cardX, y, cardWidth, cardHeight, radius);

    const content1Height =
      statisticsTheme.STATS_TITLE_FONT_SIZE + CONTENT_GAP + logoSize;
    const content1Top = y + (cardHeight - content1Height) / 2;

    const heading1Y = content1Top + statisticsTheme.STATS_TITLE_FONT_SIZE;
    ctx.font = `bold ${statisticsTheme.STATS_TITLE_FONT_SIZE}px ${statisticsTheme.FONT_FAMILY}`;
    ctx.fillStyle = statisticsTheme.TEXT_WHITE;
    const heading1 = "PARTIDO MÁS FALLADO";
    const heading1Width = ctx.measureText(heading1).width;
    ctx.fillText(
      heading1,
      (statisticsTheme.CANVAS_WIDTH - heading1Width) / 2,
      heading1Y,
    );

    const centerX = statisticsTheme.CANVAS_WIDTH / 2;
    const leftLogoX = centerX - logoSize - 80;
    const rightLogoX = centerX + 80;
    const logoY =
      content1Top + statisticsTheme.STATS_TITLE_FONT_SIZE + CONTENT_GAP;

    const homeLogoSource =
      mostFailedMatch.homeTeamLogoUrl ??
      mostFailedMatch.homeTeamImageName ??
      teamNameToImage[mostFailedMatch.homeTeam];
    const awayLogoSource =
      mostFailedMatch.awayTeamLogoUrl ??
      mostFailedMatch.awayTeamImageName ??
      teamNameToImage[mostFailedMatch.awayTeam];

    const mapping = { ...teamNameToImage };
    if (homeLogoSource) mapping[mostFailedMatch.homeTeam] = homeLogoSource;
    if (awayLogoSource) mapping[mostFailedMatch.awayTeam] = awayLogoSource;
    const homeResolved =
      homeLogoSource &&
      (await resolveTeamLogoSource(mostFailedMatch.homeTeam, mapping));
    const awayResolved =
      awayLogoSource &&
      (await resolveTeamLogoSource(mostFailedMatch.awayTeam, mapping));
    const homeLogoFile = homeResolved ?? homeLogoSource;
    const awayLogoFile = awayResolved ?? awayLogoSource;

    const homeLogoBuffer = homeLogoFile
      ? await loadTeamLogo(homeLogoFile, logoSize)
      : null;
    const awayLogoBuffer = awayLogoFile
      ? await loadTeamLogo(awayLogoFile, logoSize)
      : null;

    const logoPadding = 10;
    await drawTeamComponent(ctx, leftLogoX, logoY, logoSize, {
      logoBuffer: homeLogoBuffer,
      teamName: mostFailedMatch.homeTeam,
      bgColor:
        extractBgColorFromFilename(homeLogoFile) ??
        mostFailedMatch.homeTeamBgColor ??
        null,
      padding: logoPadding,
      theme: statisticsTheme,
    });

    ctx.font = `bold ${statisticsTheme.STATS_VS_FONT_SIZE}px ${statisticsTheme.FONT_FAMILY}`;
    ctx.fillStyle = statisticsTheme.TEXT_WHITE;
    ctx.fillText(
      "VS",
      centerX - 15,
      logoY + logoSize / 2 + statisticsTheme.STATS_VS_FONT_SIZE / 3,
    );

    await drawTeamComponent(ctx, rightLogoX, logoY, logoSize, {
      logoBuffer: awayLogoBuffer,
      teamName: mostFailedMatch.awayTeam,
      bgColor:
        extractBgColorFromFilename(awayLogoFile) ??
        mostFailedMatch.awayTeamBgColor ??
        null,
      padding: logoPadding,
      theme: statisticsTheme,
    });

    y += cardHeight + CARD_GAP;
  }

  ctx.fillStyle = statisticsTheme.STATS_RECT_COLOR;
  drawRoundRect(ctx, cardX, y, cardWidth, cardHeight, radius);

  const content2Height =
    statisticsTheme.STATS_TITLE_FONT_SIZE +
    TITLE_VALUE_GAP +
    statisticsTheme.STATS_VALUE_FONT_SIZE;
  const content2Top =
    y + (cardHeight - content2Height) / 2 - LAST_TWO_CARDS_CONTENT_OFFSET_UP;

  const heading2Y = content2Top + statisticsTheme.STATS_TITLE_FONT_SIZE;
  ctx.font = `bold ${statisticsTheme.STATS_TITLE_FONT_SIZE}px ${statisticsTheme.FONT_FAMILY}`;
  ctx.fillStyle = statisticsTheme.TEXT_WHITE;
  ctx.textAlign = "center";
  const heading2 = "MEDIA DE PUNTOS";
  ctx.fillText(heading2, statisticsTheme.CANVAS_WIDTH / 2, heading2Y);

  const value2Y =
    content2Top +
    statisticsTheme.STATS_TITLE_FONT_SIZE +
    TITLE_VALUE_GAP +
    statisticsTheme.STATS_VALUE_FONT_SIZE;
  ctx.font = `bold ${statisticsTheme.STATS_VALUE_FONT_SIZE}px ${statisticsTheme.FONT_FAMILY}`;
  ctx.fillStyle = statisticsTheme.TEXT_WHITE;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const value2 = String(averagePoints.toFixed(2));
  ctx.fillText(value2, statisticsTheme.CANVAS_WIDTH / 2, value2Y);

  y += cardHeight + CARD_GAP;

  const correctCount = mostFailedMatch?.correctGuessesCount ?? 0;
  ctx.fillStyle = statisticsTheme.STATS_RECT_COLOR;
  drawRoundRect(ctx, cardX, y, cardWidth, cardHeight, radius);

  const card3ContentHeight =
    statisticsTheme.STATS_TITLE_FONT_SIZE +
    TITLE_VALUE_GAP +
    statisticsTheme.STATS_VALUE_FONT_SIZE;
  const card3ContentTop =
    y +
    (cardHeight - card3ContentHeight) / 2 -
    LAST_TWO_CARDS_CONTENT_OFFSET_UP;
  const card3TitleY = card3ContentTop + statisticsTheme.STATS_TITLE_FONT_SIZE;
  const card3ValueY =
    card3ContentTop +
    statisticsTheme.STATS_TITLE_FONT_SIZE +
    TITLE_VALUE_GAP +
    statisticsTheme.STATS_VALUE_FONT_SIZE;
  const card3CenterX = statisticsTheme.CANVAS_WIDTH / 2;

  ctx.font = `bold ${statisticsTheme.STATS_TITLE_FONT_SIZE}px ${statisticsTheme.FONT_FAMILY}`;
  ctx.fillStyle = statisticsTheme.TEXT_WHITE;
  ctx.textAlign = "center";
  const card3Title = "ACIERTOS PARTIDO MÁS FALLADO";
  ctx.fillText(card3Title, card3CenterX, card3TitleY);

  ctx.font = `bold ${statisticsTheme.STATS_VALUE_FONT_SIZE}px ${statisticsTheme.FONT_FAMILY}`;
  ctx.fillStyle = statisticsTheme.TEXT_WHITE;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const card3Value = String(correctCount);
  ctx.fillText(card3Value, card3CenterX, card3ValueY);

  drawBrandingBottom(
    ctx,
    statisticsTheme.CANVAS_WIDTH,
    height,
    statisticsTheme,
  );

  return canvas.toDataURL("image/png");
}

module.exports = { renderStatistics };
