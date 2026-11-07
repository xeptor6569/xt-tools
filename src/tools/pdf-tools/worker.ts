// Runs PDF tools off the main thread.
import { expose } from '../../lib/worker-rpc.ts';
import { createSamplePdf, pdfTools, processPdfFiles } from './logic.ts';

expose({ pdfTools, processPdfFiles, createSamplePdf });
