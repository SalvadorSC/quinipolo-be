/**
 * Generates a special statistics image with:
 * - Puntuación media: 10.83
 * - Club las Encinas de Boadilla vs C.N. CABALLA CEUTA (most failed match)
 * - Explicit logo background colors for correct rendering
 *
 * Run from quinipolo-be: node scripts/generate-statistics-image.js
 * Requires backend to be running on port 3000.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const STATISTICS_PAYLOAD = {
  _meta: { matchday: "J18" },
  image5_statistics: {
    matchday: "J18",
    averagePoints: 10.83,
    mostFailedMatch: {
      matchNumber: 14,
      homeTeam: "C. Las Encinas De Boadilla M",
      awayTeam: "CN Caballa Ceuta",
      correctWinner: "CN Caballa Ceuta",
      mostWrongWinner: "C. Las Encinas De Boadilla M",
      failedPercentage: 97.5,
      wrongCount: 39,
      totalCount: 40,
      correctGuessesCount: 0,
    },
  },
};

const postData = JSON.stringify(STATISTICS_PAYLOAD);

const req = http.request(
  {
    hostname: "localhost",
    port: 3000,
    path: "/api/graphics/generate",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      if (res.statusCode !== 200) {
        console.error("Error:", res.statusCode, body);
        process.exit(1);
      }
      const result = JSON.parse(body);
      const images = result?.images || result;
      const image5 = images?.image5;
      if (!image5) {
        console.error(
          "No image5 in response. Keys:",
          Object.keys(result),
          "images keys:",
          result?.images ? Object.keys(result.images) : "n/a"
        );
        process.exit(1);
      }
      const base64 = image5.replace(/^data:image\/png;base64,/, "");
      const outPath = path.join(__dirname, "..", "quinipolo-statistics-J18.png");
      fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
      console.log("Saved:", outPath);
      console.log("Statistics image: Puntuación media 10.83, Club las Encinas vs C.N. CABALLA CEUTA");
    });
  }
);

req.on("error", (e) => {
  console.error("Request failed:", e.message);
  process.exit(1);
});

req.write(postData);
req.end();
