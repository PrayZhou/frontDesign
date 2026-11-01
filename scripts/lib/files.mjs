import { promises as fs } from 'node:fs';
import path from 'node:path';

const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', '.next', 'dist', 'build']);

// Project-relative, sorted, forward-slash paths; a missing root returns an empty list.
export async function listFiles(root, { extensions = null } = {}) {
  const results = [];

  async function visit(relative) {
    let entries;
    try {
      entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
        await visit(next);
      } else if (entry.isFile()) {
        if (extensions && !extensions.some((extension) => entry.name.toLowerCase().endsWith(extension))) continue;
        results.push(next.split(path.sep).join('/'));
      }
    }
  }

  await visit('');
  return results.sort();
}
