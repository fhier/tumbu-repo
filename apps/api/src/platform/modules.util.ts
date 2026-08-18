/** Parse Tenant.modulesJson with blueprint fallback — shared by Platform + API Wall. */
import { DEFAULT_BLUEPRINT_ID, modulesForBlueprint } from './catalog';

export function parseTenantModules(json: string | null | undefined, blueprintId?: string | null): string[] {
  try {
    const arr = JSON.parse(json || '[]');
    if (Array.isArray(arr) && arr.length) {
      return arr.map((x) => String(x));
    }
  } catch {
    /* ignore */
  }
  return modulesForBlueprint(blueprintId || DEFAULT_BLUEPRINT_ID);
}

export function tenantHasModule(enabled: string[], moduleId: string): boolean {
  return enabled.includes(moduleId);
}

export function tenantHasAnyModule(enabled: string[], moduleIds: string[]): boolean {
  return moduleIds.some((id) => enabled.includes(id));
}
