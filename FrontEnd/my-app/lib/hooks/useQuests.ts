'use client';

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getQuests } from '@/lib/api/quests';
import { createCancelToken } from '@/lib/api/client';
import type { QuestQueryParams, PaginationParams } from '@/lib/types/api.types';

export function useQuests(
  filters?: QuestQueryParams,
  pagination?: PaginationParams
) {
  const quests = useStore((s) => s.quests);
  const questsLoading = useStore((s) => s.questsLoading);
  const questsError = useStore((s) => s.questsError);
  const paginationData = useStore((s) => s.pagination);
  const setQuests = useStore((s) => s.setQuests);
  const setQuestsLoading = useStore((s) => s.setQuestsLoading);
  const setQuestsError = useStore((s) => s.setQuestsError);
  const setPagination = useStore((s) => s.setQuestPagination);

  // Memoize filters to avoid unnecessary re-renders when the object reference changes
  // but the values remain the same.
  const memoizedFilters = useMemo(
    () => filters,
    [
      filters?.status,
      filters?.category,
      filters?.difficulty,
      filters?.search,
      filters?.minReward,
      filters?.maxReward,
      filters?.sortBy,
      filters?.order,
    ]
  );

  const memoizedPagination = useMemo(
    () => pagination,
    [pagination?.page, pagination?.limit, pagination?.cursor]
  );

  // Tracks the in-flight request's cancel token so a superseding fetch (new
  // filters, a manual refetch, or the component unmounting) can abort it
  // instead of letting it race a newer request or update state after unmount.
  const cancelTokenRef = useRef<ReturnType<typeof createCancelToken> | null>(
    null
  );

  const fetchQuests = useCallback(async () => {
    cancelTokenRef.current?.cancel();
    const cancelToken = createCancelToken();
    cancelTokenRef.current = cancelToken;

    try {
      setQuestsLoading(true);
      setQuestsError(null);

      const response = await getQuests(
        {
          ...memoizedFilters,
          ...memoizedPagination,
        },
        cancelToken
      );
      setQuests(response.quests as any);
      setPagination({
        page: response.page ?? 1,
        limit: response.limit ?? 12,
        total: response.total ?? 0,
        totalPages: response.totalPages ?? 0,
        hasMore: (response.page ?? 0) < (response.totalPages ?? 0),
      });
    } catch (err) {
      // A cancelled request isn't a real error — either a newer fetch
      // superseded it, or the component unmounted. Don't surface stale
      // error state for it.
      if (cancelToken.signal.aborted) return;

      setQuestsError(
        err instanceof Error ? err.message : 'Failed to fetch quests'
      );
      setQuests([]);
    } finally {
      // Only the request that "won" should clear the loading flag — if
      // this one was cancelled, whatever superseded it owns that state.
      if (!cancelToken.signal.aborted) {
        setQuestsLoading(false);
      }
    }
  }, [
    memoizedFilters,
    memoizedPagination,
    setQuestsLoading,
    setQuestsError,
    setQuests,
    setPagination,
    getQuests,
  ]);

  useEffect(() => {
    fetchQuests();
    return () => {
      cancelTokenRef.current?.cancel();
    };
  }, [fetchQuests]);

  return {
    quests,
    isLoading: questsLoading,
    error: questsError ? new Error(questsError) : null,
    pagination: paginationData,
    refetch: fetchQuests,
  };
}
