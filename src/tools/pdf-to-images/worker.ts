// Runs PDF to images off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { createSamplePdf } from '../pdf-tools/logic.ts';
import { pdfToImages, renderPdfToImages } from './logic.ts';

expose({ pdfToImages, renderPdfToImages, createSamplePdf });
