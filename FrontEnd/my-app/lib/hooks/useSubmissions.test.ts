import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSubmissions } from './useSubmissions';

const { mockFetchSubmissions, mockStoreActions, mockUseStore } = vi.hoisted(
  () => {
    const mockFetchSubmissions = vi.fn();

    const mockStoreState: Record<string, unknown> = {
      submissions: [],
      submissionsLoading: false,
      submissionsError: null,
      submissionPagination: { page: 1, limit: 20, hasMore: false },
    };

    const mockStoreActions = {
      setSubmissions: vi.fn(),
      setSubmissionsLoading: vi.fn(),
      setSubmissionsError: vi.fn(),
      setSubmissionPagination: vi.fn(),
      setSubmissionFilters: vi.fn(),
      optimisticallyUpdateSubmission: vi.fn(),
    };

    const mockUseStore = (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ ...mockStoreState, ...mockStoreActions });

    return { mockFetchSubmissions, mockStoreActions, mockUseStore };
  }
);

vi.mock('@/lib/store', () => ({
  useStore: mockUseStore,
}));

vi.mock('@/lib/api/submissions', () => ({
  fetchSubmissions: (...args: any[]) => mockFetchSubmissions(...args),
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

type SubmissionsResponse = {
  data: never[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

describe('useSubmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes a cancel token to fetchSubmissions and aborts it on unmount', async () => {
    const pending = deferred<SubmissionsResponse>();
    mockFetchSubmissions.mockReturnValue(pending.promise);

    const { unmount } = renderHook(() => useSubmissions());

    await waitFor(() => {
      expect(mockFetchSubmissions).toHaveBeenCalledTimes(1);
    });

    const cancelToken = mockFetchSubmissions.mock.calls[0][2];
    expect(cancelToken).toBeDefined();
    expect(cancelToken.signal.aborted).toBe(false);

    unmount();

    expect(cancelToken.signal.aborted).toBe(true);
  });

  it('does not report an error for a cancelled request', async () => {
    const pending = deferred<SubmissionsResponse>();
    mockFetchSubmissions.mockReturnValue(pending.promise);

    const { unmount } = renderHook(() => useSubmissions());

    await waitFor(() => {
      expect(mockFetchSubmissions).toHaveBeenCalledTimes(1);
    });

    unmount();
    const abortError = new Error('canceled');
    abortError.name = 'CanceledError';
    // Simulate the in-flight request rejecting after cancellation, as a
    // real aborted axios request would.
    pending.reject(abortError);

    await new Promise((r) => setTimeout(r, 0));

    for (const call of mockStoreActions.setSubmissionsError.mock.calls) {
      expect(call[0]).toBeNull();
    }
  });
});
