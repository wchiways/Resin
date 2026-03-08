type Timestamped = {
  timestamp: number;
};

export const DEFAULT_HISTORY_MAX_ITEMS = 4_096;

function buildUniformSampleIndices(pointCount: number, maxPoints: number): number[] {
  if (pointCount <= 0 || maxPoints <= 0) {
    return [];
  }

  const capped = Math.min(pointCount, maxPoints);
  if (capped === pointCount) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }
  if (capped === 1) {
    return [0];
  }
  if (capped === 2) {
    return [0, pointCount - 1];
  }

  const middleCount = capped - 2;
  const span = pointCount - 2;
  const selected = new Set<number>([0, pointCount - 1]);

  for (let i = 0; i < middleCount; i += 1) {
    const index = 1 + Math.floor((i * span) / middleCount);
    selected.add(Math.min(pointCount - 2, index));
  }

  return Array.from(selected).sort((a, b) => a - b);
}

export function downsample<T>(items: T[], maxPoints: number): T[] {
  if (maxPoints <= 0) {
    return [];
  }
  if (items.length <= maxPoints) {
    return items;
  }

  const indices = buildUniformSampleIndices(items.length, maxPoints);
  return indices.map((index) => items[index] ?? items[items.length - 1]);
}

export function appendHistory<T extends Timestamped>(
  history: T[],
  entry: T,
  maxItems = DEFAULT_HISTORY_MAX_ITEMS,
): T[] {
  if (!history.length) {
    return maxItems > 0 ? [entry] : [];
  }

  const next = [...history];
  const sameIndex = next.findIndex((item) => item.timestamp === entry.timestamp);

  if (sameIndex >= 0) {
    next[sameIndex] = entry;
  } else if (entry.timestamp >= next[next.length - 1].timestamp) {
    next.push(entry);
  } else if (entry.timestamp <= next[0].timestamp) {
    next.unshift(entry);
  } else {
    const insertIndex = next.findIndex((item) => item.timestamp > entry.timestamp);
    if (insertIndex < 0) {
      next.push(entry);
    } else {
      next.splice(insertIndex, 0, entry);
    }
  }

  if (maxItems > 0 && next.length > maxItems) {
    return next.slice(next.length - maxItems);
  }

  return next;
}

export function pruneHistory<T extends Timestamped>(
  history: T[],
  minTimestamp: number,
  maxItems = DEFAULT_HISTORY_MAX_ITEMS,
): T[] {
  const filtered = history.filter((item) => item.timestamp >= minTimestamp);

  if (maxItems > 0 && filtered.length > maxItems) {
    return filtered.slice(filtered.length - maxItems);
  }

  return filtered;
}

export function sliceWindow<T extends Timestamped>(history: T[], windowMs: number, nowTimestamp: number): T[] {
  if (windowMs <= 0) {
    return [];
  }

  const windowStart = nowTimestamp - windowMs;
  return history.filter((item) => item.timestamp >= windowStart && item.timestamp <= nowTimestamp);
}
