import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReputation } from './useReputation';

// Mock the global fetch so reputation API calls are controllable in tests.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockReputation = {
  userId: 'user-1',
  score: 850,
  tier: 'gold',
  badges: ['early-adopter'],
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useReputation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is disabled and returns null when no userId is provided', async () => {
    const { result } = renderHook(() => useReputation(), {
      wrapper: makeWrapper(),
    });

    // No fetch should fire when userId is absent.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.reputation).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches and returns reputation data for a given userId', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReputation,
    });

    const { result } = renderHook(() => useReputation('user-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reputation).toEqual(mockReputation);
    expect(mockFetch).toHaveBeenCalledWith('/api/reputation/user-1');
    expect(result.current.error).toBeNull();
  });

  it('exposes an error when the reputation endpoint returns a non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useReputation('user-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reputation).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch reputation');
  });

  it('deduplicates concurrent calls for the same userId', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockReputation,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    renderHook(() => useReputation('user-1'), { wrapper });
    renderHook(() => useReputation('user-1'), { wrapper });

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledTimes(1)
    );
  });
});
