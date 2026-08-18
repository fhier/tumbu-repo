export type CostClass = 'DIRECT' | 'INDIRECT';
export type FormulaColor = 'GREEN' | 'YELLOW' | 'RED' | 'NEUTRAL';
export type CostLine = {
    amount: number;
    costClass: CostClass;
    source: string;
    categoryCode?: string;
};
export type BopResult = {
    total: number;
    direct: number;
    indirect: number;
    bySource: Record<string, number>;
};
export type HppResult = {
    hppPerKg: number | undefined;
    bop: number;
    harvestKg: number;
    defined: boolean;
};
export type FcrResult = {
    fcr: number | undefined;
    feedKg: number;
    harvestKg: number;
    defined: boolean;
};
export type SrResult = {
    srPct: number | undefined;
    stockedPcs: number;
    harvestedPcs: number;
    defined: boolean;
};
export type ProfitResult = {
    revenue: number;
    bop: number;
    grossProfit: number;
    marginPct: number | undefined;
    defined: boolean;
};
export type DeviationResult = {
    deviationPct: number | undefined;
    target: number;
    actual: number;
    defined: boolean;
};
export type IndicatorInput = {
    direction: 'LOWER_BETTER' | 'HIGHER_BETTER';
    greenBound: number;
    yellowBound: number;
    value: number;
};
export type PopulationFacts = {
    stockedPcs: number;
    deadPcs: number;
    harvestedPcs: number;
};
