const { randomUUID } = require('crypto');
const { blueprintById } = require('../../platform/catalog');

function resolveActiveModuleIds(context = {}) {
  const explicit = (context.enabledModules || []).map((v) => String(v || '').trim()).filter(Boolean);
  if (explicit.length > 0) return explicit;
  const blueprint = context.blueprint || {};
  return (blueprint.enabledModules || []).map((v) => String(v || '').trim()).filter(Boolean);
}
const {
  readWorkspaceSetting,
  writeWorkspaceSetting,
  getWorkspaceSettingsSnapshot,
  upsertWorkspaceRegistryRow,
  getWorkspaceRegistrySnapshot,
  resetWorkspaceStorage
} = require('../../db');

const WORKSPACE_MODE_BUILDER = 'builder';
const WORKSPACE_MODE_MEMBER = 'member';
const DEFAULT_ENGINE_VERSION = '1.0.0';
const DEFAULT_TEMPLATE_RELEASE_DATE = '2026-07-14';
const DEFAULT_BLUEPRINT_ID = 'operational_distributor';
const DEFAULT_BLUEPRINT_NAME = 'Distributor Benih Ikan Air Tawar';
const DEFAULT_BLUEPRINT_CATEGORY = 'Operational';
const DEFAULT_AI_TYPES = ['purchase', 'sale', 'expense'];

function normalizeSettings(settings = {}) {
  return {
    WorkspaceId: String(settings.WorkspaceId || settings.workspaceId || '').trim(),
    NamaPerusahaan: String(settings.NamaPerusahaan || settings.workspaceName || '').trim(),
    BlueprintId: String(settings.BlueprintId || settings.blueprintId || '').trim(),
    TemplateId: String(settings.TemplateId || settings.templateId || '').trim(),
    TemplateVersion: String(settings.TemplateVersion || settings.templateVersion || '').trim(),
    TemplateName: String(settings.TemplateName || settings.templateName || '').trim(),
    TemplateReleaseDate: String(settings.TemplateReleaseDate || settings.templateReleaseDate || '').trim(),
    EngineVersion: String(settings.EngineVersion || settings.engineVersion || '').trim(),
    SpreadsheetId: String(settings.SpreadsheetId || settings.spreadsheetId || '').trim(),
    WebAppUrl: String(settings.WebAppUrl || settings.webAppUrl || '').trim(),
    LegacyMixedWorkspace: String(settings.LegacyMixedWorkspace || settings.legacyMixed || '').trim(),
    EnabledModules: settings.EnabledModules || settings.enabledModules || '',
    AIContext: settings.AIContext || settings.aiContext || '',
    AIUseWorkspaceContext: settings.AIUseWorkspaceContext || settings.aiUseWorkspaceContext || '',
    UseBlueprintNav: settings.UseBlueprintNav || settings.useBlueprintNav || '',
    JenisUsaha: String(settings.JenisUsaha || settings.jenisUsaha || settings.jenis || '').trim(),
    Owner: String(settings.Owner || settings.owner || 'builder').trim(),
    IndustryCategory: String(settings.IndustryCategory || settings.industryCategory || '').trim(),
    Status: String(settings.Status || settings.status || '').trim(),
    WorkspaceMode: String(settings.WorkspaceMode || settings.workspaceMode || '').trim()
  };
}

function createWorkspaceId() {
  return 'WS_' + randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function normalizeModuleIds(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[,;|]/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function readSetting(key, fallback = '') {
  return readWorkspaceSetting(key, fallback);
}

function writeSetting(key, value) {
  writeWorkspaceSetting(key, value);
}

function resetWorkspaceManagerState() {
  resetWorkspaceStorage();
}

function normalizeWorkspaceMode(mode) {
  const raw = String(mode || '').trim().toLowerCase();
  if (['member', 'runtime', 'customer', 'usaha'].includes(raw)) {
    return WORKSPACE_MODE_MEMBER;
  }
  if (['builder', 'platform', 'factory', 'controlplane'].includes(raw)) {
    return WORKSPACE_MODE_BUILDER;
  }
  return '';
}

function getWorkspaceMode(settings = {}) {
  const explicit = normalizeWorkspaceMode(settings.WorkspaceMode || '');
  if (explicit) return explicit;

  const persisted = normalizeWorkspaceMode(readSetting('WorkspaceMode', ''));
  if (persisted) return persisted;

  return ensureWorkspaceMode(settings);
}

function ensureWorkspaceMode(settings = {}) {
  const persisted = normalizeWorkspaceMode(readSetting('WorkspaceMode', ''));
  if (persisted) return persisted;

  const explicit = normalizeWorkspaceMode(settings.WorkspaceMode || '');
  const mode = explicit || WORKSPACE_MODE_MEMBER;
  writeSetting('WorkspaceMode', mode);
  return mode;
}

function parseSemverParts(version) {
  const raw = String(version || '0.0.0').trim();
  const match = raw.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return { major: 0, minor: 0, patch: 0, raw };
  return {
    major: parseInt(match[1], 10) || 0,
    minor: parseInt(match[2], 10) || 0,
    patch: parseInt(match[3], 10) || 0,
    raw
  };
}

function checkVersionCompatibility(options = {}) {
  const errors = [];
  const warnings = [];
  const engine = parseSemverParts(options.engineVersion || DEFAULT_ENGINE_VERSION);
  const blueprint = parseSemverParts(options.blueprintVersion || DEFAULT_ENGINE_VERSION);
  const engineMin = options.engineMin ? parseSemverParts(options.engineMin) : null;
  const engineMax = options.engineMax ? parseSemverParts(options.engineMax) : null;

  if (engineMin) {
    if (
      engine.major < engineMin.major ||
      (engine.major === engineMin.major && engine.minor < engineMin.minor) ||
      (engine.major === engineMin.major && engine.minor === engineMin.minor && engine.patch < engineMin.patch)
    ) {
      errors.push(`Engine ${engine.raw} di bawah minimum Blueprint (${engineMin.raw}).`);
    }
  }

  if (engineMax) {
    if (
      engine.major > engineMax.major ||
      (engine.major === engineMax.major && engine.minor > engineMax.minor)
    ) {
      errors.push(`Engine ${engine.raw} di atas maksimum Blueprint (${engineMax.raw}).`);
    }
  }

  if (engine.major !== blueprint.major && blueprint.raw !== '0.0.0') {
    warnings.push(
      `Major Engine (${engine.major}) ≠ major Blueprint (${blueprint.major}). Validasi ketat akan diaktifkan pada fase update workspace.`
    );
  }

  return {
    ok: errors.length === 0,
    schemaVersion: '1.0',
    errors,
    warnings,
    details: {
      engineVersion: engine.raw,
      blueprintVersion: blueprint.raw,
      engineMin: engineMin ? engineMin.raw : '',
      engineMax: engineMax ? engineMax.raw : ''
    }
  };
}

function resolveBlueprintId(settings = {}) {
  const explicit = String(settings.BlueprintId || '').trim();
  if (explicit) return explicit;
  const jenis = String(settings.JenisUsaha || '').trim().toLowerCase();
  return jenis === 'asuransi' ? 'insurance_agent' : DEFAULT_BLUEPRINT_ID;
}

function resolveBlueprintDefinition(settings = {}) {
  const blueprintId = resolveBlueprintId(settings);
  const definition = blueprintById(blueprintId);
  if (definition) return definition;
  return {
    id: DEFAULT_BLUEPRINT_ID,
    name: DEFAULT_BLUEPRINT_NAME,
    category: DEFAULT_BLUEPRINT_CATEGORY,
    templateId: 'operational_v1',
    templateVersion: DEFAULT_ENGINE_VERSION,
    enabledModules: [],
    aiTypes: DEFAULT_AI_TYPES,
    aiHints: ''
  };
}

function ensureBlueprintDefaults(settings = {}) {
  const blueprint = resolveBlueprintDefinition(settings);
  const templateId = String(settings.TemplateId || blueprint.templateId || '');
  const templateVersion = String(settings.TemplateVersion || blueprint.templateVersion || '');
  const templateName = String(settings.TemplateName || '') ||
    (blueprint.category === 'Insurance' ? 'TUMBU Insurance Template' : 'TUMBU Operational Template');
  const templateReleaseDate = String(settings.TemplateReleaseDate || DEFAULT_TEMPLATE_RELEASE_DATE);
  const aiHints = String(settings.AIContext || blueprint.aiHints || '');
  const aiTypes = Array.isArray(settings.aiTypes) && settings.aiTypes.length
    ? settings.aiTypes
    : Array.isArray(blueprint.aiTypes) && blueprint.aiTypes.length
      ? blueprint.aiTypes
      : DEFAULT_AI_TYPES;
  const category = blueprint.category || DEFAULT_BLUEPRINT_CATEGORY;
  const blueprintId = resolveBlueprintId(settings);
  const legacyMixed = String(settings.LegacyMixedWorkspace || 'Tidak') || 'Tidak';

  return {
    blueprint,
    blueprintId,
    templateId,
    templateVersion,
    templateName,
    templateReleaseDate,
    aiHints,
    aiTypes,
    category,
    legacyMixed
  };
}

function ensureEnabledModules(settings = {}, blueprint) {
  const explicitModules = normalizeModuleIds(settings.EnabledModules);
  const active = resolveActiveModuleIds({ enabledModules: explicitModules, blueprint });
  if (explicitModules.length > 0) {
    writeSetting('EnabledModules', active.join(','));
  } else if (active.length > 0) {
    writeSetting('EnabledModules', active.join(','));
  }
  return active;
}

function getWorkspaceSettings(options = {}) {
  const normalized = normalizeSettings(options.settings || {});
  const merged = getWorkspaceSettingsSnapshot();
  Object.entries(normalized).forEach(([key, value]) => {
    if (value !== '') {
      merged[key] = value;
    }
  });
  return merged;
}

function ensureWorkspaceMeta(options = {}) {
  const settings = getWorkspaceSettings(options);

  const workspaceId = String(settings.WorkspaceId || createWorkspaceId());
  writeSetting('WorkspaceId', workspaceId);

  const workspaceMode = ensureWorkspaceMode(settings);
  writeSetting('WorkspaceMode', workspaceMode);

  const blueprintDefaults = ensureBlueprintDefaults(settings);
  writeSetting('BlueprintId', blueprintDefaults.blueprintId);
  writeSetting('TemplateId', blueprintDefaults.templateId);
  writeSetting('TemplateVersion', blueprintDefaults.templateVersion);
  writeSetting('TemplateName', blueprintDefaults.templateName);
  writeSetting('TemplateReleaseDate', blueprintDefaults.templateReleaseDate);
  writeSetting('AIContext', blueprintDefaults.aiHints);
  writeSetting('JenisUsaha', String(settings.JenisUsaha || String(blueprintDefaults.blueprint.legacyJenisUsaha || 'operasional')));
  writeSetting('LegacyMixedWorkspace', blueprintDefaults.legacyMixed);
  writeSetting('WebAppUrl', String(settings.WebAppUrl || readSetting('WebAppUrl', '')));
  writeSetting('EngineVersion', String(settings.EngineVersion || readSetting('EngineVersion', DEFAULT_ENGINE_VERSION)));
  writeSetting('NamaPerusahaan', String(settings.NamaPerusahaan || readSetting('NamaPerusahaan', 'TUMBU Workspace')));
  writeSetting('UseBlueprintNav', String(settings.UseBlueprintNav || readSetting('UseBlueprintNav', 'Ya')));
  writeSetting('AIUseWorkspaceContext', String(settings.AIUseWorkspaceContext || readSetting('AIUseWorkspaceContext', 'Ya')));

  const aiContext = String(settings.AIContext || blueprintDefaults.aiHints || '');
  writeSetting('AIContext', aiContext);

  const enabledModules = ensureEnabledModules(settings, blueprintDefaults.blueprint);

  upsertWorkspaceRegistry({
    workspaceId,
    workspaceName: String(settings.NamaPerusahaan || readSetting('NamaPerusahaan', 'TUMBU Workspace')),
    owner: String(settings.Owner || 'builder'),
    industryCategory: String(settings.IndustryCategory || blueprintDefaults.category),
    blueprintId: blueprintDefaults.blueprintId,
    enabledModules: enabledModules.join(','),
    templateId: blueprintDefaults.templateId,
    templateVersion: blueprintDefaults.templateVersion,
    spreadsheetId: String(settings.SpreadsheetId || readSetting('SpreadsheetId', '')),
    webAppUrl: String(settings.WebAppUrl || readSetting('WebAppUrl', '')),
    engineVersion: String(settings.EngineVersion || readSetting('EngineVersion', DEFAULT_ENGINE_VERSION)),
    aiContext,
    status: String(settings.Status || 'active'),
    legacyMixed: blueprintDefaults.legacyMixed
  });

  return getWorkspaceContext({ settings: getWorkspaceSettings({ settings }) });
}

function getVersionCompatibility(settings = {}) {
  const blueprint = resolveBlueprintDefinition(settings);
  const engineVersion = String(settings.EngineVersion || readSetting('EngineVersion', DEFAULT_ENGINE_VERSION));
  const blueprintVersion = String(settings.TemplateVersion || blueprint.templateVersion || DEFAULT_ENGINE_VERSION);
  const engineMin = blueprint.engineMin || '';
  const engineMax = blueprint.engineMax || '';
  return checkVersionCompatibility({ engineVersion, blueprintVersion, engineMin, engineMax });
}

function getWorkspaceContext(options = {}) {
  const settings = getWorkspaceSettings(options);
  const blueprint = resolveBlueprintDefinition(settings);
  const workspaceMode = getWorkspaceMode(settings);
  const enabledModules = resolveActiveModuleIds({ enabledModules: normalizeModuleIds(settings.EnabledModules), blueprint });

  return {
    workspaceId: String(settings.WorkspaceId || ''),
    workspaceName: String(settings.NamaPerusahaan || '') || 'TUMBU Workspace',
    spreadsheetId: String(settings.SpreadsheetId || ''),
    workspaceMode,
    blueprintId: resolveBlueprintId(settings),
    blueprintName: blueprint.name || '',
    category: blueprint.category || '',
    enabledModules,
    templateId: String(settings.TemplateId || ''),
    templateVersion: String(settings.TemplateVersion || ''),
    templateName: String(settings.TemplateName || ''),
    templateReleaseDate: String(settings.TemplateReleaseDate || ''),
    engineVersion: String(settings.EngineVersion || DEFAULT_ENGINE_VERSION),
    legacyMixed: String(settings.LegacyMixedWorkspace || 'Tidak'),
    jenisUsaha: String(settings.JenisUsaha || 'operasional'),
    aiHints: String(settings.AIContext || blueprint.aiHints || ''),
    aiTypes: Array.isArray(settings.aiTypes) && settings.aiTypes.length
      ? settings.aiTypes
      : (Array.isArray(blueprint.aiTypes) && blueprint.aiTypes.length ? blueprint.aiTypes : DEFAULT_AI_TYPES),
    webAppUrl: String(settings.WebAppUrl || ''),
    compatibility: getVersionCompatibility(settings)
  };
}

function getWorkspaceInfo() {
  const registry = getWorkspaceRegistrySnapshot();
  const entry = registry.length ? registry[0] : null;
  if (!entry) {
    const defaultSettings = {
      WorkspaceId: 'ws-demo',
      NamaPerusahaan: 'TUMBU Demo',
      BlueprintId: DEFAULT_BLUEPRINT_ID,
      TemplateId: 'operational_v1',
      TemplateVersion: DEFAULT_ENGINE_VERSION,
      EngineVersion: DEFAULT_ENGINE_VERSION,
      WebAppUrl: 'http://localhost:3000',
      LegacyMixedWorkspace: 'Tidak'
    };
    return { ok: true, data: getWorkspaceContext({ settings: defaultSettings }) };
  }
  return { ok: true, data: getWorkspaceContext({ settings: entry }) };
}

function upsertWorkspaceRegistry(row) {
  const registry = getWorkspaceRegistrySnapshot();
  const idx = registry.findIndex((w) => w.workspaceId === row.workspaceId);
  const now = new Date().toISOString();
  const record = {
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName || '',
    owner: row.owner || '',
    industryCategory: row.industryCategory || '',
    blueprintId: row.blueprintId || '',
    enabledModules: row.enabledModules || '',
    templateId: row.templateId || '',
    templateVersion: row.templateVersion || '',
    spreadsheetId: row.spreadsheetId || '',
    webAppUrl: row.webAppUrl || '',
    engineVersion: row.engineVersion || '',
    aiContext: row.aiContext || '',
    status: row.status || 'active',
    legacyMixed: row.legacyMixed || 'Tidak',
    dibuat: idx !== -1 ? registry[idx].dibuat : now,
    diperbarui: now
  };

  upsertWorkspaceRegistryRow(record);
}

function getWorkspacesList() {
  return getWorkspaceRegistrySnapshot().map((r) => ({
    workspaceId: r.workspaceId,
    workspaceName: r.workspaceName,
    owner: r.owner,
    industryCategory: r.industryCategory,
    blueprintId: r.blueprintId,
    templateId: r.templateId,
    templateVersion: r.templateVersion,
    spreadsheetId: r.spreadsheetId,
    webAppUrl: r.webAppUrl,
    engineVersion: r.engineVersion,
    status: r.status,
    legacyMixed: r.legacyMixed,
    dibuat: r.dibuat,
    diperbarui: r.diperbarui
  }));
}

module.exports = {
  createWorkspaceId,
  ensureWorkspaceMeta,
  upsertWorkspaceRegistry,
  getWorkspaceContext,
  getWorkspaceInfo,
  getWorkspacesList,
  resetWorkspaceManagerState
};
