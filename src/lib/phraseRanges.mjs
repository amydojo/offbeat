// Mapping is for comparison/selection only. It never changes source audio bytes.
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function selectableRange(start, end, duration) {
  const total = Math.max(.2, Number(duration) || .2);
  const s = clamp(Number(start) || 0, 0, total - .12);
  const e = clamp(Number(end) || total, s + .12, total);
  return { start: s, end: e };
}

export function selectionForLane(selection, comparison, lane, referenceDuration, takeDuration) {
  const reference = selectableRange(selection.start, selection.end, referenceDuration);
  if (lane === 'reference') return reference;
  if (!takeDuration) return { start: 0, end: .2 };
  const a = comparison?.alignment;
  if (!a) {
    const scale = takeDuration / referenceDuration;
    return selectableRange(reference.start * scale, reference.end * scale, takeDuration);
  }
  const scale = a.take_to_reference_scale;
  const start = a.take_anchor_start_s + (reference.start - a.reference_anchor_start_s) / scale;
  const end = a.take_anchor_start_s + (reference.end - a.reference_anchor_start_s) / scale;
  return selectableRange(start, end, takeDuration);
}

export function alignedTime(t, duration, comparison, lane, normalized) {
  if (!normalized) return t / Math.max(duration, .01);
  const a = comparison?.alignment;
  if (!a) return t / Math.max(duration, .01);
  const begin = lane === 'take' ? a.take_anchor_start_s : a.reference_anchor_start_s;
  const finish = lane === 'take' ? a.take_anchor_end_s : a.reference_anchor_end_s;
  return (t - begin) / Math.max(finish - begin, .001);
}

export function keepWithinSelection(selection, duration) {
  return selection && Number.isFinite(selection.start) && Number.isFinite(selection.end)
    ? selectableRange(selection.start, selection.end, duration)
    : { start: 0, end: Math.max(.2, duration) };
}
