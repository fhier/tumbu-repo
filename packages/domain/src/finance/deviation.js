"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDeviation = computeDeviation;
function computeDeviation(actual, target) {
    const a = Number(actual) || 0;
    const t = Number(target) || 0;
    if (t <= 0) {
        return { deviationPct: undefined, target: t, actual: a, defined: false };
    }
    return {
        deviationPct: ((a - t) / t) * 100,
        target: t,
        actual: a,
        defined: true,
    };
}
//# sourceMappingURL=deviation.js.map