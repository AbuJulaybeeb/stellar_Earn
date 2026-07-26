import { useState, useEffect, useCallback, useRef } from 'react';
import { useVisibilityState } from './useVisibilityState';

interface UseWalletBalanceOptions {
  address?: string;
  intervalMs?: number; // Default 10,000ms
  debounceMs?: number; // Default 500ms
}

export function useWalletBalance({
  address,
  intervalMs = 10000,
  debounceMs = 500,
}: UseWalletBalanceOptions = {}) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const isVisible = useVisibilityState();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address || !isVisible) return;

    setLoading(true);
    try {
      // Call Soroban/RPC endpoint for account balances & trustlines
      const res = await fetch(`/api/wallet/balance?address=${address}`);
      const data = await res.json();
      setBalance(data.balance);
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isVisible]);

  // Debounced execution trigger
  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchBalance();
    }, debounceMs);
  }, [fetchBalance, debounceMs]);

  useEffect(() => {
    if (!address || !isVisible) return;

    // Trigger debounced fetch on initial mount / tab re-focus
    debouncedFetch();

    // Setup background interval polling
    const intervalId = setInterval(() => {
      fetchBalance();
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [address, isVisible, intervalMs, debouncedFetch, fetchBalance]);

  return { balance, loading, refetch: debouncedFetch };
}