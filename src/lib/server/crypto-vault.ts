import crypto from "node:crypto";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

/**
 * EdusGPT Latin-Chinese Security Vault (AES-256-GCM + CJK Glyph Obfuscation)
 * -------------------------------------------------------------------------
 * Provides high-grade data encryption for all local files in `data/`
 * (courses, logs, audio caches, trashed items).
 * 
 * Files stored on disk are rendered as an unreadable, tamper-resistant
 * mixture of classic Latin phonetics and ancient Chinese CJK ideographs.
 * They cannot be opened, inspected, or played outside EdusGPT.
 */

export const CIPHER_PREFIX = "EDUS_ZH_LATIN_CIPHER_V1:\n";
export const BINARY_MAGIC = Buffer.from("EDUS_ZH_LATIN_CIPHER_V1:\n", "utf-8");

// --- 1. Latin Alphabet Mapping (256 distinct Latin / Extended Latin chars) ---
const LATIN_CHARS: string[] = (() => {
  const chars: string[] = [];
  // Basic Latin: A-Z (26), a-z (26), 0-9 (10) -> 62 chars
  for (let c = 65; c <= 90; c++) chars.push(String.fromCharCode(c));
  for (let c = 97; c <= 122; c++) chars.push(String.fromCharCode(c));
  for (let c = 48; c <= 57; c++) chars.push(String.fromCharCode(c));
  
  // Latin-1 Supplement (0x00C0 to 0x00FF, skipping control / ambiguous symbols) -> 64 chars
  for (let c = 0x00c0; c <= 0x00ff; c++) {
    chars.push(String.fromCharCode(c));
  }
  
  // Latin Extended-A & B (0x0100 onwards) to fill up to exactly 256 unique characters
  let code = 0x0100;
  while (chars.length < 256) {
    chars.push(String.fromCharCode(code++));
  }
  return chars.slice(0, 256);
})();

const LATIN_TO_BYTE = new Map<string, number>();
for (let i = 0; i < LATIN_CHARS.length; i++) {
  LATIN_TO_BYTE.set(LATIN_CHARS[i], i);
}

// CJK Unicode Base Offsets for 3 byte slots
const CJK_BASE_1 = 0x4e00; // 19968 (CJK Unified Ideographs block 1)
const CJK_BASE_2 = 0x5e00; // 24064 (CJK Unified Ideographs block 2)
const CJK_BASE_3 = 0x6e00; // 28160 (CJK Unified Ideographs block 3)

/**
 * Encode raw binary bytes into Latin-Chinese glyph string.
 * Employs a 4-byte cadence: [Latin char][CJK 1][CJK 2][CJK 3]
 */
function encodeLatinChinese(rawBuffer: Buffer): string {
  // Prepend 4 bytes original length
  const header = Buffer.alloc(4);
  header.writeUInt32BE(rawBuffer.length, 0);

  const fullBuf = Buffer.concat([header, rawBuffer]);
  const remainder = fullBuf.length % 4;
  const paddingNeeded = remainder === 0 ? 0 : 4 - remainder;
  const paddedBuf = paddingNeeded > 0
    ? Buffer.concat([fullBuf, Buffer.alloc(paddingNeeded, 0)])
    : fullBuf;

  const glyphs: string[] = [];
  const len = paddedBuf.length;

  for (let i = 0; i < len; i += 4) {
    const b0 = paddedBuf[i];
    const b1 = paddedBuf[i + 1];
    const b2 = paddedBuf[i + 2];
    const b3 = paddedBuf[i + 3];

    glyphs.push(LATIN_CHARS[b0]);
    glyphs.push(String.fromCharCode(CJK_BASE_1 + b1));
    glyphs.push(String.fromCharCode(CJK_BASE_2 + b2));
    glyphs.push(String.fromCharCode(CJK_BASE_3 + b3));
  }

  return CIPHER_PREFIX + glyphs.join("");
}

/**
 * Decode Latin-Chinese glyph string back to raw binary bytes.
 */
function decodeLatinChinese(cipherText: string): Buffer {
  if (!cipherText.startsWith(CIPHER_PREFIX)) {
    throw new Error("Invalid Latin-Chinese cipher header");
  }

  const glyphStr = cipherText.slice(CIPHER_PREFIX.length);
  const bytes: number[] = [];
  const chars = Array.from(glyphStr);

  for (let i = 0; i < chars.length; i += 4) {
    const c0 = chars[i];
    const c1 = chars[i + 1];
    const c2 = chars[i + 2];
    const c3 = chars[i + 3];

    if (!c0 || !c1 || !c2 || !c3) break;

    const b0 = LATIN_TO_BYTE.get(c0);
    if (b0 === undefined) {
      throw new Error(`Corrupted Latin character in cipher: ${c0}`);
    }

    const code1 = c1.charCodeAt(0);
    const code2 = c2.charCodeAt(0);
    const code3 = c3.charCodeAt(0);

    const b1 = (code1 - CJK_BASE_1) & 0xff;
    const b2 = (code2 - CJK_BASE_2) & 0xff;
    const b3 = (code3 - CJK_BASE_3) & 0xff;

    bytes.push(b0, b1, b2, b3);
  }

  const rawReconstructed = Buffer.from(bytes);
  if (rawReconstructed.length < 4) {
    throw new Error("Cipher payload too short");
  }

  const originalLength = rawReconstructed.readUInt32BE(0);
  return rawReconstructed.subarray(4, 4 + originalLength);
}

// --- 2. Master Key Management ---
let cachedMasterKey: Buffer | null = null;

export function getOrCreateDataKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  let rawKey = process.env.EDUSGPT_DATA_KEY?.trim();

  const envPath = path.join(process.cwd(), ".env");

  if (!rawKey && fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^EDUSGPT_DATA_KEY\s*=\s*(.+)$/m);
      if (match && match[1]?.trim()) {
        rawKey = match[1].trim();
      }
    } catch {
      // ignore
    }
  }

  if (!rawKey) {
    // Generate fresh 32-byte secure key and persist to .env
    rawKey = crypto.randomBytes(32).toString("hex");
    try {
      const line = `\n# EdusGPT local storage encryption key (Do not lose or modify)\nEDUSGPT_DATA_KEY=${rawKey}\n`;
      fs.appendFileSync(envPath, line, "utf-8");
      process.env.EDUSGPT_DATA_KEY = rawKey;
    } catch {
      // In read-only or restricted environments, key remains in-memory
      process.env.EDUSGPT_DATA_KEY = rawKey;
    }
  }

  // Derive exact 256-bit key via SHA-256 for mathematical uniformity
  cachedMasterKey = crypto.createHash("sha256").update(rawKey).digest();
  return cachedMasterKey;
}

// --- 3. Encryption / Decryption APIs ---

/**
 * Checks whether text or buffer is encrypted with EdusGPT Latin-Chinese cipher.
 */
export function isEncryptedPayload(data: string | Uint8Array): boolean {
  if (typeof data === "string") {
    return data.startsWith(CIPHER_PREFIX);
  }
  if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
    const prefixBytes = Buffer.from(CIPHER_PREFIX, "utf-8");
    if (data.length < prefixBytes.length) return false;
    for (let i = 0; i < prefixBytes.length; i++) {
      if (data[i] !== prefixBytes[i]) return false;
    }
    return true;
  }
  return false;
}

/**
 * Encrypt a text string (e.g. course JSON or run-log) into an unreadable
 * Latin-Chinese glyph string.
 */
export function encryptText(plainText: string): string {
  const key = getOrCreateDataKey();
  const plainBuf = Buffer.from(plainText, "utf-8");

  // Step 1: Gzip compression to compact JSON and maximize entropy
  const compressed = zlib.gzipSync(plainBuf, { level: 6 });

  // Step 2: AES-256-GCM authenticated encryption
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Packet: [IV (12B)][AuthTag (16B)][Encrypted Payload]
  const packet = Buffer.concat([iv, authTag, encrypted]);

  // Step 3: Latin-Chinese glyph representation
  return encodeLatinChinese(packet);
}

/**
 * Decrypt a Latin-Chinese glyph string back to plain text.
 * Backwards compatible: if input is plain unencrypted text (e.g. old JSON),
 * it returns the text unmodified without error.
 */
export function decryptText(cipherOrPlainText: string): string {
  if (!isEncryptedPayload(cipherOrPlainText)) {
    return cipherOrPlainText;
  }

  const key = getOrCreateDataKey();
  const packet = decodeLatinChinese(cipherOrPlainText);

  if (packet.length < 28) {
    throw new Error("Cipher packet too small (missing IV or AuthTag)");
  }

  const iv = packet.subarray(0, 12);
  const authTag = packet.subarray(12, 28);
  const encrypted = packet.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const compressed = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  const plainBuf = zlib.gunzipSync(compressed);
  return plainBuf.toString("utf-8");
}

/**
 * Encrypt a binary buffer (e.g. MP3/WAV audio) into a secured format.
 * Returns a Buffer containing the Latin-Chinese UTF-8 encoded text.
 */
export function encryptBinary(buffer: Uint8Array): Buffer {
  const key = getOrCreateDataKey();
  const plainBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // AES-256-GCM encryption on audio bytes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const packet = Buffer.concat([iv, authTag, encrypted]);
  const glyphText = encodeLatinChinese(packet);
  return Buffer.from(glyphText, "utf-8");
}

/**
 * Decrypt a secured audio buffer back to original binary MP3/WAV.
 * Backwards compatible: if input is a normal MP3/WAV audio file,
 * it returns the original buffer untouched.
 */
export function decryptBinary(encryptedOrPlain: Uint8Array): Buffer {
  const buf = Buffer.isBuffer(encryptedOrPlain)
    ? encryptedOrPlain
    : Buffer.from(encryptedOrPlain);

  if (!isEncryptedPayload(buf)) {
    return buf;
  }

  const key = getOrCreateDataKey();
  const cipherText = buf.toString("utf-8");
  const packet = decodeLatinChinese(cipherText);

  if (packet.length < 28) {
    throw new Error("Audio cipher packet too small");
  }

  const iv = packet.subarray(0, 12);
  const authTag = packet.subarray(12, 28);
  const encrypted = packet.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
