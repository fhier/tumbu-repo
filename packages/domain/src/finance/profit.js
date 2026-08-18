"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeProfit = computeProfit;
function computeProfit(revenue, bop) {
    const rev = Number(revenue) || 0;
    const cost = Number(bop) || 0;
    const grossProfit = rev - cost;
    if (rev <= 0) {
        return {
            revenue: rev,
            bop: cost,
            grossProfit,
            marginPct: undefined,
            defined: false,
        };
    }
    return {
        revenue: rev,
        bop: cost,
        grossProfit,
        marginPct: (grossProfit / rev) * 100,
        defined: true,
    };
}
//# sourceMappingURL=profit.js.map