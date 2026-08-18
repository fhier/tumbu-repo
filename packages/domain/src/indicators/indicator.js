"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.colorFromRule = colorFromRule;
function colorFromRule(input) {
    const { direction, greenBound, yellowBound, value } = input;
    if (!Number.isFinite(value))
        return 'NEUTRAL';
    if (direction === 'LOWER_BETTER') {
        if (value < greenBound)
            return 'GREEN';
        if (value < yellowBound)
            return 'YELLOW';
        return 'RED';
    }
    if (value >= greenBound)
        return 'GREEN';
    if (value >= yellowBound)
        return 'YELLOW';
    return 'RED';
}
//# sourceMappingURL=indicator.js.map