import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRookies } from '../public/rookie-filter.js';

test('rookie categories preserve archive ranking and do not guess unknown class', () => {
  const rows = [{rank: 1, class: '二年級'}, {rank: 2, class: '一年級'}, {rank: 3, class: null}];
  assert.deepEqual(filterRookies(rows, 'rookie').map(x => x.rank), [2]);
  assert.deepEqual(filterRookies(rows, 'sophomore').map(x => x.rank), [1]);
  assert.deepEqual(filterRookies(rows).map(x => x.rank), [1, 2, 3]);
  assert.deepEqual(filterRookies(null, 'rookie'), []);
});
