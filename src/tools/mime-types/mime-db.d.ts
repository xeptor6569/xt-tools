declare module 'mime-db' {
  interface MimeTypeEntry {
    source?: string;
    compressible?: boolean;
    extensions?: string[];
    charset?: string;
  }
  const db: Record<string, MimeTypeEntry>;
  export default db;
}
