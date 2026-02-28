import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { fetchHtml } from './fetcher';
import { NotFoundError, FetchError } from './errors';

vi.mock('axios');

describe('fetchHtml', () => {
  const mockedAxios = vi.mocked(axios);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns HTML content when server returns 200', async () => {
    const htmlContent = '<html><body>Test</body></html>';
    mockedAxios.get.mockResolvedValueOnce({
      data: htmlContent,
      request: { res: { responseUrl: 'https://example.com' } },
    });

    const result = await fetchHtml('https://example.com');

    expect(result.html).toContain('<html>');
    expect(result.finalUrl).toBe('https://example.com');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        timeout: 30000,
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      })
    );
  });

  it('retries on 500 errors and succeeds', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 502 } })
      .mockResolvedValueOnce({ data: '<html>Success</html>', request: { res: { responseUrl: 'https://example.com' } } });

    const fetchPromise = fetchHtml('https://example.com');
    await vi.runAllTimersAsync();
    const result = await fetchPromise;

    expect(result.html).toContain('<html>');
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('throws NotFoundError on 404 response', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(fetchHtml('https://example.com')).rejects.toThrow(NotFoundError);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('throws FetchError immediately on other 4xx errors', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 403 } });

    await expect(fetchHtml('https://example.com')).rejects.toThrow(FetchError);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff delays', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: '<html>Success</html>', request: { res: { responseUrl: 'https://example.com' } } });

    const fetchPromise = fetchHtml('https://example.com');

    await vi.advanceTimersByTimeAsync(100);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(200);
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);

    const result = await fetchPromise;
    expect(result.html).toContain('<html>');
  });

  it('throws FetchError on timeout after retries exhausted', async () => {
    const timeoutError = new Error('timeout of 30000ms exceeded');
    (timeoutError as any).code = 'ECONNABORTED';
    
    mockedAxios.get
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const fetchPromise = fetchHtml('https://example.com', { maxRetries: 1 });
    
    vi.runAllTimersAsync().then(() => {});
    
    const error = await fetchPromise.catch(e => e);
    expect(error).toBeInstanceOf(FetchError);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('throws FetchError after max retries exceeded', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } });

    const fetchPromise = fetchHtml('https://example.com', { maxRetries: 2 });
    
    vi.runAllTimersAsync().then(() => {});

    const error = await fetchPromise.catch(e => e);
    expect(error).toBeInstanceOf(FetchError);
    expect(error.message).toContain('after 3 attempts');
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('uses custom timeout and maxRetries options', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: '<html>Test</html>', request: { res: { responseUrl: 'https://example.com' } } });

    await fetchHtml('https://example.com', { timeout: 5000, maxRetries: 1 });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        timeout: 5000,
      })
    );
  });

  it('rotates user agents on retries', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: '<html>Success</html>', request: { res: { responseUrl: 'https://example.com' } } });

    const fetchPromise = fetchHtml('https://example.com');
    await vi.runAllTimersAsync();
    await fetchPromise;

    const firstCall = mockedAxios.get.mock.calls[0][1];
    const secondCall = mockedAxios.get.mock.calls[1][1];
    const thirdCall = mockedAxios.get.mock.calls[2][1];

    expect(firstCall.headers['User-Agent']).toBeDefined();
    expect(secondCall.headers['User-Agent']).toBeDefined();
    expect(thirdCall.headers['User-Agent']).toBeDefined();

    expect(firstCall.headers['User-Agent']).not.toBe(secondCall.headers['User-Agent']);
    expect(secondCall.headers['User-Agent']).not.toBe(thirdCall.headers['User-Agent']);
  });

  it('retries on network errors', async () => {
    mockedAxios.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: '<html>Success</html>', request: { res: { responseUrl: 'https://example.com' } } });

    const fetchPromise = fetchHtml('https://example.com');
    await vi.runAllTimersAsync();
    const result = await fetchPromise;

    expect(result.html).toContain('<html>');
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});
