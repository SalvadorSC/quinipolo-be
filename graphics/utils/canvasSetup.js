const path = require("path");
const { createCanvas } = require("canvas");
const { registerFont } = require("canvas");
const { ASSETS_DIR } = require("../constants/theme");

const FONTS_DIR = path.join(ASSETS_DIR, "fonts");

function registerPoppins() {
  try {
    registerFont(path.join(FONTS_DIR, "Poppins-Regular.ttf"), {
      family: "Poppins",
      weight: "normal",
    });
    registerFont(path.join(FONTS_DIR, "Poppins-Bold.ttf"), {
      family: "Poppins",
      weight: "bold",
    });
  } catch (err) {
    console.warn("Failed to register Poppins font:", err.message);
  }
}

function createCanvasContext(width, height) {
  registerPoppins();
  const canvas = createCanvas(width, height);
  return { canvas, ctx: canvas.getContext("2d") };
}

module.exports = {
  registerPoppins,
  createCanvasContext,
  createCanvas,
};
