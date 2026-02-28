# arxiv-to-kindle

[![npm version](https://img.shields.io/npm/v/arxiv-to-kindle.svg)](https://www.npmjs.com/package/arxiv-to-kindle)
[![npm](https://img.shields.io/npm/dt/arxiv-to-kindle.svg)](https://www.npmjs.com/package/arxiv-to-kindle)
[![npm package](https://img.shields.io/badge/npm-%40arxiv--to--kindle%2Fcore-blue)](https://www.npmjs.com/package/@arxiv-to-kindle/core)

Convert arXiv papers to EPUB format for e-readers like Kindle.

## Features

- Converts arXiv papers from HTML/HTML5 source to EPUB format
- Supports multiple arXiv ID formats (new and old style)
- Downloads and embeds images locally
- Preserves mathematical notation using MathML or SVG
- Centers images for better e-reader display
- Fixes duplicate list markers from LaTeXML output
- Converts internal links and footnotes to work offline
- Supports LaTeX source fallback (requires tex4ebook)

## Installation

### From npm

```bash
# Install CLI globally
npm install -g arxiv-to-kindle

# Or use npx
npx arxiv-to-kindle <arxiv-id-or-url>
```

### From npm (Programmatic)

```bash
npm install @arxiv-to-kindle/core
```

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Pandoc](https://pandoc.org/installing.html) 3.0+

Optional:
- [tex4ebook](https://github.com/michal-h21/tex4ebook) - for LaTeX source conversion

### Install from source

```bash
git clone https://github.com/anudeepreddy/arxiv-to-kindle.git
cd arxiv-to-kindle
npm install
npm run build
npm link
```

## Usage

### Command Line

```bash
arxiv-to-kindle <arxiv-id-or-url> [output-file]
```

Examples:

```bash
# Using arXiv ID
arxiv-to-kindle 2401.12345

# Using arXiv URL
arxiv-to-kindle https://arxiv.org/abs/2401.12345

# Specify output file
arxiv-to-kindle 2401.12345 paper.epub

# Use SVG for math rendering
arxiv-to-kindle 2401.12345 --math-svg

# Verbose output
arxiv-to-kindle 2401.12345 --verbose
```

### Options

| Option | Description |
|--------|-------------|
| `--math-svg` | Use SVG for math rendering instead of MathML |
| `--verbose` | Show detailed progress information |
| `--no-metadata` | Skip metadata injection |
| `--skip-preflight` | Skip dependency checks |

### Programmatic API

```typescript
import { convertArxivToEpub } from '@arxiv-to-kindle/core';

const result = await convertArxivToEpub(
  '2401.12345',
  'output.epub',
  {
    preferMathml: true,
    onProgress: (stage, message) => {
      console.log(`[${stage}] ${message}`);
    },
    metadata: {
      title: 'Custom Title',
      authors: ['Author Name'],
    },
  }
);

console.log(`Converted from ${result.format} source`);
```

## Supported Formats

The converter automatically detects and uses the best available source:

1. **HTML5** (preferred) - Newer papers with HTML source
2. **ar5iv** - HTML version from ar5iv.org
3. **LaTeX** - Requires tex4ebook installation
4. **PDF** - Not yet implemented

## How It Works

1. **Probe**: Checks available formats for the paper
2. **Fetch**: Downloads HTML content from arXiv or ar5iv
3. **Clean**: Removes scripts, styles, and event handlers
4. **Resolve**: Processes image URLs for local download
5. **Download**: Fetches all images to local storage
6. **Prepare**: Converts links, wraps math, injects CSS
7. **Convert**: Runs Pandoc to generate EPUB
8. **Metadata**: Injects paper metadata into EPUB

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

## Project Structure

```
arxiv-to-kindle/
├── apps/
│   └── cli/          # Command-line interface
├── packages/
│   └── core/         # Core conversion library
├── package.json
├── turbo.json
└── tsconfig.json
```

## License

MIT
