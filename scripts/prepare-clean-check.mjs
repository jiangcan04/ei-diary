import { cp, mkdtemp, readFile, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy an explicit source allowlist, never local dependencies or personal exports.
const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['.nvmrc', 'package.json', 'package-lock.json', 'tsconfig.json', 'index.html', 'LICENSE', 'src', 'public', 'scripts'];
const destination = await mkdtemp(join(tmpdir(), 'ei-clean-check-'));
for (const name of files) {
  await cp(resolve(root, name), join(destination, name), {
    recursive: true,
    filter: async (source) => {
      if ((await lstat(source)).isSymbolicLink()) throw new Error('Source symlinks are not allowed');
      return true;
    },
  });
}
// Only the known programmatic fixture suite is included, not arbitrary test outputs.
await cp(resolve(root, 'tests'), join(destination, 'tests'), {
  recursive: true,
  filter: async (source) => {
    if ((await lstat(source)).isSymbolicLink()) throw new Error('Test symlinks are not allowed');
    return source === resolve(root, 'tests') || source === resolve(root, 'tests/startup.test.mjs');
  },
});
const pkg = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(destination, 'package-lock.json'), 'utf8'));
if (pkg.engines.node !== (await readFile(join(destination, '.nvmrc'), 'utf8')).trim()) throw new Error('Node version mismatch');
if (pkg.name !== lock.packages[''].name) throw new Error('Lockfile root name mismatch');
await writeFile(join(destination, 'CLEAN-CHECK.txt'), 'Fresh source copy. Dependencies, builds, browser data and personal exports were not copied. Run the verification steps from docs/clean-environment-check.md in the original project.\n');
console.log(destination);
