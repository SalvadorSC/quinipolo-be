const { loadImage } = require("canvas");
const {
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
  loadTeamLogo,
} = require("../utils/imageLoader");
const { createCanvasContext } = require("../utils/canvasSetup");
const theme = require("../constants/theme");

const SCORE_RECT_WIDTH = 180;
const SIDE_WIDTH = (theme.CANVAS_WIDTH - theme.PADDING * 2 - SCORE_RECT_WIDTH) / 2;

function drawPlaceholderCircle(ctx, x, y, size) {
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

async function renderMatchResults(payload) {
  const { matchday = "J16", matchesByLeague = [] } = payload;

  const totalMatches = matchesByLeague.reduce(
    (acc, g) => acc + (g.matches?.length || 0),
    0
  );
  const contentHeight = 160 + totalMatches * (theme.ROW_HEIGHT + theme.ROW_GAP)
    + matchesByLeague.length * theme.LEAGUE_GAP;
  const height = Math.max(theme.MATCH_RESULTS_HEIGHT, contentHeight);

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
  const titleText = `JORNADA ${matchday}`;
  const titleWidth = ctx.measureText(titleText).width;
  ctx.fillStyle = theme.TITLE_COLOR;
  ctx.fillText(titleText, (theme.CANVAS_WIDTH - titleWidth) / 2, 98 + theme.TITLE_FONT_SIZE);

  let y = 160;

  for (const group of matchesByLeague) {
    const leagueLabel = group.leagueId === "PLENO_15" ? "PLENO AL 15" : (group.leagueId || "");
    ctx.font = `${theme.LEAGUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.LEAGUE_LABEL_COLOR;
    ctx.fillText(leagueLabel, theme.PADDING, y + theme.ROW_HEIGHT / 2 + theme.LEAGUE_FONT_SIZE / 3);
    y += theme.ROW_HEIGHT + theme.ROW_GAP;

    const leftLogoX = theme.PADDING + (SIDE_WIDTH - theme.LOGO_SIZE) / 2;
    const scoreRectX = theme.PADDING + SIDE_WIDTH;
    const rightLogoX = theme.PADDING + SIDE_WIDTH + SCORE_RECT_WIDTH + (SIDE_WIDTH - theme.LOGO_SIZE) / 2;

    for (const match of group.matches || []) {
      let homeLogoImg = null;
      let awayLogoImg = null;
      if (match.homeTeamLogoUrl) {
        const buf = await loadTeamLogo(match.homeTeamLogoUrl);
        if (buf) homeLogoImg = await loadImage(buf);
      }
      if (match.awayTeamLogoUrl) {
        const buf = await loadTeamLogo(match.awayTeamLogoUrl);
        if (buf) awayLogoImg = await loadImage(buf);
      }

      if (homeLogoImg) {
        ctx.drawImage(homeLogoImg, leftLogoX, y + (theme.ROW_HEIGHT - theme.LOGO_SIZE) / 2, theme.LOGO_SIZE, theme.LOGO_SIZE);
      } else {
        drawPlaceholderCircle(ctx, leftLogoX, y + (theme.ROW_HEIGHT - theme.LOGO_SIZE) / 2, theme.LOGO_SIZE);
      }

      if (awayLogoImg) {
        ctx.drawImage(awayLogoImg, rightLogoX, y + (theme.ROW_HEIGHT - theme.LOGO_SIZE) / 2, theme.LOGO_SIZE, theme.LOGO_SIZE);
      } else {
        drawPlaceholderCircle(ctx, rightLogoX, y + (theme.ROW_HEIGHT - theme.LOGO_SIZE) / 2, theme.LOGO_SIZE);
      }

      ctx.fillStyle = theme.SCORE_RECT_COLOR;
      ctx.fillRect(
        scoreRectX,
        y + (theme.ROW_HEIGHT - 56) / 2,
        SCORE_RECT_WIDTH,
        56
      );

      if (match.status === "postponed") {
        ctx.font = `bold ${theme.APLAZADO_FONT_SIZE}px ${theme.FONT_FAMILY}`;
        ctx.fillStyle = theme.TEXT_RED;
        const label = match.statusLabel || "APLAZADO";
        const tw = ctx.measureText(label).width;
        ctx.fillText(label, scoreRectX + (SCORE_RECT_WIDTH - tw) / 2, y + theme.ROW_HEIGHT / 2 + theme.APLAZADO_FONT_SIZE / 3);
      } else {
        ctx.font = `bold ${theme.RESULTS_FONT_SIZE}px ${theme.FONT_FAMILY}`;
        ctx.fillStyle = theme.TEXT_WHITE;
        const scoreText = `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}`;
        const tw = ctx.measureText(scoreText).width;
        ctx.fillText(scoreText, scoreRectX + (SCORE_RECT_WIDTH - tw) / 2, y + theme.ROW_HEIGHT / 2 + theme.RESULTS_FONT_SIZE / 3);
      }

      y += theme.ROW_HEIGHT + theme.ROW_GAP;
    }
    y += theme.LEAGUE_GAP;
  }

  return canvas.toDataURL("image/png");
}

module.exports = { renderMatchResults };
