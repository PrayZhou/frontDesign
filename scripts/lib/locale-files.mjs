import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listFiles } from './files.mjs';
import { flattenMessages } from './i18n-stress.mjs';

// en.json contributes root keys; en/admin/forms.json contributes admin.forms.*.
export async function loadLocales(directory) {
  const files = await listFiles(directory, { extensions: ['.json'] });
  const locales = Object.create(null);
  const sources = new Map();
  const errors = [];
  for (const file of files) {
    const [locale, ...namespace] = file.slice(0, -'.json'.length).split('/');
    try {
      const data = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'));
      const messages = flattenMessages(data, namespace.join('.'));
      if (!sources.has(locale)) {
        sources.set(locale, new Map());
        locales[locale] = Object.create(null);
      }
      const origins = sources.get(locale);
      for (const [key, value] of Object.entries(messages)) {
        if (origins.has(key)) {
          errors.push(`${file}: duplicate key "${key}" for ${locale}, already defined in ${origins.get(key)}`);
          continue;
        }
        origins.set(key, file);
        locales[locale][key] = value;
      }
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  return { locales, errors };
}
