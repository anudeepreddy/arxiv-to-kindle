import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export interface ImageDownloadResult {
  originalUrl: string;
  localPath: string;
  success: boolean;
  error?: string;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

const CONTENT_TYPE_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
};

const BINARY_EXTENSIONS = ['.shtml', '.html', '.htm', '.php', '.asp', '.aspx', '.jsp'];

const SVG_EXTENSIONS = ['.svg', '.svgz'];

function isSvgContent(data: Buffer): boolean {
  const header = data.slice(0, 200).toString('utf8').toLowerCase().trim();
  return header.startsWith('<?xml') || header.startsWith('<svg') || header.includes('<svg');
}

function generateFilename(url: string, isSvg: boolean = false): string {
  const urlHash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
  
  try {
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    
    if (isSvg || ext === '.svg' || ext === '.svgz') {
      const baseName = path.basename(urlPath, ext) || 'image';
      const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      return `${sanitizedBase}_${urlHash}.svg`;
    }
    
    if (IMAGE_EXTENSIONS.includes(ext)) {
      const baseName = path.basename(urlPath, ext);
      const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      return `${sanitizedBase}_${urlHash}${ext}`;
    }
    
    if (BINARY_EXTENSIONS.includes(ext) || ext === '') {
      return `image_${urlHash}.bin`;
    }
  } catch {
    // Invalid URL, fall through to hash-based name
  }
  
  return `image_${urlHash}.bin`;
}

function getExtensionFromContentType(contentType: string | undefined): string {
  if (!contentType) return '.bin';
  
  const normalizedType = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_MAP[normalizedType] || '.bin';
}

async function downloadSingleImage(
  url: string,
  tempDir: string,
  timeout: number
): Promise<ImageDownloadResult> {
  const tempFilename = generateFilename(url);
  const localPath = path.join(tempDir, tempFilename);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const contentType = response.headers['content-type'];
    let data = Buffer.isBuffer(response.data) 
      ? response.data 
      : Buffer.from(response.data);
    
    // Check if content is SVG
    const isSvg = isSvgContent(data);
    
    // Generate proper filename based on content type
    let finalFilename: string;
    if (isSvg) {
      finalFilename = generateFilename(url, true);
    } else {
      finalFilename = generateFilename(url);
      
      // If still .bin, try to detect from content type
      if (finalFilename.endsWith('.bin') && contentType) {
        const ext = getExtensionFromContentType(contentType);
        if (ext !== '.bin') {
          finalFilename = finalFilename.replace('.bin', ext);
        }
      }
      
      // If still .bin, try content detection
      if (finalFilename.endsWith('.bin')) {
        const detectedExt = detectExtensionFromContent(data, contentType);
        if (detectedExt) {
          finalFilename = finalFilename.replace('.bin', detectedExt);
        }
      }
    }
    
    const finalPath = path.join(tempDir, finalFilename);
    await fs.writeFile(finalPath, data);
    
    return {
      originalUrl: url,
      localPath: finalPath,
      success: true,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        errorMessage = 'Image not found (404)';
      } else if (error.response) {
        errorMessage = `HTTP ${error.response.status}`;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout';
      } else {
        errorMessage = error.message;
      }
    } else if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      if (err.response && typeof err.response === 'object') {
        const status = (err.response as Record<string, unknown>).status;
        if (status === 404) {
          errorMessage = 'Image not found (404)';
        } else if (typeof status === 'number') {
          errorMessage = `HTTP ${status}`;
        }
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout';
      } else if (typeof err.message === 'string') {
        errorMessage = err.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      originalUrl: url,
      localPath,
      success: false,
      error: errorMessage,
    };
  }
}

function detectExtensionFromContent(data: Buffer, contentType: string | undefined): string | null {
  if (data.length < 4) return null;
  
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return '.png';
  }
  
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return '.jpg';
  }
  
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return '.gif';
  }
  
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    if (data.length >= 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      return '.webp';
    }
  }
  
  const headerStr = data.slice(0, 100).toString('utf8').toLowerCase();
  if (headerStr.includes('<svg') || headerStr.includes('<?xml')) {
    return '.svg';
  }
  
  if (contentType && contentType.includes('svg')) {
    return '.svg';
  }
  
  return null;
}

export async function downloadImages(
  urls: string[],
  tempDir: string,
  options?: {
    concurrency?: number;
    timeout?: number;
  }
): Promise<ImageDownloadResult[]> {
  const concurrency = options?.concurrency ?? 5;
  const timeout = options?.timeout ?? 30000;
  
  await fs.ensureDir(tempDir);
  
  const results: ImageDownloadResult[] = [];
  
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => downloadSingleImage(url, tempDir, timeout))
    );
    results.push(...batchResults);
  }
  
  return results;
}
