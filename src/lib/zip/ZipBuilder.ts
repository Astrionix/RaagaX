/**
 * Pure TypeScript PKZIP (STORE method) Archive Builder
 * Zero external dependencies. Ultra-fast for MP3s (avoids redundant DEFLATE compression).
 * Compatible with Windows Explorer, macOS Archive Utility, Linux, Android, iOS.
 */

// CRC-32 Lookup Table
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

export function computeCrc32(data: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array | ArrayBuffer;
}

export class ZipBuilder {
  /**
   * Builds a PKZIP archive in memory from an array of file entries.
   * Returns a standard application/zip Blob.
   */
  public static buildZip(files: ZipEntry[]): Blob {
    const localHeadersAndData: Uint8Array[] = [];
    const centralHeaders: Uint8Array[] = [];
    let offset = 0;

    const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : { encode: (s: string) => Buffer.from(s, 'utf8') };

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      const crc = computeCrc32(dataBytes);
      const size = dataBytes.byteLength;

      // 1. Local File Header (30 bytes + filename)
      const lh = new Uint8Array(30 + nameBytes.length);
      const lhView = new DataView(lh.buffer);

      lhView.setUint32(0, 0x04034b50, true); // Local header signature
      lhView.setUint16(4, 20, true);         // Version needed: 2.0
      lhView.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8 filename)
      lhView.setUint16(8, 0, true);          // Compression method: 0 (STORE)
      lhView.setUint16(10, 0, true);         // Last mod file time
      lhView.setUint16(12, 0, true);         // Last mod file date
      lhView.setUint32(14, crc, true);       // CRC-32
      lhView.setUint32(18, size, true);      // Compressed size
      lhView.setUint32(22, size, true);      // Uncompressed size
      lhView.setUint16(26, nameBytes.length, true); // Filename length
      lhView.setUint16(28, 0, true);         // Extra field length
      lh.set(nameBytes, 30);

      // 2. Central Directory File Header (46 bytes + filename)
      const ch = new Uint8Array(46 + nameBytes.length);
      const chView = new DataView(ch.buffer);

      chView.setUint32(0, 0x02014b50, true); // Central header signature
      chView.setUint16(4, 20, true);         // Version made by: 2.0
      chView.setUint16(6, 20, true);         // Version needed: 2.0
      chView.setUint16(8, 0x0800, true);     // Flags (UTF-8)
      chView.setUint16(10, 0, true);         // Compression (STORE)
      chView.setUint16(12, 0, true);         // Time
      chView.setUint16(14, 0, true);         // Date
      chView.setUint32(16, crc, true);       // CRC-32
      chView.setUint32(20, size, true);      // Compressed size
      chView.setUint32(24, size, true);      // Uncompressed size
      chView.setUint16(28, nameBytes.length, true); // Filename length
      chView.setUint16(30, 0, true);         // Extra field length
      chView.setUint16(32, 0, true);         // File comment length
      chView.setUint16(34, 0, true);         // Disk number start
      chView.setUint16(36, 0, true);         // Internal file attributes
      chView.setUint32(38, 0x81a40000, true);// External attributes (regular file 0644)
      chView.setUint32(42, offset, true);    // Relative offset of local header
      ch.set(nameBytes, 46);

      localHeadersAndData.push(lh);
      localHeadersAndData.push(dataBytes);
      centralHeaders.push(ch);

      offset += lh.byteLength + dataBytes.byteLength;
    }

    const centralDirOffset = offset;
    const centralDirSize = centralHeaders.reduce((acc, h) => acc + h.byteLength, 0);

    // 3. End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true);          // Disk number
    eocdView.setUint16(6, 0, true);          // Disk where central dir starts
    eocdView.setUint16(8, files.length, true);  // Number of entries on this disk
    eocdView.setUint16(10, files.length, true); // Total entries
    eocdView.setUint32(12, centralDirSize, true); // Central dir size
    eocdView.setUint32(16, centralDirOffset, true); // Central dir offset
    eocdView.setUint16(20, 0, true);         // Comment length

    // Assemble full ZIP blob
    return new Blob([...localHeadersAndData, ...centralHeaders, eocd] as any, {
      type: 'application/zip',
    });
  }
}
