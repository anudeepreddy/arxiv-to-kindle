import axios from 'axios';
import { ArxivNotFoundError } from './errors.js';

export type ProbeResult = 
  | { type: 'html'; url: string }
  | { type: 'ar5iv'; url: string }
  | { type: 'latex'; url: string }
  | { type: 'pdf'; url: string };

export async function probeAvailability(id: string): Promise<ProbeResult> {
  const arxivHtmlUrl = `https://arxiv.org/html/${id}`;
  const ar5ivUrl = `https://ar5iv.org/html/${id}`;
  const arxivEprintUrl = `https://arxiv.org/e-print/${id}`;
  const arxivPdfUrl = `https://arxiv.org/pdf/${id}`;

  try {
    await axios.head(arxivHtmlUrl);
    return { type: 'html', url: arxivHtmlUrl };
  } catch {
    try {
      await axios.head(ar5ivUrl);
      return { type: 'ar5iv', url: ar5ivUrl };
    } catch {
      try {
        await axios.head(arxivEprintUrl);
        return { type: 'latex', url: arxivEprintUrl };
      } catch {
        try {
          await axios.head(arxivPdfUrl);
          return { type: 'pdf', url: arxivPdfUrl };
        } catch {
          throw new ArxivNotFoundError(id);
        }
      }
    }
  }
}
