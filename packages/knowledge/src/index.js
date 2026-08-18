"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeEngine = exports.KnowledgeLoader = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class KnowledgeLoader {
    directory;
    constructor(directory) {
        this.directory = directory;
    }
    load() {
        if (!(0, node_fs_1.existsSync)(this.directory))
            return {};
        return Object.fromEntries((0, node_fs_1.readdirSync)(this.directory).map((file) => {
            const path = (0, node_path_1.join)(this.directory, file);
            try {
                return [file, JSON.parse((0, node_fs_1.readFileSync)(path, 'utf8'))];
            }
            catch {
                return [file, (0, node_fs_1.readFileSync)(path, 'utf8')];
            }
        }));
    }
}
exports.KnowledgeLoader = KnowledgeLoader;
class KnowledgeEngine {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    getDomains() { return Object.keys(this.registry); }
}
exports.KnowledgeEngine = KnowledgeEngine;
//# sourceMappingURL=index.js.map