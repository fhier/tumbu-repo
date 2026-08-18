#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const possiblePaths = [
  path.join(__dirname, '..', 'dist', 'tooling', 'cli', 'src', 'index.js'),
  path.join(__dirname, '..', 'dist', 'index.js'),
];

let entrypoint = possiblePaths.find((p) => fs.existsSync(p));

if (!entrypoint) {
  console.error('[TUMBU CLI] Build artifacts not found. Please run `npm run tumbu:build` first.');
  process.exit(1);
}

require(entrypoint);
