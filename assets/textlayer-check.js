import * as pdfjsLib from './pdfjs/pdf.min.mjs';

const workerUrl = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function normalizeOptions(opts) {
  const maxPages = Math.max(1, Math.floor(Number(opts.maxPages ?? 5)));
  const minChars = Math.max(0, Math.floor(Number(opts.minChars ?? 40)));
  return { maxPages, minChars };
}

async function toBytes(file) {
  if (file instanceof Uint8Array) return file;
  if (file instanceof ArrayBuffer) return new Uint8Array(file);
  if (file?.arrayBuffer) return new Uint8Array(await file.arrayBuffer());
  throw new TypeError('Expected File, Blob, ArrayBuffer, or Uint8Array');
}

export async function checkTextLayer(file, opts = { maxPages: 5, minChars: 40 }) {
  const { maxPages, minChars } = normalizeOptions(opts);

  try {
    const data = await toBytes(file);
    const loadingTask = pdfjsLib.getDocument({ data, disableFontFace: true });
    const pdf = await loadingTask.promise;
    const pageLimit = Math.min(maxPages, pdf.numPages);
    let pagesChecked = 0;
    let charsFound = 0;

    for (let pageNo = 1; pageNo <= pageLimit; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      pagesChecked += 1;
      const text = await page.getTextContent();
      for (const item of text.items) {
        charsFound += String(item.str ?? '').replace(/\s+/g, '').length;
      }
      page.cleanup();
      if (charsFound >= minChars) break;
    }

    await pdf.destroy();
    return { ok: charsFound >= minChars, charsFound, pagesChecked };
  } catch {
    return { ok: false, charsFound: 0, pagesChecked: 0 };
  }
}
