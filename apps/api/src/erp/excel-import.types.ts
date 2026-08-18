export type ImportMode = 'master' | 'master_plus_open' | 'full_history';

export type EntityKind =
  | 'suppliers'
  | 'customers'
  | 'sizes'
  | 'products'
  | 'purchases'
  | 'sales'
  | 'expenses'
  | 'cash'
  | 'beritaAcara'
  | 'suratJalan'
  | 'openBalances';

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
};

export type EntityDef = {
  kind: EntityKind;
  label: string;
  fields: FieldDef[];
  modes: ImportMode[];
};

export type SheetInfo = {
  name: string;
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
};

export type EntityMapping = {
  kind: EntityKind;
  sheetName: string | null;
  /** fieldKey → header name (or null = skip) */
  columns: Record<string, string | null>;
  /** for transactions: group rows by this field (e.g. number) or composite */
  groupBy?: string | null;
};

export type ExcelImportMapping = {
  entities: EntityMapping[];
  mode: ImportMode;
  preset?: string | null;
};

export type ParsedExcel = {
  sheets: SheetInfo[];
  suggestedMapping: ExcelImportMapping;
  detectedPreset: string | null;
};

export type PreviewRowIssue = {
  entity: EntityKind;
  row: number;
  message: string;
};

export type PreviewSummary = {
  mode: ImportMode;
  counts: Record<string, { ok: number; skip: number; error: number }>;
  issues: PreviewRowIssue[];
  warnings: string[];
};

export type CommitResult = {
  ok: boolean;
  message: string;
  added: Record<string, number>;
  skipped: Record<string, number>;
  errors: PreviewRowIssue[];
  warnings: string[];
  workspace: { code: string; name: string };
};
