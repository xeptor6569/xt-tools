// Runs PDF image extractor off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { createSamplePdfWithImages, extractImagesFromPdf, pdfImageExtractor } from './logic.ts';

expose({ pdfImageExtractor, extractImagesFromPdf, createSamplePdfWithImages });
