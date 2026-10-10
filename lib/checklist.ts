export type StoredChecklist = {
  knowledgeVersion: string;
  checkedIds: string[];
};

export function stateFingerprint(slots: Record<string, string>) {
  return Object.entries(slots)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

export function retainSharedChecks(checkedIds: string[], availableIds: string[]) {
  const available = new Set(availableIds);
  return checkedIds.filter((id) => available.has(id));
}

export function progressPercent(checkedIds: string[], availableIds: string[]) {
  if (!availableIds.length) return 0;
  return Math.round((retainSharedChecks(checkedIds, availableIds).length / availableIds.length) * 100);
}
