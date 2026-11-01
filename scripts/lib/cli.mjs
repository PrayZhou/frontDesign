export function parseArgs(argv, schema = {}) {
  const result = {};

  const assign = (name, value, option) => {
    if (!option.repeatable) {
      result[name] = value;
      return;
    }
    if (result[name] === undefined) result[name] = [value];
    else result[name].push(value);
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const separator = argument.indexOf('=');
    const name = separator === -1 ? argument.slice(2) : argument.slice(2, separator);
    const inlineValue = separator === -1 ? undefined : argument.slice(separator + 1);

    const option = schema[name];
    if (!option) {
      throw new Error(`Unknown option: --${name}`);
    }

    if (option.type === 'boolean') {
      if (inlineValue === undefined || inlineValue === 'true') {
        result[name] = true;
      } else if (inlineValue === 'false') {
        result[name] = false;
      } else {
        throw new Error(`Option --${name} only accepts true or false`);
      }
      continue;
    }

    if (inlineValue !== undefined) {
      if (!inlineValue) throw new Error(`Option --${name} requires a value`);
      assign(name, inlineValue, option);
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Option --${name} requires a value`);
    }
    assign(name, value, option);
    index += 1;
  }

  for (const [name, option] of Object.entries(schema)) {
    // `false` is an explicit value; only an absent option falls back to its default.
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
