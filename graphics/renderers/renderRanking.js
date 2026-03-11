const { loadImage } = require("canvas");
const {
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
} = require("../utils/imageLoader");
const { createCanvasContext } = require("../utils/canvasSetup");
const { rankingTheme } = require("../constants/theme");
const { drawBrandingVertical } = require("../utils/drawBranding");

const MEDAL_LABELS = { 1: "1", 2: "2", 3: "3" };
const MEDAL_COLORS = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };

/** Max number of rows to show per ranking image. */
const RANKING_CAP = 10;

function getRankDisplay(rank) {
  return MEDAL_LABELS[rank] ?? String(rank);
}

function getRankColor(rank) {
  return MEDAL_COLORS[rank] ?? null;
}

/**
 * Mirrors FE utils/ranking.ts computeRanks: stable ranks with ties (first index for a score → rank).
 */
function computeRanks(list, scoreOf) {
  const withScore = list.map((row, idx) => ({
    row,
    idx,
    score: scoreOf(row),
  }));
  withScore.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  const scoreToFirstRank = new Map();
  const ranks = new Map();
  withScore.forEach((item, sortedIdx) => {
    const existing = scoreToFirstRank.get(item.score);
    const rank = existing !== undefined ? existing : sortedIdx + 1;
    if (existing === undefined) scoreToFirstRank.set(item.score, rank);
    ranks.set(item.row, rank);
  });
  return ranks;
}

async function renderRanking(payload, rankingType = "quinipolo") {
  const {
    matchday = "J16",
    participants = [],
    participantsLeaderboard = [],
  } = payload;
  let list = participants.length ? participants : participantsLeaderboard;
  const scoreOf = (entry) => Number(entry.points ?? entry.totalPoints ?? 0);
  const ranks = computeRanks(list, scoreOf);
  // Sort by score desc (stable), cap at RANKING_CAP for display
  const sorted = [...list].sort((a, b) => {
    const diff = scoreOf(b) - scoreOf(a);
    return diff !== 0 ? diff : 0;
  });
  const listToShow = sorted.slice(0, RANKING_CAP);

  const { canvas, ctx } = createCanvasContext(
    rankingTheme.CANVAS_WIDTH,
    rankingTheme.RANKING_HEIGHT,
  );

  const [bgBuffer, logoBuffer] = await Promise.all([
    loadBackgroundBuffer(rankingTheme.CANVAS_WIDTH, rankingTheme.RANKING_HEIGHT),
    loadLogoWatermarkBuffer(rankingTheme.WATERMARK_SIZE),
  ]);

  if (bgBuffer) {
    const bgImage = await loadImage(bgBuffer);
    ctx.drawImage(bgImage, 0, 0, rankingTheme.CANVAS_WIDTH, rankingTheme.RANKING_HEIGHT);
  }

  if (logoBuffer) {
    const watermarkImg = await loadImage(logoBuffer);
    ctx.globalAlpha = rankingTheme.WATERMARK_OPACITY;
    const w = rankingTheme.WATERMARK_SIZE;
    ctx.drawImage(
      watermarkImg,
      (rankingTheme.CANVAS_WIDTH - w) / 2,
      (rankingTheme.RANKING_HEIGHT - w) / 2,
      w,
      w,
    );
    ctx.globalAlpha = 1;
  }

  const titleText =
    rankingType === "general"
      ? `RANKING GENERAL ${matchday}`
      : `RANKING ${matchday}`;
  ctx.font = `bold ${rankingTheme.TITLE_FONT_SIZE}px ${rankingTheme.FONT_FAMILY}`;
  const titleWidth = ctx.measureText(titleText).width;
  ctx.fillStyle = rankingTheme.TITLE_COLOR;
  ctx.fillText(
    titleText,
    (rankingTheme.CANVAS_WIDTH - titleWidth) / 2,
    98 + rankingTheme.TITLE_FONT_SIZE,
  );

  // Small quinipolo logo in corner (commented out)
  // if (logoBuffer) {
  //   const logoImg = await loadImage(logoBuffer);
  //   const cornerLogoSize = Math.round(rankingTheme.LEADERBOARD_LOGO_SIZE * 1.5);
  //   ctx.globalAlpha = 1;
  //   ctx.drawImage(
  //     logoImg,
  //     rankingTheme.CANVAS_WIDTH - rankingTheme.PADDING - cornerLogoSize,
  //     rankingTheme.RANKING_HEIGHT - rankingTheme.PADDING - cornerLogoSize,
  //     cornerLogoSize,
  //     cornerLogoSize,
  //   );
  // }

  const rowHeight = rankingTheme.ROW_HEIGHT;
  const rowGap = rankingTheme.ROW_GAP;
  const inset = rankingTheme.RANKING_CONTENT_INSET ?? 0;
  const leftX = rankingTheme.PADDING + inset;
  const rightX = rankingTheme.CANVAS_WIDTH - rankingTheme.PADDING - inset;
  const rankColumnWidth = 50;
  const usernameX = leftX + rankColumnWidth + 20;
  const startY = 200;

  ctx.font = `bold ${rankingTheme.LEADERBOARD_RESULT_FONT_SIZE}px ${rankingTheme.FONT_FAMILY}`;
  ctx.fillStyle = rankingTheme.TEXT_WHITE;

  drawBrandingVertical(ctx, rankingTheme.CANVAS_WIDTH, rankingTheme.RANKING_HEIGHT, rankingTheme);

  listToShow.forEach((entry, i) => {
    const y = startY + i * (rowHeight + rowGap);
    // Prefer BE-computed rank so tied scores show the same position number
    const rank = ranks.get(entry) ?? entry.rank ?? i + 1;
    const rankDisplay = getRankDisplay(rank);
    const username = entry.username || "—";
    const points = String(entry.points ?? entry.totalPoints ?? 0);

    const rankColor = getRankColor(rank);
    if (rankColor) ctx.fillStyle = rankColor;
    ctx.fillText(
      rankDisplay,
      leftX,
      y + rowHeight / 2 + rankingTheme.LEADERBOARD_RESULT_FONT_SIZE / 3,
    );
    if (rankColor) ctx.fillStyle = rankingTheme.TEXT_WHITE;

    const usernameFontSize = rankingTheme.LEADERBOARD_USER_FONT_SIZE + 4;
    ctx.font = `${usernameFontSize}px ${rankingTheme.FONT_FAMILY}`;
    ctx.fillText(
      username,
      usernameX,
      y + rowHeight / 2 + usernameFontSize / 3,
    );

    ctx.font = `bold ${rankingTheme.LEADERBOARD_RESULT_FONT_SIZE}px ${rankingTheme.FONT_FAMILY}`;
    const pointsWidth = ctx.measureText(points).width;
    ctx.fillText(
      points,
      rightX - pointsWidth,
      y + rowHeight / 2 + rankingTheme.LEADERBOARD_RESULT_FONT_SIZE / 3,
    );

    if (i < listToShow.length - 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(leftX, y + rowHeight);
      ctx.lineTo(rightX, y + rowHeight);
      ctx.stroke();
    }
  });

  return canvas.toDataURL("image/png");
}

module.exports = { renderRanking };
