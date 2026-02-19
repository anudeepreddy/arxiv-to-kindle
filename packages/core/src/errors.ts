export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Resource not found: ${url}`);
    this.name = 'NotFoundError';
  }
}

export class FetchError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'FetchError';
  }
}

export class PandocError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string
  ) {
    super(message);
    this.name = 'PandocError';
  }
}

export class LatexConversionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'LatexConversionError';
  }
}

export class DependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyError';
  }
}

export class ArxivNotFoundError extends Error {
  constructor(id: string) {
    super(`Paper not found on arXiv: ${id}`);
    this.name = 'ArxivNotFoundError';
  }
}

export class PandocNotInstalledError extends DependencyError {
  constructor() {
    super('Pandoc not found. Install via: https://pandoc.org/installing.html');
    this.name = 'PandocNotInstalledError';
  }
}

export class Tex4ebookNotInstalledError extends DependencyError {
  constructor() {
    super('tex4ebook not found. Install via: https://github.com/michal-h21/tex4ebook');
    this.name = 'Tex4ebookNotInstalledError';
  }
}

export class ConversionTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Conversion timed out after ${timeout}ms`);
    this.name = 'ConversionTimeoutError';
  }
}

export class InvalidIdError extends Error {
  constructor(input: string) {
    super(`Invalid arXiv ID: ${input}`);
    this.name = 'InvalidIdError';
  }
}
