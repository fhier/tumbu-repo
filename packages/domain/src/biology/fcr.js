"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFcr = computeFcr;
function computeFcr(feedKg, harvestKg) {
    const feed = Number(feedKg) || 0;
    const harvest = Number(harvestKg) || 0;
    if (harvest <= 0) {
        return { fcr: undefined, feedKg: feed, harvestKg: harvest, defined: false };
    }
    return { fcr: feed / harvest, feedKg: feed, harvestKg: harvest, defined: true };
}
//# sourceMappingURL=fcr.js.map