import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A server file may take only components from a 'use client' file. Anything else
 * (a list, a constant, a helper) arrives as a client reference, not the value, and
 * the page crashes in production ("Something went wrong"): the Orders page once
 * spread RANGE_PRESETS from the date picker. Shared values belong in src/lib.
 */
const root = process.cwd();
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name)) files.push(p);
  }
};
walk(join(root, 'src'));

const isClient = (src: string) => /^\s*(['"])use client\1/.test(src);
const resolve = (from: string, spec: string) => {
  const base = spec.startsWith('@/') ? join(root, 'src', spec.slice(2)) : spec.startsWith('.') ? join(from, '..', spec) : null;
  if (!base) return null;
  for (const c of [base + '.tsx', base + '.ts', join(base, 'index.tsx'), join(base, 'index.ts')]) if (existsSync(c)) return c;
  return null;
};

describe('server files and client modules', () => {
  it('imports only components (PascalCase) from client modules into server files', () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (isClient(src)) continue;
      for (const m of src.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
        const [, names = '', spec = ''] = m;
        const target = resolve(f, spec);
        if (!target || !isClient(readFileSync(target, 'utf8'))) continue;
        for (const raw of names.split(',')) {
          const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
          if (!name || raw.trim().startsWith('type ')) continue;
          if (!/^[A-Z][a-z0-9]/.test(name)) bad.push(`${f.slice(root.length + 1)}: ${name} from ${spec}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
