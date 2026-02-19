import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, execSync } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, unlinkSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import * as core from '@arxiv-to-kindle/core';

const cliPath = resolve(__dirname, '../dist/index.js');
const testDir = resolve(__dirname, 'fixtures');

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: testDir,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });
  });
}

describe('CLI Interface', () => {
  beforeAll(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('invalid arXiv ID', () => {
    it('should exit with code 1 for invalid ID', async () => {
      const result = await runCli(['invalid-id']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid arXiv ID');
    });

    it('should exit with code 1 for malformed ID', async () => {
      const result = await runCli(['not-a-valid-id']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid arXiv ID');
    });

    it('should exit with code 1 for empty ID', async () => {
      const result = await runCli(['']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid arXiv ID');
    });
  });

  describe('help output', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('arxiv-to-kindle');
      expect(result.stdout).toContain('Convert arXiv papers');
    });

    it('should show version with --version flag', async () => {
      const result = await runCli(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('0.1.0');
    });
  });

  describe('ID normalization', () => {
    it('should normalize new format arXiv ID', () => {
      const result = core.normalizeArxivId('2401.12345');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('2401.12345');
    });

    it('should normalize old format arXiv ID', () => {
      const result = core.normalizeArxivId('hep-th/9901001');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('hep-th/9901001');
    });

    it('should normalize arXiv URL', () => {
      const result = core.normalizeArxivId('https://arxiv.org/abs/2401.12345');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('2401.12345');
    });

    it('should extract version from ID', () => {
      const result = core.normalizeArxivId('2401.12345v2');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('2401.12345');
      expect(result?.version).toBe(2);
    });

    it('should return null for invalid ID', () => {
      const result = core.normalizeArxivId('invalid-id');
      
      expect(result).toBeNull();
    });
  });

  describe('options', () => {
    it('should show progress with --verbose flag', async () => {
      const result = await runCli(['--verbose', '2401.12345']);
      
      expect(result.stdout).toContain('arXiv ID:');
      expect(result.stdout).toContain('Output:');
    });

    it('should show math-svg option in help', async () => {
      const result = await runCli(['--help']);
      
      expect(result.stdout).toContain('--math-svg');
    });
  });
});
