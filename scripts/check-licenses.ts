// Fails when a shipped dependency's license is not on the allowlist.
// Usage: node scripts/check-licenses.ts [--json]
import { licenseProblems, shippedPackages } from './lib/licenses.ts';

const packages = shippedPackages();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(packages, null, 2));
} else {
  for (const p of packages) console.log(`${p.name}@${p.version}  ${p.license}`);
}

const problems = licenseProblems();
if (problems.length > 0) {
  console.error(`\n${problems.length} license problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nAdd an approved exception with a reason to scripts/licenses.allow.json, or replace the package.');
  process.exit(1);
}
console.error(`\nLicenses OK (${packages.length} shipped packages).`);
