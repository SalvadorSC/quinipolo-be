const axios = require("axios");

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
};

async function fetchHtml(url) {
  try {
    const response = await axios.get(url, { headers: DEFAULT_HEADERS });
    return response.data;
  } catch (error) {
    const reason =
      axios.isAxiosError(error) && error.code === "ERR_NETWORK"
        ? "Network access appears to be disabled."
        : "Unexpected fetch failure.";
    const message = `Failed to fetch ${url}. ${reason}`;
    throw new Error(message);
  }
}

module.exports = { fetchHtml };

