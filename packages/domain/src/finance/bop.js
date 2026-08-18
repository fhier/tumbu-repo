"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBop = computeBop;
function computeBop(lines) {
    let total = 0;
    let direct = 0;
    let indirect = 0;
    const bySource = {};
    for (const line of lines) {
        const amount = Number(line.amount);
        if (!Number.isFinite(amount) || amount === 0)
            continue;
        total += amount;
        if (line.costClass === 'INDIRECT')
            indirect += amount;
        else
            direct += amount;
        bySource[line.source] = (bySource[line.source] ?? 0) + amount;
    }
    return { total, direct, indirect, bySource };
}
//# sourceMappingURL=bop.js.map