/**
 * Read pixel dimensions out of an image header.
 *
 * Every format accepted for delivery declares its dimensions in the first few
 * hundred bytes, so a ranged read answers the question for a 200 MP orthophoto
 * as cheaply as for a thumbnail. Written by hand rather than pulled from a
 * dependency: this is a few dozen bytes of well-specified header parsing, and
 * the alternative (`sharp`) drags a native binary into a serverless bundle to
 * answer a question it would have to decode the whole image to reach.
 */

/** Bytes to fetch when probing. JPEG's SOF marker can sit behind a large EXIF
 *  or ICC block, which is what sets this above the other formats' needs. */
export const IMAGE_PROBE_BYTES = 256 * 1024;

export interface ImageStats {
  width: number;
  height: number;
}

export class ImageFormatError extends Error {}

export function probeImage(bytes: Uint8Array, extension: string): ImageStats {
  const stats =
    extension === "png"
      ? png(bytes)
      : extension === "jpg" || extension === "jpeg"
        ? jpeg(bytes)
        : extension === "webp"
          ? webp(bytes)
          : null;

  if (!stats) {
    throw new ImageFormatError(
      `Dimensions could not be read from this .${extension} file. It may be truncated, or not the format its name claims.`,
    );
  }
  return stats;
}

function png(b: Uint8Array): ImageStats | null {
  // 8-byte signature, then the IHDR chunk, whose width and height are the
  // first two fields of its payload. The signature check matters: a renamed
  // TIFF would otherwise yield two plausible-looking integers.
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.byteLength < 24) return null;
  for (let i = 0; i < SIGNATURE.length; i++) if (b[i] !== SIGNATURE[i]) return null;

  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function jpeg(b: Uint8Array): ImageStats | null {
  if (b.byteLength < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);

  let offset = 2;
  while (offset + 9 < b.byteLength) {
    if (b[offset] !== 0xff) {
      offset++; // resynchronise across padding bytes
      continue;
    }
    const marker = b[offset + 1];

    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // Start of scan: compressed data follows, and the frame header is behind
    // us. If we reach here we are not going to find dimensions.
    if (marker === 0xda || marker === 0xd9) return null;

    const length = view.getUint16(offset + 2, false);
    if (length < 2) return null;

    // SOF0–SOF15 hold the frame dimensions. 0xC4 (Huffman tables), 0xC8
    // (reserved) and 0xCC (arithmetic coding conditioning) share the range
    // but are not frame headers.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function webp(b: Uint8Array): ImageStats | null {
  if (b.byteLength < 30) return null;
  const tag = (start: number) => String.fromCharCode(b[start], b[start + 1], b[start + 2], b[start + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP") return null;

  const format = tag(12);

  if (format === "VP8X") {
    // Canvas size is stored as (value - 1) across three little-endian bytes.
    const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { width: w, height: h };
  }

  if (format === "VP8 ") {
    // Lossy: a 3-byte frame tag, a 3-byte start code, then 14-bit dimensions
    // with the top two bits used as a scaling hint we deliberately discard.
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  if (format === "VP8L") {
    // Lossless: a signature byte, then 14 bits of width and 14 of height
    // packed across a little-endian 32-bit read.
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}
