"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeHpp = computeHpp;
function computeHpp(bop, harvestKg) {
    const b = Number(bop) || 0;
    const kg = Number(harvestKg) || 0;
    if (kg <= 0) {
        return { hppPerKg: undefined, bop: b, harvestKg: kg, defined: false };
    }
    return { hppPerKg: b / kg, bop: b, harvestKg: kg, defined: true };
}
//# sourceMappingURL=hpp.js.map