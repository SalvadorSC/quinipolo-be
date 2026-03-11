const express = require("express");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const router = express.Router();
const { TEAMS_LOGOS_DIR, TEAMS_LOGOS_DIR1 } = require("../graphics/constants/theme");
const { clearLogoIndex } = require("../graphics/utils/teamLogoResolver");

const TEAMS_LOGO_DIRS = [TEAMS_LOGOS_DIR, TEAMS_LOGOS_DIR1].filter(Boolean);
const VALID_EXT = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const HEX_REGEX = /^[0-9A-Fa-f]{6}$/;

function isSafeFilename(name) {
  if (!name || typeof name !== "string") return false;
  const base = path.basename(name);
  return base === name && !base.includes("..");
}

function findLogoPath(filename) {
  for (const dir of TEAMS_LOGO_DIRS) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

router.post("/clear-cache", (req, res) => {
  try {
    clearLogoIndex();
    res.json({ success: true, message: "Logo index cache cleared" });
  } catch (err) {
    console.error("Clear logo cache error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/logos", (req, res) => {
  try {
    const seen = new Set();
    const logos = [];
    for (const dir of [...TEAMS_LOGO_DIRS].reverse()) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!VALID_EXT.includes(ext)) continue;
        if (seen.has(file)) continue;
        seen.add(file);
        logos.push(file);
      }
    }
    logos.sort((a, b) => a.localeCompare(b));
    res.json({ logos });
  } catch (err) {
    console.error("Logo mapper list error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/logos/rename", async (req, res) => {
  const { filename, hex } = req.body || {};
  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  if (!hex || !HEX_REGEX.test(hex)) {
    return res.status(400).json({ error: "Invalid hex (expected 6 hex chars)" });
  }
  const srcPath = findLogoPath(filename);
  if (!srcPath) {
    return res.status(404).json({ error: "Logo not found" });
  }
  let width = 0;
  let height = 0;
  try {
    const metadata = await sharp(srcPath).metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;
  } catch (err) {
    console.error("Logo metadata error:", err);
    return res.status(500).json({ error: "Could not read image dimensions" });
  }
  if (!width || !height) {
    return res.status(500).json({ error: "Could not determine image dimensions" });
  }
  const dir = path.dirname(srcPath);
  const ext = path.extname(filename);
  let base = path.basename(filename, ext);
  base = base.replace(/_[0-9A-Fa-f]{6}$/i, "").replace(/_\d+x\d+$/i, "");
  const pxPart = `_${width}x${height}`;
  const newFilename = `${base}${pxPart}_${hex.toLowerCase()}${ext}`;
  const destPath = path.join(dir, newFilename);
  if (destPath === srcPath) {
    return res.json({ success: true, filename: newFilename });
  }
  try {
    fs.renameSync(srcPath, destPath);
    clearLogoIndex();
    res.json({ success: true, filename: newFilename });
  } catch (err) {
    console.error("Logo rename error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/logos/:filename", (req, res) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filePath = findLogoPath(filename);
  if (!filePath) {
    return res.status(404).json({ error: "Logo not found" });
  }
  try {
    fs.unlinkSync(filePath);
    clearLogoIndex();
    res.json({ success: true });
  } catch (err) {
    console.error("Logo delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/logos/:filename/image", (req, res) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filePath = findLogoPath(filename);
  if (!filePath) {
    return res.status(404).json({ error: "Logo not found" });
  }
  res.sendFile(filePath);
});

module.exports = router;
