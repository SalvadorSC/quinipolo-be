const { loadImage } = require("canvas");
const {
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
  loadTeamLogo,
} = require("../utils/imageLoader");
const { createCanvasContext } = require("../utils/canvasSetup");
const { matchResultsTheme, getScaledTheme } = require("../constants/theme");
const { drawTeamComponent } = require("../components/teamComponent");
const { drawBrandingVertical } = require("../utils/drawBranding");

const teamNameToImage = require("../data/teamNameToImage.json");
const {
  resolveTeamLogoSource,
  extractBgColorFromFilename,
} = require("../utils/teamLogoResolver");

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
  const { hideTitle = false, scale = 1 } = options;
  const t =
    scale !== 1 ? getScaledTheme(matchResultsTheme, scale) : matchResultsTheme;

  const scoreRectWidth = t.SCORE_RECT_WIDTH;
  const logoSize = t.ROW_HEIGHT;
  const leagueLineX = t.PADDING + t.LEAGUE_LABEL_WIDTH + 100;
  const matchContentWidth = 2 * logoSize + scoreRectWidth;
  const matchContentStartX = (t.CANVAS_WIDTH - matchContentWidth) / 2;

  const totalMatches = matchesByLeague.reduce(
    (acc, g) => acc + (g.matches?.length || 0),
    0,
  );
  const blocksContentHeight =
    totalMatches * (t.ROW_HEIGHT + t.ROW_GAP) +
    matchesByLeague.length * t.LEAGUE_GAP;
  const titleAreaHeight = hideTitle ? 0 : Math.round(160 * scale);
  const minContentHeight = titleAreaHeight + blocksContentHeight;
  const height = Math.max(t.MATCH_RESULTS_HEIGHT, minContentHeight);

  const { canvas, ctx } = createCanvasContext(t.CANVAS_WIDTH, height);

  const [bgBuffer, logoBuffer] = await Promise.all([
    loadBackgroundBuffer(t.CANVAS_WIDTH, height),
    loadLogoWatermarkBuffer(t.WATERMARK_SIZE),
  ]);

  if (bgBuffer) {
    const bgImage = await loadImage(bgBuffer);
    ctx.drawImage(bgImage, 0, 0, t.CANVAS_WIDTH, height);
  }

  if (logoBuffer) {
    const watermarkImg = await loadImage(logoBuffer);
    ctx.globalAlpha = t.WATERMARK_OPACITY;
    const w = t.WATERMARK_SIZE;
    ctx.drawImage(
      watermarkImg,
      (t.CANVAS_WIDTH - w) / 2,
      (height - w) / 2,
      w,
      w,
    );
    ctx.globalAlpha = 1;
  }

  if (!hideTitle) {
    ctx.font = `bold ${t.TITLE_FONT_SIZE}px ${t.FONT_FAMILY}`;
    const titleText = `JORNADA ${matchday}`;
    const titleWidth = ctx.measureText(titleText).width;
    ctx.fillStyle = t.TITLE_COLOR;
    ctx.fillText(
      titleText,
      (t.CANVAS_WIDTH - titleWidth) / 2,
      Math.round(98 * scale) + t.TITLE_FONT_SIZE,
    );
  }

  const contentStartY = hideTitle
    ? (height - blocksContentHeight) / 2
    : titleAreaHeight + (height - titleAreaHeight - blocksContentHeight) / 2;
  let y = contentStartY;

  for (const group of matchesByLeague) {
    const blockStartY = y;
    const leftLogoX = matchContentStartX;
    const scoreRectX = matchContentStartX + logoSize;
    const rightLogoX = matchContentStartX + logoSize + scoreRectWidth;

    for (const match of group.matches || []) {
      ctx.fillStyle = t.STATS_CARD_COLOR;
      const cardRadius = Math.round(12 * scale);
      drawRoundRect(
        ctx,
        matchContentStartX,
        y,
        matchContentWidth,
        t.ROW_HEIGHT,
        cardRadius,
      );

      const homeLogoSource =
        match.homeTeamLogoUrl ??
        match.homeTeamImageName ??
        (await resolveTeamLogoSource(match.homeTeam, teamNameToImage));
      const awayLogoSource =
        match.awayTeamLogoUrl ??
        match.awayTeamImageName ??
        (await resolveTeamLogoSource(match.awayTeam, teamNameToImage));

      const homeLogoBuffer = homeLogoSource
        ? await loadTeamLogo(homeLogoSource, logoSize)
        : null;
      const awayLogoBuffer = awayLogoSource
        ? await loadTeamLogo(awayLogoSource, logoSize)
        : null;

      const logoY = y;

      await drawTeamComponent(ctx, leftLogoX, logoY, logoSize, {
        logoBuffer: homeLogoBuffer,
        teamName: match.homeTeam,
        bgColor:
          extractBgColorFromFilename(homeLogoSource) ??
          match.homeTeamBgColor ??
          null,
        theme: t,
        radius: 0,
        padding: 12,
      });

      await drawTeamComponent(ctx, rightLogoX, logoY, logoSize, {
        logoBuffer: awayLogoBuffer,
        teamName: match.awayTeam,
        bgColor:
          extractBgColorFromFilename(awayLogoSource) ??
          match.awayTeamBgColor ??
          null,
        theme: t,
        radius: 0,
        padding: 12,
      });

      ctx.fillStyle = t.SCORE_RECT_COLOR;
      ctx.fillRect(scoreRectX, y, scoreRectWidth, t.ROW_HEIGHT);

      if (match.status === "postponed") {
        ctx.font = `bold ${t.APLAZADO_FONT_SIZE}px ${t.FONT_FAMILY}`;
        ctx.fillStyle = t.TEXT_RED;
        const label = match.statusLabel || "APLAZADO";
        const tw = ctx.measureText(label).width;
        ctx.fillText(
          label,
          scoreRectX + (scoreRectWidth - tw) / 2,
          y + t.ROW_HEIGHT / 2 + t.APLAZADO_FONT_SIZE / 3,
        );
      } else {
        const hasTie =
          match.regularGoalsHomeTeam != null &&
          match.regularGoalsAwayTeam != null &&
          match.homeScore != null &&
          match.awayScore != null;
        const scoreCenterX = scoreRectX + scoreRectWidth / 2;
        const hyphenGap = 20;
        const hyphenGapTie = 10;

        if (hasTie) {
          const mainY = y + t.ROW_HEIGHT / 2;
          const tieBoxTop = y + t.ROW_HEIGHT * 0.8;
          const tieBoxHeight = t.ROW_HEIGHT * 0.35;
          const tieY = tieBoxTop + tieBoxHeight / 2;

          ctx.font = `bold ${t.RESULTS_FONT_SIZE}px ${t.FONT_FAMILY}`;
          ctx.fillStyle = t.SCORE_TEXT_COLOR;
          ctx.textBaseline = "middle";
          ctx.textAlign = "right";
          ctx.fillText(
            String(match.regularGoalsHomeTeam),
            scoreCenterX - hyphenGap,
            mainY,
          );
          ctx.textAlign = "center";
          ctx.fillText(" - ", scoreCenterX, mainY);
          ctx.textAlign = "left";
          ctx.fillText(
            String(match.regularGoalsAwayTeam),
            scoreCenterX + hyphenGap,
            mainY,
          );

          const tieBoxWidth = Math.min(100, scoreRectWidth * 0.4);
          const tieBoxX = scoreCenterX - tieBoxWidth / 2;
          ctx.fillStyle = "#FFFFFF";
          drawRoundRect(
            ctx,
            tieBoxX,
            tieBoxTop,
            tieBoxWidth,
            tieBoxHeight - 4,
            6,
          );
          ctx.fillStyle = t.SCORE_TEXT_COLOR;
          ctx.font = `bold ${t.TIEBREAKER_FONT_SIZE}px ${t.FONT_FAMILY}`;
          ctx.textAlign = "right";
          ctx.fillText(
            String(match.homeScore),
            scoreCenterX - hyphenGapTie,
            tieY,
          );
          ctx.textAlign = "center";
          ctx.fillText(" - ", scoreCenterX, tieY);
          ctx.textAlign = "left";
          ctx.fillText(
            String(match.awayScore),
            scoreCenterX + hyphenGapTie,
            tieY,
          );
        } else {
          ctx.font = `bold ${t.RESULTS_FONT_SIZE}px ${t.FONT_FAMILY}`;
          ctx.fillStyle = t.SCORE_TEXT_COLOR;
          const homeStr = String(match.homeScore);
          const awayStr = String(match.awayScore);
          const scoreY = y + t.ROW_HEIGHT / 2;
          ctx.textBaseline = "middle";
          ctx.textAlign = "right";
          ctx.fillText(homeStr, scoreCenterX - hyphenGap, scoreY);
          ctx.textAlign = "center";
          ctx.fillText(" - ", scoreCenterX, scoreY);
          ctx.textAlign = "left";
          ctx.fillText(awayStr, scoreCenterX + hyphenGap, scoreY);
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      y += t.ROW_HEIGHT + t.ROW_GAP;
    }
    const blockEndY = y - t.ROW_GAP;
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
    ctx.font = `bold ${t.LEAGUE_FONT_SIZE}px ${t.FONT_FAMILY}`;
    ctx.fillStyle = t.LEAGUE_LABEL_COLOR;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const lineHeight = t.LEAGUE_FONT_SIZE + 4;
    const totalLines = leagueSubLabel ? 2 : 1;
    const offsetY = leagueSubLabel ? lineHeight / 2 : 0;
    ctx.fillText(leagueLabel, leagueLineX - 8, blockCenterY - offsetY);
    if (leagueSubLabel) {
      ctx.font = `bold ${t.LEAGUE_FONT_SIZE - 4}px ${t.FONT_FAMILY}`;
      ctx.fillText(
        leagueSubLabel,
        leagueLineX - 8,
        blockCenterY + lineHeight / 2,
      );
      ctx.font = `bold ${t.LEAGUE_FONT_SIZE}px ${t.FONT_FAMILY}`;
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    y += t.LEAGUE_GAP;
  }

  drawBrandingVertical(ctx, t.CANVAS_WIDTH, height, t);

  return canvas.toDataURL("image/png");
}

module.exports = { renderMatchResults };
