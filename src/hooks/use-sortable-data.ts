import { useMemo, useState, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string | null;
  direction: SortDirection;
}

export type SortAccessor<T> = (item: T) => unknown;

export interface UseSortableDataOptions<T> {
  accessors?: Record<string, SortAccessor<T>>;
}

function defaultAccessor<T>(item: T, key: string): unknown {
  if (item == null) return null;
  if (key.includes(".")) {
    return key.split(".").reduce<unknown>((acc, part) => {
      if (acc == null || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[part];
    }, item as unknown);
  }
  return (item as Record<string, unknown>)[key];
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }

  const aStr = String(a);
  const bStr = String(b);

  // Try numeric comparison when both look numeric
  const aNum = Number(aStr.replace(",", "."));
  const bNum = Number(bStr.replace(",", "."));
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aStr.trim() !== "" && bStr.trim() !== "") {
    return aNum - bNum;
  }

  // Date-like ISO strings sort correctly as strings; fall back to locale compare
  return aStr.localeCompare(bStr, "pt-BR", { numeric: true, sensitivity: "base" });
}

export function useSortableData<T>(
  data: T[] | undefined | null,
  options: UseSortableDataOptions<T> = {},
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

  const requestSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: null, direction: null };
      return { key, direction: "asc" };
    });
  }, []);

  const sortedData = useMemo(() => {
    const arr = Array.isArray(data) ? [...data] : [];
    if (!sortConfig.key || !sortConfig.direction) return arr;
    const key = sortConfig.key;
    const accessor = options.accessors?.[key];
    arr.sort((a, b) => {
      const av = accessor ? accessor(a) : defaultAccessor(a, key);
      const bv = accessor ? accessor(b) : defaultAccessor(b, key);
      const cmp = compareValues(av, bv);
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [data, sortConfig, options.accessors]);

  return { sortedData, sortConfig, requestSort };
}
