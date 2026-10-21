import { useEffect, useRef, useState } from 'react';
import type { Invoice } from '../types';
import { preparePdfRuntime } from '../lib/pdf/runtime';

type PreviewPage = { url: string; number: number };

export function InvoicePreview({
  invoice,
  expanded = false,
}: {
  invoice: Invoice;
  expanded?: boolean;
}) {
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [preparing, setPreparing] = useState(true);
  const [error, setError] = useState(false);
  const visibleUrls = useRef<string[]>([]);
  const serialized = JSON.stringify(invoice);

  useEffect(
    () => () => {
      visibleUrls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    const pendingUrls: string[] = [];
    setPreparing(true);
    setError(false);
    const timer = window.setTimeout(async () => {
      try {
        const { generateInvoicePdf, pdfjs, worker } = await preparePdfRuntime();
        if (!active) return;
        const blob = await generateInvoicePdf(invoice);
        if (!active) return;
        const document = await pdfjs.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
          worker,
        }).promise;
        try {
          const nextPages: PreviewPage[] = [];
          const scale = Math.min(2.2, Math.max(1.6, window.devicePixelRatio || 1));
          for (let number = 1; number <= document.numPages; number++) {
            if (!active) return;
            const page = await document.getPage(number);
            const viewport = page.getViewport({ scale });
            const canvas = window.document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Náhled PDF nelze vykreslit.');
            renderTask = page.render({ canvasContext: context, canvas, viewport });
            await renderTask.promise;
            renderTask = undefined;
            if (!active) return;
            const image = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (value) => (value ? resolve(value) : reject(new Error('Náhled PDF nelze uložit.'))),
                'image/png',
              ),
            );
            if (!active) return;
            const url = URL.createObjectURL(image);
            pendingUrls.push(url);
            nextPages.push({ url, number });
            page.cleanup();
          }
          if (!active) return;
          const previous = visibleUrls.current;
          visibleUrls.current = pendingUrls.splice(0);
          setPages(nextPages);
          setError(false);
          window.requestAnimationFrame(() => previous.forEach(URL.revokeObjectURL));
        } finally {
          await document.destroy();
        }
      } catch (cause) {
        if (active) {
          console.error('Náhled faktury se nepodařilo vytvořit.', cause);
          setError(true);
        }
      } finally {
        pendingUrls.forEach(URL.revokeObjectURL);
        if (active) setPreparing(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
      renderTask?.cancel();
    };
    // Serialized invoice captures editable fields; the Blob dependency captures logo replacement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, invoice.supplier.logo]);

  const height = expanded ? '100%' : 560;
  return (
    <div
      aria-label="Náhled faktury"
      style={{
        position: 'relative',
        height,
        minHeight: expanded ? 0 : 560,
        background: '#eeefeb',
        borderRadius: 12,
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {pages.length > 0 && (
        <div
          style={{
            padding: expanded ? '20px 24px' : '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {pages.map((page) => (
            <img
              key={page.number}
              src={page.url}
              role="img"
              aria-label={`Faktura, strana ${page.number} z ${pages.length}`}
              alt={`Strana ${page.number} faktury`}
              style={{
                display: 'block',
                width: '100%',
                maxWidth: expanded ? 760 : undefined,
                height: 'auto',
                background: '#fffefa',
                boxShadow: '0 2px 12px #24332d20',
              }}
            />
          ))}
        </div>
      )}
      {preparing && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: pages.length ? 8 : '50%',
            left: 0,
            right: 0,
            width: 'fit-content',
            margin: '0 auto',
            transform: pages.length ? undefined : 'translateY(-50%)',
            zIndex: 1,
            padding: '9px 14px',
            borderRadius: 99,
            background: '#fffefa',
            color: '#53665c',
            boxShadow: '0 2px 12px #24332d18',
            fontSize: 12,
          }}
        >
          Připravuji náhled faktury…
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            top: pages.length ? 8 : '50%',
            left: 12,
            right: 12,
            margin: '0 auto',
            width: 'fit-content',
            transform: pages.length ? undefined : 'translateY(-50%)',
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fffefa',
            color: '#9c3d32',
            boxShadow: '0 2px 12px #24332d18',
            fontSize: 12,
          }}
        >
          Náhled se nepodařilo vytvořit. Zkontrolujte údaje faktury a zkuste to znovu.
        </div>
      )}
    </div>
  );
}
