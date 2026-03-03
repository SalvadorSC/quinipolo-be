const { loadImage } = require("canvas");
const {
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
  loadTeamLogo,
} = require("../utils/imageLoader");
const { createCanvasContext } = require("../utils/canvasSetup");
const theme = require("../constants/theme");
const { drawTeamComponent } = require("../components/teamComponent");
const { drawBrandingVertical } = require("../utils/drawBranding");

const teamNameToImage = require("../data/teamNameToImage.json");

const SCORE_RECT_WIDTH = 260;
const LEAGUE_LINE_X = theme.PADDING + theme.LEAGUE_LABEL_WIDTH + 100;
const MATCH_START_X = LEAGUE_LINE_X + 5;
const MATCH_CONTENT_WIDTH = theme.CANVAS_WIDTH - 2 * MATCH_START_X;
const MATCH_CONTENT_START_X = (theme.CANVAS_WIDTH - MATCH_CONTENT_WIDTH) / 2;
const SCORE_GAP = theme.SCORE_BLOCK_GAP ?? 20;
const MATCH_SIDE_WIDTH =
  (MATCH_CONTENT_WIDTH - SCORE_RECT_WIDTH - SCORE_GAP * 2) / 2;
const CARD_RADIUS = 12;

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

async function renderMatchResults(payload, options = {}) {
  const { matchday = "J16", matchesByLeague = [] } = payload;
  const { hideTitle = false } = options;

  const totalMatches = matchesByLeague.reduce(
    (acc, g) => acc + (g.matches?.length || 0),
    0,
  );
  const blocksContentHeight =
    totalMatches * (theme.ROW_HEIGHT + theme.ROW_GAP) +
    matchesByLeague.length * theme.LEAGUE_GAP;
  const titleAreaHeight = hideTitle ? 0 : 160;
  const minContentHeight = titleAreaHeight + blocksContentHeight;
  const height = Math.max(theme.MATCH_RESULTS_HEIGHT, minContentHeight);

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

  if (!hideTitle) {
    ctx.font = `bold ${theme.TITLE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    const titleText = `JORNADA ${matchday}`;
    const titleWidth = ctx.measureText(titleText).width;
    ctx.fillStyle = theme.TITLE_COLOR;
    ctx.fillText(
      titleText,
      (theme.CANVAS_WIDTH - titleWidth) / 2,
      98 + theme.TITLE_FONT_SIZE,
    );
  }

  const leagueLineX = LEAGUE_LINE_X;
  const contentStartY = hideTitle
    ? (height - blocksContentHeight) / 2
    : titleAreaHeight + (height - titleAreaHeight - blocksContentHeight) / 2;
  let y = contentStartY;

  for (const group of matchesByLeague) {
    const blockStartY = y;
    const matchStartX = MATCH_CONTENT_START_X;
    const leftLogoX = matchStartX + (MATCH_SIDE_WIDTH - theme.LOGO_SIZE) / 2;
    const scoreRectX = matchStartX + MATCH_SIDE_WIDTH + SCORE_GAP;
    const rightLogoX =
      scoreRectX +
      SCORE_RECT_WIDTH +
      SCORE_GAP +
      (MATCH_SIDE_WIDTH - theme.LOGO_SIZE) / 2;

    for (const match of group.matches || []) {
      ctx.fillStyle = theme.STATS_CARD_COLOR;
      drawRoundRect(
        ctx,
        matchStartX,
        y,
        MATCH_CONTENT_WIDTH,
        theme.ROW_HEIGHT,
        CARD_RADIUS,
      );

      const homeLogoSource =
        match.homeTeamLogoUrl ??
        match.homeTeamImageName ??
        teamNameToImage[match.homeTeam];
      const awayLogoSource =
        match.awayTeamLogoUrl ??
        match.awayTeamImageName ??
        teamNameToImage[match.awayTeam];

      const homeLogoBuffer = homeLogoSource
        ? await loadTeamLogo(homeLogoSource, theme.LOGO_SIZE)
        : null;
      const awayLogoBuffer = awayLogoSource
        ? await loadTeamLogo(awayLogoSource, theme.LOGO_SIZE)
        : null;

      const logoY = y + (theme.ROW_HEIGHT - theme.LOGO_SIZE) / 2;

      await drawTeamComponent(ctx, leftLogoX, logoY, theme.LOGO_SIZE, {
        logoBuffer: homeLogoBuffer,
        teamName: match.homeTeam,
        bgColor: match.homeTeamBgColor ?? null,
      });

      await drawTeamComponent(ctx, rightLogoX, logoY, theme.LOGO_SIZE, {
        logoBuffer: awayLogoBuffer,
        teamName: match.awayTeam,
        bgColor: match.awayTeamBgColor ?? null,
      });

      ctx.fillStyle = theme.SCORE_RECT_COLOR;
      ctx.fillRect(scoreRectX, y, SCORE_RECT_WIDTH, theme.ROW_HEIGHT);

      if (match.status === "postponed") {
        ctx.font = `bold ${theme.APLAZADO_FONT_SIZE}px ${theme.FONT_FAMILY}`;
        ctx.fillStyle = theme.TEXT_RED;
        const label = match.statusLabel || "APLAZADO";
        const tw = ctx.measureText(label).width;
        ctx.fillText(
          label,
          scoreRectX + (SCORE_RECT_WIDTH - tw) / 2,
          y + theme.ROW_HEIGHT / 2 + theme.APLAZADO_FONT_SIZE / 3,
        );
      } else {
        ctx.font = `bold ${theme.RESULTS_FONT_SIZE}px ${theme.FONT_FAMILY}`;
        ctx.fillStyle = theme.TEXT_WHITE;
        const homeStr = String(match.homeScore ?? "-");
        const awayStr = String(match.awayScore ?? "-");
        const scoreCenterX = scoreRectX + SCORE_RECT_WIDTH / 2;
        const scoreY = y + theme.ROW_HEIGHT / 2;
        const hyphenGap = 10;
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        ctx.fillText(homeStr, scoreCenterX - hyphenGap, scoreY);
        ctx.textAlign = "center";
        ctx.fillText(" - ", scoreCenterX, scoreY);
        ctx.textAlign = "left";
        ctx.fillText(awayStr, scoreCenterX + hyphenGap, scoreY);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      y += theme.ROW_HEIGHT + theme.ROW_GAP;
    }
    const blockEndY = y - theme.ROW_GAP;
    const blockCenterY = (blockStartY + blockEndY) / 2;

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(leagueLineX, blockStartY);
    ctx.lineTo(leagueLineX, blockEndY);
    ctx.stroke();

    const leagueLabel =
      group.leagueId === "PLENO_15" ? "PLENO AL 15" : group.leagueId || "";
    const leagueSubLabel =
      group.leagueSubLabel ?? (group.leagueId === "PLENO_15" ? "PDM" : null);
    ctx.font = `bold ${theme.LEAGUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    ctx.fillStyle = theme.LEAGUE_LABEL_COLOR;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const lineHeight = theme.LEAGUE_FONT_SIZE + 4;
    const totalLines = leagueSubLabel ? 2 : 1;
    const offsetY = leagueSubLabel ? lineHeight / 2 : 0;
    ctx.fillText(leagueLabel, leagueLineX - 8, blockCenterY - offsetY);
    if (leagueSubLabel) {
      ctx.font = `bold ${theme.LEAGUE_FONT_SIZE - 4}px ${theme.FONT_FAMILY}`;
      ctx.fillText(
        leagueSubLabel,
        leagueLineX - 8,
        blockCenterY + lineHeight / 2,
      );
      ctx.font = `bold ${theme.LEAGUE_FONT_SIZE}px ${theme.FONT_FAMILY}`;
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    y += theme.LEAGUE_GAP;
  }

  drawBrandingVertical(ctx, theme.CANVAS_WIDTH, height);

  return canvas.toDataURL("image/png");
}

module.exports = { renderMatchResults };
