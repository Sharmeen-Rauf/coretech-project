import { useCallback, useState } from "react";

export interface ScannedItem {
  serialNo: string;
}

// Backs every bulk-scan create screen (Sell Out, ST2, Buzzcart item entry -
// §3.1): scan-many, add-to-list, submit-once. Paired with BarcodeScanner,
// which stays open and calls add() on every distinct scan rather than
// closing after one hit. Rejects a serial already in the current batch
// (scanning the same physical unit twice in one session is always a
// mistake, not a valid duplicate line item) - the caller surfaces
// duplicateError however fits its own screen's design.
export function useScannedSerials() {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const add = useCallback((serialNo: string): boolean => {
    const trimmed = serialNo.trim();
    if (!trimmed) return false;

    let added = true;
    setItems((prev) => {
      if (prev.some((i) => i.serialNo.toLowerCase() === trimmed.toLowerCase())) {
        added = false;
        return prev;
      }
      return [...prev, { serialNo: trimmed }];
    });

    setDuplicateError(added ? null : `"${trimmed}" is already in this batch.`);
    return added;
  }, []);

  const remove = useCallback((serialNo: string) => {
    setItems((prev) => prev.filter((i) => i.serialNo !== serialNo));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDuplicateError(null);
  }, []);

  return { items, add, remove, clear, duplicateError };
}
