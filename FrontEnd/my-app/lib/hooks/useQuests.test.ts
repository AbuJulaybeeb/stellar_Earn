import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuests } from './useQuests';
import type { QuestQueryParams } from '@/lib/types/api.types';

const { mockGetQuests, mockStoreActions, mockUseStore } = vi.hoisted(() => {
  const mockGetQuests = vi.fn();

  const mockStoreState: Record<string, unknown> = {
    quests: [],
    questsLoading: false,
    questsError: null,
    pagination: null,
  };

  const mockStoreActions = {
    setQuests: vi.fn(),
    setQuestsLoading: vi.fn(),
    setQuestsError: vi.fn(),
    setQuestPagination: vi.fn(),
  };

  const mockUseStore = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ ...mockStoreState, ...mockStoreActions });

  return { mockGetQuests, mockStoreActions, mockUseStore };
});

vi.mock('@/lib/store', () => ({
  useStore: mockUseStore,
}));

vi.mock('@/lib/api/quests', () => ({
  getQuests: (...args: any[]) => mockGetQuests(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const emptyResponse = {
  quests: [],
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 0,
};

describe('useQuests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes a cancel token to getQuests and aborts it on unmount', async () => {
    const pending = deferred<typeof emptyResponse>();
    mockGetQuests.mockReturnValue(pending.promise);

    const { unmount } = renderHook(() => useQuests());

    await waitFor(() => {
      expect(mockGetQuests).toHaveBeenCalledTimes(1);
    });

    const cancelToken = mockGetQuests.mock.calls[0][1];
    expect(cancelToken).toBeDefined();
    expect(cancelToken.signal.aborted).toBe(false);

    unmount();

    expect(cancelToken.signal.aborted).toBe(true);
  });

  it('cancels the previous in-flight request when filters change', async () => {
    const first = deferred<typeof emptyResponse>();
    mockGetQuests.mockReturnValueOnce(first.promise);

    const { rerender } = renderHook(
      ({ filters }: { filters: QuestQueryParams }) => useQuests(filters),
      { initialProps: { filters: { status: 'Active' } as QuestQueryParams } }
    );

    await waitFor(() => {
      expect(mockGetQuests).toHaveBeenCalledTimes(1);
    });
    const firstToken = mockGetQuests.mock.calls[0][1];
    expect(firstToken.signal.aborted).toBe(false);

    mockGetQuests.mockResolvedValueOnce(emptyResponse);
    rerender({ filters: { status: 'Completed' } as QuestQueryParams });

    await waitFor(() => {
      expect(mockGetQuests).toHaveBeenCalledTimes(2);
    });

    expect(firstToken.signal.aborted).toBe(true);
  });

  it('does not report an error when the request was cancelled, not failed', async () => {
    const pending = deferred<typeof emptyResponse>();
    mockGetQuests.mockReturnValue(pending.promise);

    const { unmount } = renderHook(() => useQuests());

    await waitFor(() => {
      expect(mockGetQuests).toHaveBeenCalledTimes(1);
    });
    const cancelToken = mockGetQuests.mock.calls[0][1];

    unmount();
    // Simulate the in-flight request rejecting after cancellation, as a
    // real aborted axios request would.
    const abortError = new Error('canceled');
    abortError.name = 'CanceledError';
    pending.reject(abortError);

    await new Promise((r) => setTimeout(r, 0));

    expect(cancelToken.signal.aborted).toBe(true);
    // setQuestsError(null) is called up front to clear stale error state —
    // what must never happen is being called with an actual error message
    // for a request we deliberately cancelled.
    for (const call of mockStoreActions.setQuestsError.mock.calls) {
      expect(call[0]).toBeNull();
    }
  });
});
