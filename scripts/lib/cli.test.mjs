import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './cli.mjs';

test('inline --name=value is supported', () => {
  const options = parseArgs(['--root=/tmp/x', '--json'], {
    root: { type: 'string' },
    json: { type: 'boolean' },
  });
  assert.deepEqual(options, { root: '/tmp/x', json: true });
});

test('boolean options accept explicit true and false', () => {
  assert.equal(parseArgs(['--json=false'], { json: { type: 'boolean' } }).json, false);
  assert.equal(parseArgs(['--json=true'], { json: { type: 'boolean' } }).json, true);
  assert.throws(() => parseArgs(['--json=maybe'], { json: { type: 'boolean' } }), /only accepts true or false/);
});

test('separated values, defaults, and required options still work', () => {
  const schema = {
    file: { type: 'string', required: true },
    root: { type: 'string', default: '.' },
    json: { type: 'boolean' },
  };
  assert.deepEqual(parseArgs(['--file', 'plan.json'], schema), { file: 'plan.json', root: '.' });
  assert.throws(() => parseArgs(['--json'], schema), /--file is required/);
  assert.throws(() => parseArgs(['--file'], schema), /requires a value/);
  assert.throws(() => parseArgs(['--file='], schema), /requires a value/);
});

test('unknown options and positional arguments are rejected', () => {
  assert.throws(() => parseArgs(['--nope'], {}), /Unknown option/);
  assert.throws(() => parseArgs(['plain'], {}), /Unknown argument/);
});

test('repeatable options collect every value', () => {
  const options = parseArgs(['--pair', '#111:#fff', '--pair=#000:#fff'], {
    pair: { type: 'string', repeatable: true },
  });
  assert.deepEqual(options.pair, ['#111:#fff', '#000:#fff']);
});
