/**
 * PDF rendering utilities using pdfjs-dist (dynamically imported).
 */

export interface PDFPageInfo {
  dataUrl: string;
  pageNumber: number;
  totalPages: number;
  width: number;
  height: number;
}

let workerSrcSet = false;

async function getPDFJS() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerSrcSet) {
    // Serve worker from public/ — avoids Next.js/Turbopack bundling issues
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    workerSrcSet = true;
  }
  return pdfjs;
}

/**
 * Load a PDF file and return the total page count.
 */
export async function loadPDF(file: File): Promise<{ totalPages: number; arrayBuffer: ArrayBuffer }> {
  const pdfjs = await getPDFJS();
  const arrayBuffer = await file.arrayBuffer();
  // slice(0) copies the buffer — pdfjs detaches the original after loading
  const pdf = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise;
  return { totalPages: pdf.numPages, arrayBuffer };
}

/**
 * Render a single PDF page to a data URL.
 * scale=2 gives ~144dpi for crisp display.
 */
export async function renderPDFPage(
  arrayBuffer: ArrayBuffer,
  pageNumber: number,
  scale = 2,
): Promise<PDFPageInfo> {
  const pdfjs = await getPDFJS();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const page = await pdf.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx as unknown as import('pdfjs-dist/types/src/display/api').RenderParameters['canvasContext'], viewport, canvas }).promise;

  const dataUrl = canvas.toDataURL('image/png');
  return {
    dataUrl,
    pageNumber,
    totalPages: pdf.numPages,
    width: viewport.width,
    height: viewport.height,
  };
}
