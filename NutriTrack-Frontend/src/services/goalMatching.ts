export const GOAL_SYNONYMS: Record<string, string[]> = {
  'lose weight': ['lose weight', 'weight loss'],
  'maintain weight': ['maintain', 'maintain weight'],
  'build muscle': ['build muscle', 'muscle building'],
  'general health': ['general health', 'wellness', 'general nutrition'],
};

const normalizeGoal = (value: string): string => value.trim().toLowerCase();

const canonicalGoal = (value: string): string => {
  const normalized = normalizeGoal(value);
  return Object.entries(GOAL_SYNONYMS).find(([, synonyms]) => synonyms.includes(normalized))?.[0] || normalized;
};

export const goalsMatch = (firstGoal: string, secondGoal: string): boolean =>
  canonicalGoal(firstGoal) === canonicalGoal(secondGoal);
