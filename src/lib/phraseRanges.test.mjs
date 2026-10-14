import test from 'node:test';
import assert from 'node:assert/strict';
import { selectableRange, selectionForLane, alignedTime } from './phraseRanges.mjs';

const alignment = { alignment: {
  reference_anchor_start_s: 1, reference_anchor_end_s: 3,
  take_anchor_start_s: 2, take_anchor_end_s: 6,
  take_to_reference_scale: .5
} };

test('selection maps to aligned source times without overwriting either lane', () => {
  const selected = { start: 1.2, end: 2.8 };
  const before = structuredClone(selected);
  const ref = selectionForLane(selected, alignment, 'reference', 4, 8);
  const take = selectionForLane(selected, alignment, 'take', 4, 8);
  assert.deepEqual(ref, selected);
  assert.ok(Math.abs(take.start - 2.4) < 1e-6);
  assert.ok(Math.abs(take.end - 5.6) < 1e-6);
  assert.deepEqual(selected, before);
});
test('normalized presentation maps corresponding attacks to the same x', () => {
  assert.equal(alignedTime(2, 4, alignment, 'reference', true), .5);
  assert.equal(alignedTime(4, 8, alignment, 'take', true), .5);
  assert.equal(alignedTime(4, 8, alignment, 'take', false), .5);
});
test('selection never produces a zero-length or out-of-bound interval', () => {
  const result = selectableRange(99, -2, 4);
  assert.ok(result.start >= 0 && result.end <= 4);
  assert.ok(result.end - result.start >= .119);
});
test('duration fallback maps source selection without pretending tempos match', () => {
  const t = selectionForLane({ start: .5, end: 1 }, null, 'take', 4, 8);
  assert.deepEqual(t, { start: 1, end: 2 });
});
