import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { downloadImages, ImageDownloadResult } from './image-downloader';

vi.mock('axios');
vi.mock('fs-extra');

describe('downloadImages', () => {
  const mockedAxios = vi.mocked(axios);
  const mockedFs = vi.mocked(fs);

  beforeEach(() => {
    vi.resetAllMocks();
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads 5 images successfully', async () => {
    const urls = [
      'https://example.com/image1.png',
      'https://example.com/image2.jpg',
      'https://example.com/image3.gif',
      'https://example.com/image4.svg',
      'https://example.com/image5.webp',
    ];

    urls.forEach((url, index) => {
      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from(`fake-image-data-${index}`),
        headers: { 'content-type': 'image/png' },
      });
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results).toHaveLength(5);
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.originalUrl).toBe(urls[index]);
      expect(result.localPath).toContain('/tmp/images');
      expect(result.error).toBeUndefined();
    });
    expect(mockedFs.ensureDir).toHaveBeenCalledWith('/tmp/images');
  });

  it('handles 404 on one image without throwing', async () => {
    const urls = [
      'https://example.com/good-image.png',
      'https://example.com/missing-image.png',
      'https://example.com/another-good.png',
    ];

    mockedAxios.get
      .mockResolvedValueOnce({
        data: Buffer.from('good-data'),
        headers: { 'content-type': 'image/png' },
      })
      .mockRejectedValueOnce({
        response: { status: 404 },
      })
      .mockResolvedValueOnce({
        data: Buffer.from('more-data'),
        headers: { 'content-type': 'image/png' },
      });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toContain('404');
    expect(results[2].success).toBe(true);
  });

  it('creates tempDir if it does not exist', async () => {
    const urls = ['https://example.com/test.png'];
    
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('data'),
      headers: { 'content-type': 'image/png' },
    });

    await downloadImages(urls, '/new/temp/dir');

    expect(mockedFs.ensureDir).toHaveBeenCalledWith('/new/temp/dir');
  });

  it('downloads images concurrently', async () => {
    const urls = [
      'https://example.com/a.png',
      'https://example.com/b.png',
      'https://example.com/c.png',
      'https://example.com/d.png',
      'https://example.com/e.png',
      'https://example.com/f.png',
      'https://example.com/g.png',
    ];

    const callOrder: number[] = [];
    
    urls.forEach((_, index) => {
      mockedAxios.get.mockImplementationOnce(async () => {
        callOrder.push(index);
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          data: Buffer.from(`data-${index}`),
          headers: { 'content-type': 'image/png' },
        };
      });
    });

    await downloadImages(urls, '/tmp/images', { concurrency: 3 });

    expect(mockedAxios.get).toHaveBeenCalledTimes(7);
    
    expect(callOrder.slice(0, 3)).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(callOrder.slice(3, 6)).toEqual(expect.arrayContaining([3, 4, 5]));
  });

  it('uses custom concurrency setting', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/img${i}.png`);

    urls.forEach(() => {
      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from('data'),
        headers: { 'content-type': 'image/png' },
      });
    });

    await downloadImages(urls, '/tmp/images', { concurrency: 2 });

    expect(mockedAxios.get).toHaveBeenCalledTimes(10);
  });

  it('uses custom timeout setting', async () => {
    const urls = ['https://example.com/test.png'];

    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('data'),
      headers: { 'content-type': 'image/png' },
    });

    await downloadImages(urls, '/tmp/images', { timeout: 5000 });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com/test.png',
      expect.objectContaining({
        timeout: 5000,
      })
    );
  });

  it('generates unique filenames for duplicate image names', async () => {
    const urls = [
      'https://example.com/figure1.png',
      'https://other.com/figure1.png',
    ];

    urls.forEach(() => {
      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from('data'),
        headers: { 'content-type': 'image/png' },
      });
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].localPath).not.toBe(results[1].localPath);
  });

  it('detects extension from Content-Type when URL has no extension', async () => {
    const urls = ['https://example.com/generated-image'];

    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('data'),
      headers: { 'content-type': 'image/jpeg' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.jpg$/);
  });

  it('handles various image extensions', async () => {
    const testCases = [
      { url: 'https://example.com/img.png', expectedExt: '.png' },
      { url: 'https://example.com/img.jpg', expectedExt: '.jpg' },
      { url: 'https://example.com/img.jpeg', expectedExt: '.jpeg' },
      { url: 'https://example.com/img.gif', expectedExt: '.gif' },
      { url: 'https://example.com/img.svg', expectedExt: '.svg' },
      { url: 'https://example.com/img.webp', expectedExt: '.webp' },
    ];

    testCases.forEach(({ url }) => {
      mockedAxios.get.mockResolvedValueOnce({
        data: Buffer.from('data'),
        headers: { 'content-type': 'image/png' },
      });
    });

    const results = await downloadImages(
      testCases.map(tc => tc.url),
      '/tmp/images'
    );

    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.localPath).toContain(testCases[index].expectedExt);
    });
  });

  it('uses .bin extension when Content-Type is unknown', async () => {
    const urls = ['https://example.com/unknown'];

    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('data'),
      headers: { 'content-type': 'application/octet-stream' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.bin$/);
  });

  it('handles timeout errors gracefully', async () => {
    const urls = ['https://example.com/slow-image.png'];

    mockedAxios.get.mockRejectedValueOnce({
      code: 'ECONNABORTED',
      message: 'timeout of 30000ms exceeded',
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('timeout');
  });

  it('handles network errors gracefully', async () => {
    const urls = ['https://example.com/unreachable.png'];

    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Network error');
  });

  it('uses axios with arraybuffer responseType', async () => {
    const urls = ['https://example.com/test.png'];

    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('data'),
      headers: { 'content-type': 'image/png' },
    });

    await downloadImages(urls, '/tmp/images');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com/test.png',
      expect.objectContaining({
        responseType: 'arraybuffer',
      })
    );
  });

  it('returns empty array for empty URLs', async () => {
    const results = await downloadImages([], '/tmp/images');

    expect(results).toHaveLength(0);
    expect(mockedFs.ensureDir).toHaveBeenCalledWith('/tmp/images');
  });

  it('detects SVG from Content-Type image/svg+xml', async () => {
    const urls = ['https://example.com/generated-image'];

    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('<svg></svg>'),
      headers: { 'content-type': 'image/svg+xml' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.svg$/);
  });

  it('detects PNG from binary content signature', async () => {
    const urls = ['https://example.com/unknown-extension.shtml'];
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    mockedAxios.get.mockResolvedValueOnce({
      data: pngBuffer,
      headers: { 'content-type': 'application/octet-stream' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.png$/);
  });

  it('detects JPEG from binary content signature', async () => {
    const urls = ['https://example.com/image.shtml'];
    const jpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

    mockedAxios.get.mockResolvedValueOnce({
      data: jpgBuffer,
      headers: { 'content-type': 'application/octet-stream' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.jpg$/);
  });

  it('detects SVG from content starting with <svg>', async () => {
    const urls = ['https://example.com/generated'];
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from(svgContent),
      headers: { 'content-type': 'text/html' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.svg$/);
  });

  it('handles URLs ending with .shtml extension', async () => {
    const urls = ['https://example.com/chart.shtml'];
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    mockedAxios.get.mockResolvedValueOnce({
      data: pngBuffer,
      headers: { 'content-type': 'image/png' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.png$/);
  });

  it('uses Content-Type over URL extension for unknown binary formats', async () => {
    const urls = ['https://example.com/page.shtml'];

    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('svg content'),
      headers: { 'content-type': 'image/svg+xml' },
    });

    const results = await downloadImages(urls, '/tmp/images');

    expect(results[0].success).toBe(true);
    expect(results[0].localPath).toMatch(/\.svg$/);
  });
});
