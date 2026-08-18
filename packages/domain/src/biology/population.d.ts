import { PopulationFacts } from '../types';
export declare function computeActivePopulation(facts: PopulationFacts): {
    activePcs: number;
    stockedPcs: number;
    deadPcs: number;
    harvestedPcs: number;
};
export declare function canRecordMortality(facts: PopulationFacts, deadCountPcs: number): {
    ok: true;
    activeBefore: number;
    activeAfter: number;
} | {
    ok: false;
    reason: string;
    activeBefore: number;
};
export declare function canRecordHarvestPcs(facts: PopulationFacts, quantityPcs: number): {
    ok: true;
    activeBefore: number;
    activeAfter: number;
} | {
    ok: false;
    reason: string;
    activeBefore: number;
};
