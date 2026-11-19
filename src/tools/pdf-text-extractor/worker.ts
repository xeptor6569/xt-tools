// Runs PDF text extraction off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { createSamplePdf } from '../pdf-tools/logic.ts';
import { extractPdfText, pdfTextExtractor } from './logic.ts';

expose({ pdfTextExtractor, extractPdfText, createSamplePdf });
