const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { ASSETS_DIR, TEAMS_LOGOS_DIR, TEAMS_LOGOS_DIR1 } = require("../constants/theme");
const { findLogoFileInDirs } = require("./teamLogoResolver");

const TEAMS_LOGO_DIRS = [TEAMS_LOGOS_DIR, TEAMS_LOGOS_DIR1].filter(Boolean);

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
      const ext = path.extname(urlOrImageName);
      const baseName = path.basename(urlOrImageName, ext);
      const baseUnderscore = baseName.replace(/\s+/g, "_");
      const candidates = [
        urlOrImageName,
        ...(baseName.endsWith("_100x100")
          ? []
          : [`${baseName}_100x100.png`, `${baseUnderscore}_100x100.png`]),
      ].filter((c, i, arr) => arr.indexOf(c) === i);
      let filePath = null;
      for (const dir of TEAMS_LOGO_DIRS) {
        for (const name of candidates) {
          const p = path.join(dir, name);
          if (fs.existsSync(p)) {
            filePath = p;
            break;
          }
        }
        if (filePath) break;
      }
      if (!filePath) {
        const resolved = findLogoFileInDirs(urlOrImageName);
        if (resolved) {
          for (const dir of TEAMS_LOGO_DIRS) {
            const p = path.join(dir, resolved);
            if (fs.existsSync(p)) {
              filePath = p;
              break;
            }
          }
        }
      }
      if (!filePath) return null;
      buffer = fs.readFileSync(filePath);
    }
    return await sharp(buffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
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
