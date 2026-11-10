/// <reference types="astro/client" />

/** Build version, injected by astro.config.ts from the VERSION env var. */
declare const __XT_VERSION__: string;

/** Calendar date of the build (`YYYY-MM-DD`). Drives the "New" badge. */
declare const __XT_BUILD_DATE__: string;

declare module 'pako' {
  const pako: {
    deflate: (input: Uint8Array) => Uint8Array;
    inflate: (input: Uint8Array) => Uint8Array;
    gzip: (input: Uint8Array) => Uint8Array;
    ungzip: (input: Uint8Array) => Uint8Array;
  };
  export default pako;
}

declare module 'jq-web' {
  const jq: unknown;
  export default jq;
}

declare module '@ffmpeg/core' {
  const createFFmpegCore: (options?: Record<string, unknown>) => Promise<{
    exec: (...args: string[]) => number;
    ret: number;
    reset: () => void;
    FS: {
      writeFile: (path: string, data: Uint8Array) => void;
      readFile: (path: string, opts?: { encoding?: string }) => Uint8Array;
      readdir: (path: string) => string[];
      unlink: (path: string) => void;
    };
  }>;
  export default createFFmpegCore;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}

declare module 'pdfjs-dist/build/pdf.mjs' {
  export interface PdfViewport {
    width: number;
    height: number;
  }
  export interface PdfPageProxy {
    rotate: number;
    getViewport: (params: { scale: number }) => PdfViewport;
    getTextContent: () => Promise<{ items: Array<Record<string, unknown>> }>;
    render: (params: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: PdfViewport }) => {
      promise: Promise<void>;
    };
  }
  export interface PdfDocumentProxy {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  }
  export function getDocument(src: {
    data: Uint8Array;
    isEvalSupported?: boolean;
    useSystemFonts?: boolean;
    disableFontFace?: boolean;
    verbosity?: number;
  }): {
    promise: Promise<PdfDocumentProxy>;
    destroy: () => Promise<void>;
  };
}
