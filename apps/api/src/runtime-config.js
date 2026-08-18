const fs = require('node:fs');
const path = require('node:path');

function parseEnvFile(filePath) {
  if (!filePath) {
    return {};
  }

  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return values;
}

function resolveRuntimeConfig(env = {}, options = {}) {
  const envFilePath = options.envFilePath || path.join(process.cwd(), '.env');
  const fileValues = parseEnvFile(envFilePath);
  const merged = { ...fileValues, ...env };

  return {
    port: Number(merged.PORT) || 3000,
    webPort: Number(merged.WEB_PORT) || 8080,
    apiBaseUrl: merged.API_BASE_URL || 'http://127.0.0.1:3000',
    databaseUrl: merged.DATABASE_URL || '',
    envFilePath
  };
}

module.exports = {
  parseEnvFile,
  resolveRuntimeConfig
};
