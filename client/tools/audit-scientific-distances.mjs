import {
  assertScientificDistanceAudit,
  auditScientificDistances,
  formatScientificDistanceAudit,
} from './scientific-distance-audit.mjs';

const report = await auditScientificDistances();

console.log(formatScientificDistanceAudit(report));
assertScientificDistanceAudit(report);
