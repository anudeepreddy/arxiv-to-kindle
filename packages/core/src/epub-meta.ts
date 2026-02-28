import AdmZip from 'adm-zip';

export interface EpubMetadata {
  title: string;
  authors: string[];
  abstract: string;
  arxivId: string;
  subjects: string[];
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function findOpfPath(zip: AdmZip): string | null {
  const containerEntry = zip.getEntry('META-INF/container.xml');
  if (containerEntry) {
    const containerXml = containerEntry.getData().toString('utf8');
    const match = containerXml.match(/full-path=["']([^"']+)["']/);
    if (match) {
      return match[1];
    }
  }
  const commonPaths = ['OEBPS/content.opf', 'OEBPS/package.opf', 'content.opf', 'package.opf'];
  for (const path of commonPaths) {
    if (zip.getEntry(path)) {
      return path;
    }
  }
  const entries = zip.getEntries();
  for (const entry of entries) {
    if (entry.entryName.endsWith('.opf')) {
      return entry.entryName;
    }
  }
  return null;
}

function updateOpfContent(opfContent: string, metadata: EpubMetadata): string {
  let xml = opfContent;
  const metadataMatch = xml.match(/<metadata[^>]*>/i);
  if (!metadataMatch) {
    const packageMatch = xml.match(/(<package[^>]*>)/i);
    if (packageMatch) {
      const insertPos = packageMatch.index! + packageMatch[0].length;
      xml = xml.slice(0, insertPos) + '\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' + '\n  </metadata>' + xml.slice(insertPos);
    }
  }
  xml = xml.replace(/<dc:title[^>]*>[\s\S]*?<\/dc:title>/gi, '');
  xml = xml.replace(/<dc:creator[^>]*>[\s\S]*?<\/dc:creator>/gi, '');
  xml = xml.replace(/<dc:description[^>]*>[\s\S]*?<\/dc:description>/gi, '');
  xml = xml.replace(/<dc:subject[^>]*>[\s\S]*?<\/dc:subject>/gi, '');
  xml = xml.replace(/<dc:identifier[^>]*>[\s\S]*?<\/dc:identifier>/gi, '');
  if (!/<dc:language[^>]*>[\s\S]*?<\/dc:language>/i.test(xml)) {
    const metaMatch = xml.match(/<metadata[^>]*>/i);
    if (metaMatch) {
      const insertPos = metaMatch.index! + metaMatch[0].length;
      xml = xml.slice(0, insertPos) + '\n    <dc:language>en</dc:language>' + xml.slice(insertPos);
    }
  }
  const metaMatch = xml.match(/<metadata[^>]*>/i);
  if (metaMatch) {
    const insertPos = metaMatch.index! + metaMatch[0].length;
    const newMetadata: string[] = [];
    newMetadata.push(`\n    <dc:title>${escapeXml(metadata.title)}</dc:title>`);
    for (const author of metadata.authors) {
      newMetadata.push(`\n    <dc:creator>${escapeXml(author)}</dc:creator>`);
    }
    if (metadata.abstract) {
      newMetadata.push(`\n    <dc:description>${escapeXml(metadata.abstract)}</dc:description>`);
    }
    newMetadata.push(`\n    <dc:identifier id="BookId">arxiv:${metadata.arxivId}</dc:identifier>`);
    for (const subject of metadata.subjects) {
      newMetadata.push(`\n    <dc:subject>${escapeXml(subject)}</dc:subject>`);
    }
    xml = xml.slice(0, insertPos) + newMetadata.join('') + xml.slice(insertPos);
  }
  return xml;
}

export async function injectMetadata(
  epubPath: string,
  metadata: EpubMetadata
): Promise<void> {
  const zip = new AdmZip(epubPath);
  const opfPath = findOpfPath(zip);
  if (!opfPath) {
    throw new Error('Could not find OPF file in EPUB');
  }
  const opfEntry = zip.getEntry(opfPath);
  if (!opfEntry) {
    throw new Error(`OPF file not found: ${opfPath}`);
  }
  const opfContent = opfEntry.getData().toString('utf8');
  const updatedOpfContent = updateOpfContent(opfContent, metadata);
  zip.updateFile(opfPath, Buffer.from(updatedOpfContent, 'utf8'));
  zip.writeZip(epubPath);
}

function inlineSvgsInHtml(htmlContent: string, zip: AdmZip, basePath: string): string {
  const svgPattern = /<img[^>]+src="([^"]*\.svg)"[^>]*>/gi;
  let result = htmlContent;
  let match;
  
  while ((match = svgPattern.exec(htmlContent)) !== null) {
    const imgTag = match[0];
    const srcPath = match[1];
    // Resolve relative path from the HTML file location
    const svgPath = srcPath.startsWith('../') 
      ? srcPath.replace(/^\.\.\//, '')
      : srcPath.startsWith('./') 
        ? srcPath.substring(2)
        : srcPath;
    
    const svgEntry = zip.getEntry(svgPath) || zip.getEntry(basePath + '/' + svgPath) || zip.getEntry('EPUB/' + svgPath);
    
    if (svgEntry) {
      let svgContent = svgEntry.getData().toString('utf8');
      // Remove XML declaration if present
      svgContent = svgContent.replace(/<\?xml[^?]*\?>\s*/i, '');
      // Remove DOCTYPE if present
      svgContent = svgContent.replace(/<!DOCTYPE[^>]*>\s*/i, '');
      // Replace img tag with inline SVG
      result = result.replace(imgTag, svgContent);
    }
  }
  
  return result;
}

export async function inlineSvgs(epubPath: string): Promise<void> {
  const zip = new AdmZip(epubPath);
  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.entryName.endsWith('.xhtml') || entry.entryName.endsWith('.html')) {
      const content = entry.getData().toString('utf8');
      const basePath = entry.entryName.split('/').slice(0, -1).join('/') || '';
      const updatedContent = inlineSvgsInHtml(content, zip, basePath);
      if (content !== updatedContent) {
        zip.updateFile(entry.entryName, Buffer.from(updatedContent, 'utf8'));
      }
    }
  }

  zip.writeZip(epubPath);
}
