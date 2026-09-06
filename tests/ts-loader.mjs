import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,export default {};',
    };
  }

  if (specifier === 'next/headers') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,export async function cookies() { return { getAll: () => [], get: () => undefined, set: () => {} }; };',
    };
  }

  // Handle @/ path alias
  if (specifier.startsWith('@/')) {
    const subPath = specifier.slice(2);
    const resolvedPath = path.resolve(ROOT, 'src', subPath);
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const candidate = resolvedPath + ext;
      if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const parentDir = context.parentURL
        ? path.dirname(fileURLToPath(context.parentURL))
        : ROOT;
      const resolvedPath = path.resolve(parentDir, specifier);
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const candidate = resolvedPath + ext;
        if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    throw err;
  }
}
