// Generates off the main thread, so wide or long tables never freeze the
// page. faker (English locale only) is bundled into this worker chunk, which
// is loaded only when the tool opens.
import { faker } from '@faker-js/faker/locale/en';
import { expose } from '../../lib/worker-rpc.ts';
import { mockData, type MockRequest } from './logic.ts';

expose({ generate: (request: MockRequest) => mockData(faker, request) });
