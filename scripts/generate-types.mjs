import { compileFromFile } from 'json-schema-to-typescript';
import { writeFile } from 'node:fs/promises';
let result = '';
for (const name of ['SemanticMap', 'ScoreBundle', 'InvestigationResult', 'ImprovementProposal']) {
  const types = await compileFromFile(`contracts/${name}.schema.json`, {
    bannerComment: '',
    additionalProperties: false,
  });
  await writeFile(`packages/contracts/${name}.ts`, types);
  result += `export type { ${name} } from './${name}';\n`;
}
await writeFile('packages/contracts/index.ts', result);
