const { generateGraphics } = require("../graphics");

async function generate(req, res) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Request body must be a JSON payload" });
    }

    const { matchday, images } = await generateGraphics(payload);
    res.status(200).json({ matchday, images });
  } catch (error) {
    console.error("Graphics generation error:", error);
    res.status(500).json({
      error: "Failed to generate graphics",
      message: error.message,
    });
  }
}

module.exports = { generate };
