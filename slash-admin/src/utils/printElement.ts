export interface PrintElementIsolatedOptions {
  title?: string;
  paperFormat?: "A4" | "A5";
  landscape?: boolean;
}

/**
 * Isolates an element and triggers print without dialog chrome, scrollbars, or parent layout interference.
 */
export function printElementIsolated(elementId: string, options: PrintElementIsolatedOptions = {}) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element #${elementId} not found for printing, fallback to window.print()`);
    window.print();
    return;
  }

  // Create invisible iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const paperSize = options.paperFormat === "A5" ? "148mm 210mm" : "210mm 297mm";

  // Collect all stylesheets from main document
  const headElements = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
    .map((node) => node.outerHTML)
    .join("\n");

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${options.title || "Print Document"}</title>
        ${headElements}
        <style>
          @page {
            size: ${paperSize} ${options.landscape ? "landscape" : "portrait"};
            margin: 0;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
          }
          @media print {
            body {
              width: 100% !important;
              height: 100% !important;
            }
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // Give resources, images, fonts time to load
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Failed to print iframe", e);
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 2000);
    }
  }, 350);
}
