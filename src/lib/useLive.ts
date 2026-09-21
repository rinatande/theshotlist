"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";

/**
 * Re-renders whenever the IndexedDB data a query reads changes — so a screen
 * stays true after an edit anywhere, with no manual refresh. `undefined`
 * means still loading; the query's own result can be anything else.
 */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (result) => setValue(result),
      error: (err) => console.error(err),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
