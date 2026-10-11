export function pickCyclic<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}
