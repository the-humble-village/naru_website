/**
 * Compares every field of every model in schema.prisma against the DMMF of the
 * @prisma/client that Node actually resolves. Exits non-zero on any drift.
 *
 * A stale generated client is invisible until a query names a field it lacks,
 * at which point Prisma throws PrismaClientValidationError and the endpoint
 * 500s. That is exactly how the Aug 2026 outage presented: the database and
 * schema.prisma were both correct while the client on disk predated seven
 * models' worth of changes, so it read as an intermittent connection fault.
 *
 * CommonJS (.cjs) on purpose — the backend package.json sets "type": "module".
 *
 * Usage, from a directory where @prisma/client resolves:
 *   node check-prisma-client-drift.cjs [path/to/schema.prisma]
 */
const fs = require('fs');
const path = require('path');

const schemaPath = process.argv[2] || path.join(__dirname, 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('FATAL: schema not found at ' + schemaPath);
  process.exit(1);
}

let Prisma;
try {
  ({ Prisma } = require('@prisma/client'));
} catch (e) {
  console.error('FATAL: cannot resolve @prisma/client from ' + __dirname);
  console.error('       Run this from inside the deployed app tree.');
  process.exit(1);
}

const src = fs.readFileSync(schemaPath, 'utf8');
const models = [...src.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];

if (models.length === 0) {
  console.error('FATAL: parsed 0 models out of ' + schemaPath + ' — refusing to report a clean bill of health.');
  process.exit(1);
}

const problems = [];

for (const [, name, body] of models) {
  // Field lines only: skip comments, block attributes (@@index, @@map) and blanks.
  const declared = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/)[0]);

  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === name);
  if (!model) {
    problems.push(name + ': model missing from client entirely');
    continue;
  }

  const present = new Set(model.fields.map((f) => f.name));
  const missing = declared.filter((d) => !present.has(d));
  if (missing.length) {
    problems.push(name + ': missing field(s) ' + missing.join(', '));
  }
}

if (problems.length) {
  console.error('Generated Prisma client is STALE — ' + problems.length + ' of ' + models.length + ' models disagree with the schema:');
  for (const p of problems) console.error('  - ' + p);
  console.error('Fix: run `npx prisma generate` where @prisma/client resolves, then restart the service.');
  process.exit(1);
}

console.log('Prisma client matches schema: ' + models.length + ' models, no drift.');
