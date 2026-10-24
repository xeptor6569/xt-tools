// Curated field types for the mock data generator. Image, avatar and URL
// generators are left out on purpose: they produce links to other sites.
import type { Faker } from '@faker-js/faker';

export type Value = string | number | boolean | null;

export interface ParamDef {
  key: string;
  label: string;
  default: string;
  /** Integers only, or any finite number. */
  integer: boolean;
  min: number;
  max: number;
}

export interface FieldType {
  id: string;
  label: string;
  params?: readonly ParamDef[];
  /** Shown under the field when picked. */
  note?: string;
  generate: (faker: Faker, params: Readonly<Record<string, number>>) => Value;
}

const LIMIT = Number.MAX_SAFE_INTEGER;
const p = (key: string, label: string, value: string, integer: boolean, min: number, max: number): ParamDef => ({
  key,
  label,
  default: value,
  integer,
  min,
  max,
});
const num = (params: Readonly<Record<string, number>>, key: string) => params[key] ?? 0;
const iso = (d: Date) => d.toISOString();
const day = (d: Date) => d.toISOString().slice(0, 10);

export const FIELD_TYPES = [
  // Identifiers
  { id: 'uuid', label: 'ID: UUID v4', generate: (f) => f.string.uuid() },
  { id: 'ulid', label: 'ID: ULID', generate: (f) => f.string.ulid() },
  { id: 'nanoid', label: 'ID: Nano ID', generate: (f) => f.string.nanoid() },
  {
    id: 'sequence',
    label: 'ID: Row number',
    params: [p('start', 'Start at', '1', true, -LIMIT, LIMIT)],
    // Filled in by generateRows; never drawn from faker.
    generate: () => null,
  },
  {
    id: 'alphanumeric',
    label: 'Text: Random letters and digits',
    params: [p('length', 'Length', '10', true, 1, 256)],
    generate: (f, o) => f.string.alphanumeric(num(o, 'length')),
  },
  {
    id: 'numeric',
    label: 'Text: Random digits',
    params: [p('length', 'Length', '6', true, 1, 256)],
    generate: (f, o) => f.string.numeric({ length: num(o, 'length'), allowLeadingZeros: true }),
  },
  // Person
  { id: 'firstName', label: 'Person: First name', generate: (f) => f.person.firstName() },
  { id: 'lastName', label: 'Person: Last name', generate: (f) => f.person.lastName() },
  { id: 'fullName', label: 'Person: Full name', generate: (f) => f.person.fullName() },
  { id: 'sex', label: 'Person: Sex', generate: (f) => f.person.sex() },
  { id: 'jobTitle', label: 'Person: Job title', generate: (f) => f.person.jobTitle() },
  { id: 'birthdate', label: 'Person: Birth date (adult)', generate: (f) => day(f.date.birthdate()) },
  // Internet
  { id: 'email', label: 'Internet: Email', generate: (f) => f.internet.email() },
  {
    id: 'exampleEmail',
    label: 'Internet: Email (example domains)',
    note: 'Uses reserved example domains, so no real mailbox can receive mail.',
    generate: (f) => f.internet.exampleEmail(),
  },
  { id: 'username', label: 'Internet: Username', generate: (f) => f.internet.username() },
  { id: 'domainName', label: 'Internet: Domain name', generate: (f) => f.internet.domainName() },
  { id: 'ipv4', label: 'Internet: IPv4 address', generate: (f) => f.internet.ipv4() },
  { id: 'ipv6', label: 'Internet: IPv6 address', generate: (f) => f.internet.ipv6() },
  { id: 'mac', label: 'Internet: MAC address', generate: (f) => f.internet.mac() },
  { id: 'port', label: 'Internet: Port', generate: (f) => f.internet.port() },
  { id: 'httpMethod', label: 'Internet: HTTP method', generate: (f) => f.internet.httpMethod() },
  { id: 'userAgent', label: 'Internet: User agent', generate: (f) => f.internet.userAgent() },
  {
    id: 'password',
    label: 'Internet: Password-like string',
    note: 'Seeded test data, not a secure password. Use the password generator for real passwords.',
    params: [p('length', 'Length', '16', true, 1, 256)],
    generate: (f, o) => f.internet.password({ length: num(o, 'length') }),
  },
  // Location
  { id: 'streetAddress', label: 'Location: Street address', generate: (f) => f.location.streetAddress() },
  { id: 'city', label: 'Location: City', generate: (f) => f.location.city() },
  { id: 'state', label: 'Location: State', generate: (f) => f.location.state() },
  { id: 'zipCode', label: 'Location: ZIP code', generate: (f) => f.location.zipCode() },
  { id: 'country', label: 'Location: Country', generate: (f) => f.location.country() },
  { id: 'countryCode', label: 'Location: Country code', generate: (f) => f.location.countryCode() },
  { id: 'latitude', label: 'Location: Latitude', generate: (f) => f.location.latitude() },
  { id: 'longitude', label: 'Location: Longitude', generate: (f) => f.location.longitude() },
  { id: 'timeZone', label: 'Location: Time zone', generate: (f) => f.location.timeZone() },
  { id: 'phone', label: 'Phone: Number', generate: (f) => f.phone.number() },
  // Company and commerce
  { id: 'companyName', label: 'Company: Name', generate: (f) => f.company.name() },
  { id: 'catchPhrase', label: 'Company: Catch phrase', generate: (f) => f.company.catchPhrase() },
  { id: 'productName', label: 'Commerce: Product name', generate: (f) => f.commerce.productName() },
  { id: 'department', label: 'Commerce: Department', generate: (f) => f.commerce.department() },
  {
    id: 'price',
    label: 'Commerce: Price',
    params: [p('min', 'Minimum', '1', false, 0, 1e12), p('max', 'Maximum', '1000', false, 0, 1e12)],
    generate: (f, o) => Number(f.commerce.price({ min: num(o, 'min'), max: num(o, 'max') })),
  },
  { id: 'isbn', label: 'Commerce: ISBN', generate: (f) => f.commerce.isbn() },
  // Finance
  { id: 'amount', label: 'Finance: Amount', generate: (f) => Number(f.finance.amount()) },
  { id: 'currencyCode', label: 'Finance: Currency code', generate: (f) => f.finance.currencyCode() },
  { id: 'iban', label: 'Finance: IBAN', generate: (f) => f.finance.iban() },
  { id: 'bic', label: 'Finance: BIC', generate: (f) => f.finance.bic() },
  {
    id: 'creditCardNumber',
    label: 'Finance: Credit card number',
    note: 'For testing only: the numbers pass the Luhn check but don’t belong to real cards.',
    generate: (f) => f.finance.creditCardNumber(),
  },
  // Numbers and booleans
  {
    id: 'int',
    label: 'Number: Integer',
    params: [p('min', 'Minimum', '1', true, -LIMIT, LIMIT), p('max', 'Maximum', '1000', true, -LIMIT, LIMIT)],
    generate: (f, o) => f.number.int({ min: num(o, 'min'), max: num(o, 'max') }),
  },
  {
    id: 'float',
    label: 'Number: Decimal',
    params: [
      p('min', 'Minimum', '0', false, -1e15, 1e15),
      p('max', 'Maximum', '100', false, -1e15, 1e15),
      p('decimals', 'Decimals', '2', true, 0, 10),
    ],
    generate: (f, o) => f.number.float({ min: num(o, 'min'), max: num(o, 'max'), fractionDigits: num(o, 'decimals') }),
  },
  {
    id: 'boolean',
    label: 'Boolean',
    params: [p('probability', 'Chance of true (%)', '50', false, 0, 100)],
    generate: (f, o) => f.datatype.boolean({ probability: num(o, 'probability') / 100 }),
  },
  // Dates
  {
    id: 'datePast',
    label: 'Date: Past (ISO 8601)',
    params: [p('years', 'Within years', '1', false, 0.001, 1000)],
    generate: (f, o) => iso(f.date.past({ years: num(o, 'years') })),
  },
  {
    id: 'dateFuture',
    label: 'Date: Future (ISO 8601)',
    params: [p('years', 'Within years', '1', false, 0.001, 1000)],
    generate: (f, o) => iso(f.date.future({ years: num(o, 'years') })),
  },
  {
    id: 'dateRecent',
    label: 'Date: Recent (ISO 8601)',
    params: [p('days', 'Within days', '7', false, 0.001, 100_000)],
    generate: (f, o) => iso(f.date.recent({ days: num(o, 'days') })),
  },
  { id: 'datePastDay', label: 'Date: Past (YYYY-MM-DD)', generate: (f) => day(f.date.past()) },
  // Lorem
  { id: 'word', label: 'Lorem: Word', generate: (f) => f.lorem.word() },
  {
    id: 'words',
    label: 'Lorem: Words',
    params: [p('count', 'Words', '3', true, 1, 100)],
    generate: (f, o) => f.lorem.words(num(o, 'count')),
  },
  { id: 'sentence', label: 'Lorem: Sentence', generate: (f) => f.lorem.sentence() },
  { id: 'paragraph', label: 'Lorem: Paragraph', generate: (f) => f.lorem.paragraph() },
  { id: 'slug', label: 'Lorem: Slug', generate: (f) => f.lorem.slug() },
  // Misc
  { id: 'colorHex', label: 'Colour: Hex', generate: (f) => f.color.rgb() },
  { id: 'colorName', label: 'Colour: Name', generate: (f) => f.color.human() },
  { id: 'fileName', label: 'System: File name', generate: (f) => f.system.fileName() },
  { id: 'mimeType', label: 'System: MIME type', generate: (f) => f.system.mimeType() },
  { id: 'semver', label: 'System: Version (semver)', generate: (f) => f.system.semver() },
  { id: 'vehicle', label: 'Vehicle: Make and model', generate: (f) => f.vehicle.vehicle() },
  { id: 'vin', label: 'Vehicle: VIN', generate: (f) => f.vehicle.vin() },
  { id: 'animal', label: 'Animal: Type', generate: (f) => f.animal.type() },
  { id: 'musicGenre', label: 'Music: Genre', generate: (f) => f.music.genre() },
  { id: 'songName', label: 'Music: Song title', generate: (f) => f.music.songName() },
  { id: 'bookTitle', label: 'Book: Title', generate: (f) => f.book.title() },
  { id: 'dish', label: 'Food: Dish', generate: (f) => f.food.dish() },
] as const satisfies readonly FieldType[];

export type FieldTypeId = (typeof FIELD_TYPES)[number]['id'];

const BY_ID = new Map<string, FieldType>(FIELD_TYPES.map((t) => [t.id, t]));

export function findFieldType(id: string): FieldType | undefined {
  return BY_ID.get(id);
}
