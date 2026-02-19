import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { probeAvailability } from './probe';
import { ArxivNotFoundError } from './errors';

vi.mock('axios');

describe('probeAvailability', () => {
  const mockedAxios = vi.mocked(axios);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns type html when HEAD arxiv.org/html/{id} returns 200', async () => {
    mockedAxios.head.mockResolvedValueOnce({ status: 200 });

    const result = await probeAvailability('2401.12345');

    expect(result).toEqual({ 
      type: 'html', 
      url: 'https://arxiv.org/html/2401.12345' 
    });
    expect(mockedAxios.head).toHaveBeenCalledWith('https://arxiv.org/html/2401.12345');
  });

  it('returns type ar5iv when arXiv 404s but ar5iv 200s', async () => {
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockResolvedValueOnce({ status: 200 });

    const result = await probeAvailability('2401.12345');

    expect(result).toEqual({ 
      type: 'ar5iv', 
      url: 'https://ar5iv.org/html/2401.12345' 
    });
    expect(mockedAxios.head).toHaveBeenNthCalledWith(1, 'https://arxiv.org/html/2401.12345');
    expect(mockedAxios.head).toHaveBeenNthCalledWith(2, 'https://ar5iv.org/html/2401.12345');
  });

  it('returns type latex when both HTML endpoints 404 but HEAD e-print returns 200', async () => {
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockResolvedValueOnce({ status: 200 });

    const result = await probeAvailability('2401.12345');

    expect(result).toEqual({ 
      type: 'latex', 
      url: 'https://arxiv.org/e-print/2401.12345' 
    });
    expect(mockedAxios.head).toHaveBeenNthCalledWith(1, 'https://arxiv.org/html/2401.12345');
    expect(mockedAxios.head).toHaveBeenNthCalledWith(2, 'https://ar5iv.org/html/2401.12345');
    expect(mockedAxios.head).toHaveBeenNthCalledWith(3, 'https://arxiv.org/e-print/2401.12345');
  });

  it('throws ArxivNotFoundError when all endpoints fail', async () => {
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(probeAvailability('2401.12345')).rejects.toThrow(ArxivNotFoundError);
    expect(mockedAxios.head).toHaveBeenCalledTimes(4);
  });

  it('returns type pdf when all HTML and LaTeX fail but PDF is available', async () => {
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockRejectedValueOnce({ response: { status: 404 } });
    mockedAxios.head.mockResolvedValueOnce({ status: 200 });

    const result = await probeAvailability('2401.12345');

    expect(result).toEqual({ 
      type: 'pdf', 
      url: 'https://arxiv.org/pdf/2401.12345' 
    });
    expect(mockedAxios.head).toHaveBeenCalledTimes(4);
  });

  it('throws ArxivNotFoundError on network errors for all endpoints', async () => {
    mockedAxios.head.mockRejectedValueOnce(new Error('Network error'));
    mockedAxios.head.mockRejectedValueOnce(new Error('Network error'));
    mockedAxios.head.mockRejectedValueOnce(new Error('Network error'));
    mockedAxios.head.mockRejectedValueOnce(new Error('Network error'));

    await expect(probeAvailability('2401.12345')).rejects.toThrow(ArxivNotFoundError);
  });

  it('works with old format IDs', async () => {
    mockedAxios.head.mockResolvedValueOnce({ status: 200 });

    const result = await probeAvailability('hep-th/9802150');

    expect(result).toEqual({ 
      type: 'html', 
      url: 'https://arxiv.org/html/hep-th/9802150' 
    });
  });
});
