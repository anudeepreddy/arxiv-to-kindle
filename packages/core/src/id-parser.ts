export interface NormalizedArxivId {
  id: string;
  version?: number;
  category?: string;
}

const NEW_FORMAT_REGEX = /^(\d{4}\.\d{4,5})(v(\d+))?$/;
const OLD_FORMAT_REGEX = /^([a-z-]+\/\d{7})(v(\d+))?$/;
const URL_REGEX = /arxiv\.org\/(?:abs|html|pdf|src)\/([a-z-]+\/\d{7}|\d{4}\.\d{4,5})(v\d+)?$/i;

export function normalizeArxivId(raw: string): NormalizedArxivId | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  
  if (trimmed.length === 0) {
    return null;
  }

  const urlMatch = trimmed.match(URL_REGEX);
  let extractedFromUrl = urlMatch ? urlMatch[1] : trimmed;
  if (urlMatch && urlMatch[2]) {
    extractedFromUrl += urlMatch[2];
  }

  const newFormatMatch = extractedFromUrl.match(NEW_FORMAT_REGEX);
  if (newFormatMatch) {
    const result: NormalizedArxivId = {
      id: newFormatMatch[1],
    };
    if (newFormatMatch[3]) {
      result.version = parseInt(newFormatMatch[3], 10);
    }
    return result;
  }

  const oldFormatMatch = extractedFromUrl.match(OLD_FORMAT_REGEX);
  if (oldFormatMatch) {
    const result: NormalizedArxivId = {
      id: oldFormatMatch[1],
      category: oldFormatMatch[1].split('/')[0],
    };
    if (oldFormatMatch[3]) {
      result.version = parseInt(oldFormatMatch[3], 10);
    }
    return result;
  }

  return null;
}
