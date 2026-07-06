"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { normalizeRevenueShareLedgerEntry } from "@/lib/firebase/revenue-share";
import { RevenueShareLedgerEntry } from "@/lib/types";

type UseRevenueShareLedgerOptions = {
  businessId?: string;
  enabled?: boolean;
};

function monthKey(value: Date | null) {
  if (!value) {
    return "";
  }

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function useRevenueShareLedger(
  options: UseRevenueShareLedgerOptions = {}
) {
  const { businessId, enabled = true } = options;
  const [entries, setEntries] = useState<RevenueShareLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    if (!enabled) {
      setEntries([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    async function start() {
      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);

        if (!db || cancelled) {
          return;
        }

        const constraints = businessId
          ? [firestoreModule.where("businessId", "==", businessId)]
          : [];

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.query(
            firestoreModule.collection(db, "revenue_share_ledger"),
            ...constraints
          ),
          (snapshot) => {
            if (cancelled) {
              return;
            }

            const nextEntries = snapshot.docs
              .map((docSnapshot) =>
                normalizeRevenueShareLedgerEntry(docSnapshot.data(), docSnapshot.id)
              )
              .sort(
                (left, right) =>
                  (right.createdAt?.getTime() ?? 0) -
                  (left.createdAt?.getTime() ?? 0)
              );

            setEntries(nextEntries);
            setLoading(false);
          },
          (snapshotError) => {
            if (!cancelled) {
              setError(formatFirebaseError(snapshotError));
              setLoading(false);
            }
          }
        );
      } catch (startError) {
        if (!cancelled) {
          setError(formatFirebaseError(startError));
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [businessId, enabled]);

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = monthKey(now);

    return entries.reduce(
      (accumulator, entry) => {
        accumulator.totalSalesCents += entry.saleAmountCents;
        accumulator.totalPlatformFeesCents += entry.platformFeeCents;
        accumulator.totalPendingPayoutCents +=
          entry.status === "pending_payout" ? entry.netToBusinessCents : 0;

        if (monthKey(entry.createdAt) === currentMonth) {
          accumulator.monthSalesCents += entry.saleAmountCents;
          accumulator.monthPlatformFeesCents += entry.platformFeeCents;
          accumulator.monthNetToBusinessCents += entry.netToBusinessCents;
        }

        return accumulator;
      },
      {
        totalSalesCents: 0,
        totalPlatformFeesCents: 0,
        totalPendingPayoutCents: 0,
        monthSalesCents: 0,
        monthPlatformFeesCents: 0,
        monthNetToBusinessCents: 0
      }
    );
  }, [entries]);

  return { entries, summary, loading, error };
}
