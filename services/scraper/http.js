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
    throw new Error(fetchErrorMessage(url, error));
  }
}

async function fetchJson(url, options = {}) {
  try {
    const response = await axios.get(url, {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: "application/json",
      },
      timeout: options.timeout ?? 15000,
    });
    return response.data;
  } catch (error) {
    throw new Error(fetchErrorMessage(url, error));
  }
}

function fetchErrorMessage(url, error) {
  const reason =
    axios.isAxiosError(error) && error.code === "ERR_NETWORK"
      ? "Network access appears to be disabled."
      : axios.isAxiosError(error) && error.code === "ECONNABORTED"
        ? "The request timed out."
        : "Unexpected fetch failure.";
  return `Failed to fetch ${url}. ${reason}`;
}

module.exports = { fetchHtml, fetchJson };

