const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { ASSETS_DIR, TEAMS_LOGOS_DIR } = require("../constants/theme");

async function rasterizeSvg(svgPath, width, height) {
  try {
    const buffer = await sharp(svgPath)
      .resize(width, height)
      .png()
      .toBuffer();
    return buffer;
  } catch (err) {
    console.warn("Failed to rasterize SVG:", svgPath, err.message);
    return null;
  }
}

async function loadBackgroundBuffer(targetWidth, targetHeight) {
  const bgPath = path.join(ASSETS_DIR, "dark_bg.svg");
  return rasterizeSvg(bgPath, targetWidth, targetHeight);
}

async function loadLogoWatermarkBuffer(size = 400) {
  const logoPath = path.join(ASSETS_DIR, "logo_watermark.svg");
  return rasterizeSvg(logoPath, size, size);
}

const DEFAULT_LOGO_SIZE = 72;

async function loadTeamLogo(urlOrImageName, size = DEFAULT_LOGO_SIZE) {
  if (!urlOrImageName) return null;
  try {
    const isUrl = /^https?:\/\//i.test(urlOrImageName);
    let buffer;
    if (isUrl) {
      const axios = require("axios");
      const response = await axios.get(urlOrImageName, {
        responseType: "arraybuffer",
        timeout: 5000,
      });
      buffer = Buffer.from(response.data);
    } else {
      const filePath = path.join(TEAMS_LOGOS_DIR, urlOrImageName);
      if (!fs.existsSync(filePath)) return null;
      buffer = fs.readFileSync(filePath);
    }
    return await sharp(buffer).resize(size, size).png().toBuffer();
  } catch {
    return null;
  }
}

module.exports = {
  rasterizeSvg,
  loadBackgroundBuffer,
  loadLogoWatermarkBuffer,
  loadTeamLogo,
};
