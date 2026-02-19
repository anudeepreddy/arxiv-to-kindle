import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { injectMetadata, type EpubMetadata } from './epub-meta';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

const testEpubDir = path.join(process.cwd(), 'test-epubs');

function createMinimalEpub(targetPath: string, extraContent = ''): void {
  const zip = new AdmZip();
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.addFile('META-INF/container.xml', Buffer.from(containerXml, 'utf8'));
  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Old Title</dc:title>
    <dc:creator>Old Author</dc:creator>
    <dc:description>Old Description</dc:description>
    <dc:identifier id="BookId">old-id</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="nav"/>
  </spine>
</package>${extraContent}`;
  zip.addFile('OEBPS/content.opf', Buffer.from(contentOpf, 'utf8'));
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body><nav epub:type="toc"><ol><li><a href="content.xhtml">Content</a></li></ol></nav></body>
</html>`;
  zip.addFile('OEBPS/nav.xhtml', Buffer.from(navXhtml, 'utf8'));
  zip.writeZip(targetPath);
}

function readOpfContent(epubPath: string): string {
  const zip = new AdmZip(epubPath);
  const opfEntry = zip.getEntry('OEBPS/content.opf');
  if (!opfEntry) {
    throw new Error('OPF not found');
  }
  return opfEntry.getData().toString('utf8');
}

describe('injectMetadata', () => {
  beforeEach(() => {
    if (!fs.existsSync(testEpubDir)) {
      fs.mkdirSync(testEpubDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testEpubDir)) {
      fs.rmSync(testEpubDir, { recursive: true, force: true });
    }
  });

  it('injects basic metadata into EPUB', async () => {
    const epubPath = path.join(testEpubDir, 'test-basic.epub');
    createMinimalEpub(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
      abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
      arxivId: '1706.03762',
      subjects: ['Machine Learning', 'Deep Learning']
    };
    
    await injectMetadata(epubPath, metadata);
    
    const opfContent = readOpfContent(epubPath);
    expect(opfContent).toContain('<dc:title>Attention Is All You Need</dc:title>');
    expect(opfContent).toContain('<dc:creator>Ashish Vaswani</dc:creator>');
    expect(opfContent).toContain('<dc:creator>Noam Shazeer</dc:creator>');
    expect(opfContent).toContain('<dc:description>');
    expect(opfContent).toContain('sequence transduction');
    expect(opfContent).toContain('<dc:identifier id="BookId">arxiv:1706.03762</dc:identifier>');
    expect(opfContent).toContain('<dc:subject>Machine Learning</dc:subject>');
    expect(opfContent).toContain('<dc:subject>Deep Learning</dc:subject>');
    expect(opfContent).toContain('<dc:language>en</dc:language>');
    expect(opfContent).not.toContain('Old Title');
    expect(opfContent).not.toContain('Old Author');
    expect(opfContent).not.toContain('old-id');
  });

  it('handles multiple authors correctly', async () => {
    const epubPath = path.join(testEpubDir, 'test-multi-author.epub');
    createMinimalEpub(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'Multi-Author Paper',
      authors: ['Author One', 'Author Two', 'Author Three', 'Author Four'],
      abstract: 'Testing multiple authors.',
      arxivId: '2401.12345',
      subjects: ['Test']
    };
    
    await injectMetadata(epubPath, metadata);
    
    const opfContent = readOpfContent(epubPath);
    const creatorMatches = opfContent.match(/<dc:creator>/g);
    expect(creatorMatches).toHaveLength(4);
    expect(opfContent).toContain('<dc:creator>Author One</dc:creator>');
    expect(opfContent).toContain('<dc:creator>Author Two</dc:creator>');
    expect(opfContent).toContain('<dc:creator>Author Three</dc:creator>');
    expect(opfContent).toContain('<dc:creator>Author Four</dc:creator>');
  });

  it('escapes special characters in title and abstract', async () => {
    const epubPath = path.join(testEpubDir, 'test-special-chars.epub');
    createMinimalEpub(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'Title with <special> & "quotes" and \'apostrophes\'',
      authors: ['Author'],
      abstract: 'Abstract with <tags> & symbols and "more quotes".',
      arxivId: '2401.00001',
      subjects: ['Test & More']
    };
    
    await injectMetadata(epubPath, metadata);
    
    const opfContent = readOpfContent(epubPath);
    expect(opfContent).toContain('&lt;special&gt;');
    expect(opfContent).toContain('&amp;');
    expect(opfContent).toContain('&quot;quotes&quot;');
    expect(opfContent).toContain('&apos;apostrophes&apos;');
    expect(opfContent).toContain('&lt;tags&gt;');
    expect(opfContent).not.toContain('<special>');
    expect(opfContent).not.toContain('<tags>');
    const zip = new AdmZip(epubPath);
    expect(zip.getEntries().length).toBeGreaterThan(0);
  });

  it('preserves original EPUB content', async () => {
    const epubPath = path.join(testEpubDir, 'test-preserve.epub');
    createMinimalEpub(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'New Title',
      authors: ['New Author'],
      abstract: 'New abstract',
      arxivId: '2401.99999',
      subjects: ['New Subject']
    };
    
    await injectMetadata(epubPath, metadata);
    
    const zip = new AdmZip(epubPath);
    expect(zip.getEntry('META-INF/container.xml')).not.toBeNull();
    expect(zip.getEntry('OEBPS/nav.xhtml')).not.toBeNull();
    const opfContent = readOpfContent(epubPath);
    expect(opfContent).toContain('<manifest>');
    expect(opfContent).toContain('<spine>');
    expect(opfContent).toContain('id="nav"');
    expect(opfContent).toContain('itemref idref="nav"');
  });

  it('handles empty subjects array', async () => {
    const epubPath = path.join(testEpubDir, 'test-no-subjects.epub');
    createMinimalEpub(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'Paper Without Subjects',
      authors: ['Author'],
      abstract: 'No subjects here.',
      arxivId: '2401.00002',
      subjects: []
    };
    
    await injectMetadata(epubPath, metadata);
    
    const opfContent = readOpfContent(epubPath);
    expect(opfContent).not.toContain('<dc:subject>');
    expect(opfContent).toContain('<dc:title>Paper Without Subjects</dc:title>');
    expect(opfContent).toContain('<dc:identifier id="BookId">arxiv:2401.00002</dc:identifier>');
  });

  it('adds language if not present in original OPF', async () => {
    const epubPath = path.join(testEpubDir, 'test-no-language.epub');
    const zip = new AdmZip();
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.addFile('META-INF/container.xml', Buffer.from(containerXml, 'utf8'));
    const contentOpfNoLang = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Old Title</dc:title>
  </metadata>
  <manifest></manifest>
  <spine></spine>
</package>`;
    zip.addFile('OEBPS/content.opf', Buffer.from(contentOpfNoLang, 'utf8'));
    zip.writeZip(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'Test',
      authors: ['Author'],
      abstract: 'Abstract',
      arxivId: '2401.00003',
      subjects: []
    };
    
    await injectMetadata(epubPath, metadata);
    
    const opfContent = readOpfContent(epubPath);
    expect(opfContent).toContain('<dc:language>en</dc:language>');
  });

  it('handles OPF file at root level', async () => {
    const epubPath = path.join(testEpubDir, 'test-root-opf.epub');
    const zip = new AdmZip();
    const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Root OPF</dc:title>
  </metadata>
  <manifest></manifest>
  <spine></spine>
</package>`;
    zip.addFile('content.opf', Buffer.from(contentOpf, 'utf8'));
    zip.writeZip(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'Root Level Test',
      authors: ['Author'],
      abstract: 'Testing root level OPF',
      arxivId: '2401.00004',
      subjects: ['Test']
    };
    
    await injectMetadata(epubPath, metadata);
    
    const zip2 = new AdmZip(epubPath);
    const opfEntry = zip2.getEntry('content.opf');
    expect(opfEntry).not.toBeNull();
    const opfContent = opfEntry!.getData().toString('utf8');
    expect(opfContent).toContain('<dc:title>Root Level Test</dc:title>');
    expect(opfContent).toContain('<dc:identifier id="BookId">arxiv:2401.00004</dc:identifier>');
  });

  it('throws error when OPF file cannot be found', async () => {
    const epubPath = path.join(testEpubDir, 'test-no-opf.epub');
    const zip = new AdmZip();
    zip.addFile('random.txt', Buffer.from('no opf here', 'utf8'));
    zip.writeZip(epubPath);
    
    const metadata: EpubMetadata = {
      title: 'Test',
      authors: ['Author'],
      abstract: 'Abstract',
      arxivId: '2401.00005',
      subjects: []
    };
    
    await expect(injectMetadata(epubPath, metadata)).rejects.toThrow('Could not find OPF file');
  });
});
