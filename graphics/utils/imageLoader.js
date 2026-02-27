const sharp = require("sharp");
const path = require("path");
const { ASSETS_DIR } = require("../constants/theme");

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

async function loadTeamLogo(url) {
  if (!url) return null;
  try {
    const axios = require("axios");
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 5000,
    });
    const buffer = Buffer.from(response.data);
    return await sharp(buffer).resize(72, 72).png().toBuffer();
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
