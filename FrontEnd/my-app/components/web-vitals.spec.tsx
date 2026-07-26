import { render } from '@testing-library/react';
import { WebVitals } from './web-vitals';
import { useReportWebVitals } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useReportWebVitals: jest.fn(),
}));

describe('WebVitals Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'sendBeacon', {
      writable: true,
      value: jest.fn().mockReturnValue(true),
    });
  });

  it('should register useReportWebVitals hook on render', () => {
    render(<WebVitals />);
    expect(useReportWebVitals).toHaveBeenCalledTimes(1);
  });

  it('should send beacon when metric callback is executed', () => {
    let reportCallback: (metric: any) => void = () => {};
    (useReportWebVitals as jest.Mock).mockImplementation((cb) => {
      reportCallback = cb;
    });

    render(<WebVitals />);

    const mockMetric = {
      id: 'v3-12345',
      name: 'LCP',
      value: 1200,
      label: 'web-vital',
      startTime: 100,
    };

    reportCallback(mockMetric);

    expect(navigator.sendBeacon).toHaveBeenCalledWith(
      '/api/analytics/vitals',
      JSON.stringify({
        id: 'v3-12345',
        name: 'LCP',
        value: '1200',
        label: 'web-vital',
        startTime: 100,
      }),
    );
  });
});