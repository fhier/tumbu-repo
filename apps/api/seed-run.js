"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const seed_helper_1 = require("./src/erp/seed.helper");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting seed...');
    await (0, seed_helper_1.seedDatabase)(prisma);
    console.log('Seed completed!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=seed-run.js.map