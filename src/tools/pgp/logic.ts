import { ToolInputError } from '../types.ts';

const MAX_INPUT = 500_000;

export type PgpMode = 'auto' | 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'inspect' | 'keygen';

export interface PgpOptions {
  mode?: PgpMode;
  passphrase?: string;
  publicKey?: string;
  privateKey?: string;
}

export interface GeneratedPgpKey {
  fingerprint: string;
  publicKey: string;
  privateKey: string;
}

const KNOWN_HEADERS = new Set(['mode', 'passphrase', 'password', 'name', 'email']);

function parseHeaders(input: string): { headers: Record<string, string>; body: string } {
  const lines = input.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const match = /^([a-z][a-z0-9-]*)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
    if (!match || !KNOWN_HEADERS.has(match[1]!.toLowerCase())) break;
    headers[match[1]!.toLowerCase()] = (match[2] ?? '').trim();
    i++;
  }
  if (i > 0 && (lines[i] ?? '') === '') i++;
  return { headers, body: lines.slice(i).join('\n') };
}

async function loadOpenPgp() {
  return await import('openpgp');
}

export async function generatePgpKeyPair(name: string, email: string, passphrase = ''): Promise<GeneratedPgpKey> {
  const cleanName = name.trim() || 'Local User';
  const cleanEmail = email.trim();
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new ToolInputError('Enter a valid email address for the PGP user ID, or leave it blank.');
  }
  const openpgp = await loadOpenPgp();
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519Legacy',
    userIDs: [cleanEmail ? { name: cleanName, email: cleanEmail } : { name: cleanName }],
    ...(passphrase ? { passphrase } : {}),
    format: 'armored',
  });
  const parsed = await openpgp.readKey({ armoredKey: publicKey });
  return {
    fingerprint: parsed.getFingerprint().toUpperCase(),
    publicKey: publicKey.trim(),
    privateKey: privateKey.trim(),
  };
}

async function inspectKeyBlock(armored: string): Promise<string> {
  const openpgp = await loadOpenPgp();
  try {
    const key = await openpgp.readKey({ armoredKey: armored });
    const algo = key.getAlgorithmInfo();
    const users = key.users.map((u) => u.userID?.userID).filter((id): id is string => !!id);
    const created = key.getCreationTime();
    const subkeys = key.getSubkeys().map((sub) => {
      const info = sub.getAlgorithmInfo();
      return `${sub.getKeyID().toHex().toUpperCase()} (${info.algorithm}${info.curve ? `/${info.curve}` : info.bits ? `-${info.bits}` : ''})`;
    });
    const lines = [
      `type: ${key.isPrivate() ? 'private key' : 'public key'}`,
      `fingerprint: ${key.getFingerprint().toUpperCase()}`,
      `keyId: ${key.getKeyID().toHex().toUpperCase()}`,
      `algorithm: ${algo.algorithm}${algo.curve ? ` (${algo.curve})` : algo.bits ? ` (${algo.bits}-bit)` : ''}`,
      `created: ${created.toISOString()}`,
    ];
    if (users.length > 0) lines.push(`userIds: ${users.join(', ')}`);
    if (subkeys.length > 0) lines.push(`subkeys: ${subkeys.join(', ')}`);
    return lines.join('\n');
  } catch (error) {
    throw new ToolInputError(error instanceof Error ? error.message : 'Invalid OpenPGP key block.');
  }
}

/**
 * Encrypts, decrypts, signs, verifies or inspects OpenPGP messages and keys.
 * OpenPGP.js is loaded with a dynamic import so it stays in its own replaceable chunk.
 */
export async function pgp(input: string, options: PgpOptions = {}): Promise<string> {
  if (input.length > MAX_INPUT) throw new ToolInputError('Input is too large (maximum 500 KB).');
  if (input.trim() === '') return '';

  const { headers, body } = parseHeaders(input);
  const passphrase = headers.passphrase ?? headers.password ?? options.passphrase ?? '';
  const publicKeyArmored = options.publicKey?.trim() ?? '';
  const privateKeyArmored = options.privateKey?.trim() ?? '';
  const text = Object.keys(headers).length > 0 ? body : input;
  const trimmed = text.trim();

  let mode: PgpMode = (headers.mode as PgpMode | undefined) ?? options.mode ?? 'auto';
  if (!['auto', 'encrypt', 'decrypt', 'sign', 'verify', 'inspect', 'keygen'].includes(mode)) {
    throw new ToolInputError('mode must be auto, encrypt, decrypt, sign, verify, inspect or keygen.');
  }

  if (mode === 'keygen') {
    const gen = await generatePgpKeyPair(headers.name ?? 'Local User', headers.email ?? '', passphrase);
    return `fingerprint: ${gen.fingerprint}\n\n${gen.publicKey}\n\n${gen.privateKey}`;
  }

  if (mode === 'auto') {
    if (/-----BEGIN PGP (PUBLIC|PRIVATE) KEY BLOCK-----/.test(trimmed)) mode = 'inspect';
    else if (/-----BEGIN PGP SIGNED MESSAGE-----/.test(trimmed)) mode = 'verify';
    else if (/-----BEGIN PGP MESSAGE-----/.test(trimmed)) mode = 'decrypt';
    else mode = 'encrypt';
  }

  if (mode === 'inspect') {
    if (/-----BEGIN PGP (PUBLIC|PRIVATE) KEY BLOCK-----/.test(trimmed)) {
      return await inspectKeyBlock(trimmed);
    }
    throw new ToolInputError('Paste an armored PGP PUBLIC KEY BLOCK or PRIVATE KEY BLOCK to inspect.');
  }

  const openpgp = await loadOpenPgp();

  if (mode === 'encrypt') {
    if (trimmed === '') throw new ToolInputError('Enter a message to encrypt.');
    if (!passphrase && !publicKeyArmored) {
      throw new ToolInputError('Provide a passphrase (or passphrase: line) or a recipient public key to encrypt.');
    }
    try {
      const message = await openpgp.createMessage({ text });
      const encryptionKeys = publicKeyArmored ? await openpgp.readKey({ armoredKey: publicKeyArmored }) : undefined;
      let signingKeys;
      if (privateKeyArmored) {
        const priv = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
        signingKeys = priv.isDecrypted() ? priv : await openpgp.decryptKey({ privateKey: priv, passphrase });
      }
      const encrypted = await openpgp.encrypt({
        message,
        ...(encryptionKeys ? { encryptionKeys } : {}),
        ...(passphrase && !encryptionKeys ? { passwords: [passphrase] } : {}),
        ...(signingKeys ? { signingKeys } : {}),
        format: 'armored',
      });
      return String(encrypted).trim();
    } catch (error) {
      throw new ToolInputError(error instanceof Error ? error.message : 'Could not encrypt the PGP message.');
    }
  }

  if (mode === 'decrypt') {
    if (!/-----BEGIN PGP MESSAGE-----/.test(trimmed)) {
      throw new ToolInputError('Paste an armored -----BEGIN PGP MESSAGE----- block to decrypt.');
    }
    if (!passphrase && !privateKeyArmored) {
      throw new ToolInputError('Provide a passphrase or a private key to decrypt this PGP message.');
    }
    try {
      const message = await openpgp.readMessage({ armoredMessage: trimmed });
      let decryptionKeys;
      if (privateKeyArmored) {
        const priv = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
        decryptionKeys = priv.isDecrypted() ? priv : await openpgp.decryptKey({ privateKey: priv, passphrase });
      }
      const verificationKeys = publicKeyArmored ? await openpgp.readKey({ armoredKey: publicKeyArmored }) : undefined;
      const result = await openpgp.decrypt({
        message,
        ...(decryptionKeys ? { decryptionKeys } : {}),
        ...(passphrase ? { passwords: [passphrase] } : {}),
        ...(verificationKeys ? { verificationKeys } : {}),
      });
      return String(result.data);
    } catch (error) {
      throw new ToolInputError(error instanceof Error ? error.message : 'Could not decrypt the PGP message.');
    }
  }

  if (mode === 'sign') {
    if (trimmed === '') throw new ToolInputError('Enter a message to sign.');
    if (!privateKeyArmored) {
      throw new ToolInputError('Paste a private key to sign the message.');
    }
    try {
      const priv = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
      const signingKeys = priv.isDecrypted() ? priv : await openpgp.decryptKey({ privateKey: priv, passphrase });
      const signed = await openpgp.sign({
        message: await openpgp.createCleartextMessage({ text }),
        signingKeys,
      });
      return String(signed).trim();
    } catch (error) {
      throw new ToolInputError(error instanceof Error ? error.message : 'Could not sign the message.');
    }
  }

  if (!/-----BEGIN PGP SIGNED MESSAGE-----/.test(trimmed)) {
    throw new ToolInputError('Paste a -----BEGIN PGP SIGNED MESSAGE----- block to verify.');
  }
  try {
    const cleartextMessage = await openpgp.readCleartextMessage({ cleartextMessage: trimmed });
    if (!publicKeyArmored) {
      return `message: ${cleartextMessage.getText()}\nstatus: unverified (provide a public key to verify the signature)`;
    }
    const verificationKeys = await openpgp.readKey({ armoredKey: publicKeyArmored });
    const verification = await openpgp.verify({
      message: cleartextMessage,
      verificationKeys,
    });
    const sig = verification.signatures[0];
    if (!sig) throw new ToolInputError('No signature found in the message.');
    let valid = false;
    try {
      valid = await sig.verified;
    } catch {
      valid = false;
    }
    const keyId = sig.keyID.toHex().toUpperCase();
    return `status: ${valid ? 'valid signature' : 'invalid signature'}\nkeyId: ${keyId}\nmessage: ${cleartextMessage.getText()}`;
  } catch (error) {
    if (error instanceof ToolInputError) throw error;
    throw new ToolInputError(error instanceof Error ? error.message : 'Could not verify the signed message.');
  }
}
