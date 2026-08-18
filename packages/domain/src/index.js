"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.colorFromRule = exports.computeDeviation = exports.computeProfit = exports.computeBop = exports.computeHpp = exports.canRecordHarvestPcs = exports.canRecordMortality = exports.computeActivePopulation = exports.computeFcr = exports.computeSr = void 0;
__exportStar(require("./types"), exports);
var sr_1 = require("./biology/sr");
Object.defineProperty(exports, "computeSr", { enumerable: true, get: function () { return sr_1.computeSr; } });
var fcr_1 = require("./biology/fcr");
Object.defineProperty(exports, "computeFcr", { enumerable: true, get: function () { return fcr_1.computeFcr; } });
var population_1 = require("./biology/population");
Object.defineProperty(exports, "computeActivePopulation", { enumerable: true, get: function () { return population_1.computeActivePopulation; } });
Object.defineProperty(exports, "canRecordMortality", { enumerable: true, get: function () { return population_1.canRecordMortality; } });
Object.defineProperty(exports, "canRecordHarvestPcs", { enumerable: true, get: function () { return population_1.canRecordHarvestPcs; } });
var hpp_1 = require("./finance/hpp");
Object.defineProperty(exports, "computeHpp", { enumerable: true, get: function () { return hpp_1.computeHpp; } });
var bop_1 = require("./finance/bop");
Object.defineProperty(exports, "computeBop", { enumerable: true, get: function () { return bop_1.computeBop; } });
var profit_1 = require("./finance/profit");
Object.defineProperty(exports, "computeProfit", { enumerable: true, get: function () { return profit_1.computeProfit; } });
var deviation_1 = require("./finance/deviation");
Object.defineProperty(exports, "computeDeviation", { enumerable: true, get: function () { return deviation_1.computeDeviation; } });
var indicator_1 = require("./indicators/indicator");
Object.defineProperty(exports, "colorFromRule", { enumerable: true, get: function () { return indicator_1.colorFromRule; } });
//# sourceMappingURL=index.js.map