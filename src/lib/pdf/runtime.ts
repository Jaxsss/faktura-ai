import type { Invoice } from '../../types';

type PdfRuntime = {
  generateInvoicePdf: (invoice: Invoice) => Promise<Blob>;
  pdfjs: typeof import('pdfjs-dist');
  worker: import('pdfjs-dist').PDFWorker;
};

let prepared: Promise<PdfRuntime> | undefined;

/** Load every PDF code asset, both Czech fonts, and the preview worker before the app is ready. */
export function preparePdfRuntime(): Promise<PdfRuntime> {
  if (!prepared) {
    prepared = (async () => {
      const [generator, pdfjs, workerAsset, renderer] = await Promise.all([
        import('./index'),
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        import('@react-pdf/renderer'),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = workerAsset.default;
      const worker = new pdfjs.PDFWorker();
      try {
        await Promise.all([
          worker.promise,
          renderer.Font.load({ fontFamily: 'Noto Sans', fontStyle: 'normal', fontWeight: 400 }),
          renderer.Font.load({ fontFamily: 'Noto Sans', fontStyle: 'normal', fontWeight: 700 }),
        ]);
        return { generateInvoicePdf: generator.generateInvoicePdf, pdfjs, worker };
      } catch (error) {
        worker.destroy();
        throw error;
      }
    })().catch((error) => {
      prepared = undefined;
      throw error;
    });
  }
  return prepared;
}
