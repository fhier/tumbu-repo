const MANIFEST_SCHEMA_VERSION = '1.0';

function buildWorkspaceManifest(options = {}) {
  const settings = options.settings || {};
  const compatibility = options.compatibility || { ok: true, errors: [], warnings: [] };
  const now = options.now || new Date().toISOString();

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    workspaceId: String(settings.WorkspaceId || ''),
    workspaceMode: options.workspaceMode || '',
    workspaceName: String(settings.NamaPerusahaan || ''),
    spreadsheetId: options.spreadsheetId || '',
    blueprintId: String(settings.BlueprintId || ''),
    blueprintName: options.blueprint && options.blueprint.name ? options.blueprint.name : '',
    category: options.blueprint && options.blueprint.category ? options.blueprint.category : '',
    blueprintVersion: String(settings.TemplateVersion || ''),
    templateId: String(settings.TemplateId || ''),
    engineVersion: String(settings.EngineVersion || ''),
    modules: Array.isArray(options.activeModules) ? options.activeModules : [],
    moduleVersions: {},
    legacyMixed: String(settings.LegacyMixedWorkspace || 'Tidak'),
    webAppUrl: String(settings.WebAppUrl || ''),
    compatibility: {
      ok: !!(compatibility && compatibility.ok),
      errors: compatibility && Array.isArray(compatibility.errors) ? compatibility.errors : [],
      warnings: compatibility && Array.isArray(compatibility.warnings) ? compatibility.warnings : []
    },
    updatedAt: now
  };
}

module.exports = {
  MANIFEST_SCHEMA_VERSION,
  buildWorkspaceManifest
};
