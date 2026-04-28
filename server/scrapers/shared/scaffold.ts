// Phase 01 plan 01 — placeholder TS file so tsc -p tsconfig.server.json
// finds at least one input. Plans 02..07 add real shared modules
// (http, normalize, images, fx, block-detection, types) here.
//
// Once shared/types.ts (or any other real module) lands, this file
// can be deleted — it exists solely to satisfy TS18003 against an
// otherwise-empty server/ tree.

export const SCAFFOLD_VERSION = '01-01' as const;
