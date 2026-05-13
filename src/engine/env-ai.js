function readEnvTrim(name) {
  const value = process.env[name];
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getAnthropicApiKey() {
  return readEnvTrim('ANTHROPIC_API_KEY');
}

function getGeminiApiKey() {
  return readEnvTrim('GEMINI_API_KEY') || readEnvTrim('GOOGLE_API_KEY');
}

function getFalApiKey() {
  return readEnvTrim('FAL_API_KEY');
}

function isAnthropicConfigured() {
  return Boolean(getAnthropicApiKey());
}

function isFalConfigured() {
  return Boolean(getFalApiKey());
}

module.exports = {
  readEnvTrim,
  getAnthropicApiKey,
  getGeminiApiKey,
  getFalApiKey,
  isAnthropicConfigured,
  isFalConfigured
};
