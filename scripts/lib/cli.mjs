export function parseArgs(argv, schema = {}) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const name = argument.slice(2);
    const option = schema[name];
    if (!option) {
      throw new Error(`Unknown option: --${name}`);
    }

    if (option.type === 'boolean') {
      result[name] = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Option --${name} requires a value`);
    }
    result[name] = value;
    index += 1;
  }

  for (const [name, option] of Object.entries(schema)) {
    if (result[name] === undefined && option.default !== undefined) {
      result[name] = option.default;
    }
    if (option.required && result[name] === undefined) {
      throw new Error(`Option --${name} is required`);
    }
  }

  return result;
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
