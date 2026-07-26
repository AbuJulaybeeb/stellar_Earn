import { renderHook, act } from '@testing-library/react-hooks';
import { useWalletBalance } from './useWalletBalance';

describe('useWalletBalance Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ balance: '100.50' }),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('debounces balance requests on initial invocation', async () => {
    const { result } = renderHook(() => useWalletBalance({ address: 'GABC123' }));

    expect(global.fetch).not.toHaveBeenCalled();

    // Advance time past the debounce threshold
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('pauses polling when document visibility becomes hidden', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });

    renderHook(() => useWalletBalance({ address: 'GABC123' }));

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});