const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "assets");
const TEAMS_LOGOS_DIR = path.join(
  __dirname,
  "..",
  "..",
  "team-shields-curated",
);
const TEAMS_LOGOS_DIR1 = path.join(
  __dirname,
  "..",
  "..",
  "team-shields-pending",
);

const sharedBase = {
  ASSETS_DIR,
  TEAMS_LOGOS_DIR,
  TEAMS_LOGOS_DIR1,
  FONT_FAMILY: "Poppins",
  TEXT_WHITE: "#FFFFFF",
  TEXT_RED: "#e63946",
  WATERMARK_OPACITY: 0.3,
  WATERMARK_SIZE: 800,
};

const rankingTheme = {
  ...sharedBase,
  CANVAS_WIDTH: 1080,
  CANVAS_HEIGHT: 1350,
  RANKING_HEIGHT: 1350,
  ROW_HEIGHT: 100,

  TITLE_COLOR: "#f1d11c",
  LEAGUE_LABEL_COLOR: "rgba(255,255,255,0.64)",

  TITLE_FONT_SIZE: 69,
  LEADERBOARD_USER_FONT_SIZE: 28,
  LEADERBOARD_RESULT_FONT_SIZE: 40,
  LEAGUE_FONT_SIZE: 24,

  PADDING: 48,
  RANKING_CONTENT_INSET: 150,
  ROW_GAP: 8,
  LEAGUE_GAP: 20,
  LEADERBOARD_LOGO_SIZE: 70,
};

const matchResultsTheme = {
  ...sharedBase,
  CANVAS_WIDTH: 1080,
  CANVAS_HEIGHT: 1350,
  MATCH_RESULTS_HEIGHT: 1350,
  ROW_HEIGHT: 120,

  TITLE_COLOR: "#f1d11c",
  LEAGUE_LABEL_COLOR: "rgba(255,255,255,0.64)",
  STATS_CARD_COLOR: "rgba(0,0,0,0.0)",
  SCORE_RECT_COLOR: "rgba(255,255,255,0.7)",
  SCORE_TEXT_COLOR: "#000000",

  TITLE_FONT_SIZE: 69,
  RESULTS_FONT_SIZE: 40,
  TIEBREAKER_FONT_SIZE: 24,
  LEAGUE_FONT_SIZE: 24,
  APLAZADO_FONT_SIZE: 32,

  PADDING: 48,
  ROW_HEIGHT: 115,
  ROW_GAP: 18,
  LEAGUE_GAP: 20,
  LOGO_SIZE: 100,
  LEAGUE_LABEL_WIDTH: 80,
  LEAGUE_OFFSET: 200,
  MATCH_CONTENT_INSET: 200,
  MATCH_ROW_INSET: 5,
  SCORE_RECT_WIDTH: 350,
};

const statisticsTheme = {
  ...sharedBase,
  CANVAS_WIDTH: 1080,
  CANVAS_HEIGHT: 1350,
  STATISTICS_HEIGHT: 1350,

  ROW_HEIGHT: 100,
  TITLE_COLOR: "#f1d11c",
  STATS_CARD_COLOR: "rgba(0,0,0,0.7)",
  STATS_RECT_COLOR: "rgba(255,255,255,0.5)",
  STATS_CARD_RADIUS: 16,
  STATS_CARD_HORIZONTAL_INSET: 200,
  STATS_TITLE_FONT_SIZE: 32,
  STATS_VS_FONT_SIZE: 28,
  STATS_VALUE_FONT_SIZE: 110,

  TITLE_FONT_SIZE: 69,
  LEADERBOARD_LOGO_SIZE: 70,

  PADDING: 48,
};

const NO_SCALE_KEYS = new Set([
  "ASSETS_DIR",
  "TEAMS_LOGOS_DIR",
  "TEAMS_LOGOS_DIR1",
  "TITLE_COLOR",
  "LEAGUE_LABEL_COLOR",
  "SCORE_RECT_COLOR",
  "STATS_CARD_COLOR",
  "STATS_RECT_COLOR",
  "TEXT_WHITE",
  "TEXT_RED",
  "SCORE_TEXT_COLOR",
  "FONT_FAMILY",
  "WATERMARK_OPACITY",
]);

function getScaledTheme(theme, scale) {
  if (scale === 1 || !scale) return theme;
  const out = {};
  for (const [k, v] of Object.entries(theme)) {
    out[k] =
      NO_SCALE_KEYS.has(k) || typeof v !== "number" ? v : Math.round(v * scale);
  }
  return out;
}

module.exports = {
  ...sharedBase,
  sharedBase,
  rankingTheme,
  matchResultsTheme,
  statisticsTheme,
  getScaledTheme,
};
