import { describe, it, expect } from 'vitest';
import { ZipBuilder, computeCrc32 } from '@/lib/zip/ZipBuilder';
import zlib from 'zlib';

describe('RaagaX Bulk ZIP Exporter & PKZIP Engine', () => {
  it('correctly calculates RFC 1952 / ISO 3309 standard CRC-32 identical to Node.js zlib', () => {
    const testCases = [
      Buffer.from(''),
      Buffer.from('Hello, RaagaX!'),
      Buffer.from('Telugu Music Stream High Bitrate 320kbps MP3 Audio Test Vector'),
      Buffer.alloc(10000, 0x42),
    ];

    for (const testBuffer of testCases) {
      const uint8 = new Uint8Array(testBuffer.buffer, testBuffer.byteOffset, testBuffer.byteLength);
      const customCrc = computeCrc32(uint8);
      const nodeCrc = zlib.crc32(testBuffer);
      expect(customCrc).toBe(nodeCrc);
    }
  });

  it('builds a valid PKZIP file structure with local file headers and central directory', async () => {
    const file1Data = new TextEncoder().encode('Dummy MP3 stream content 1').buffer;
    const file2Data = new TextEncoder().encode('Dummy MP3 stream content 2 with more bytes').buffer;

    const entries = [
      { name: 'Samajavaragamana - Sid Sriram.mp3', data: file1Data },
      { name: 'Butta Bomma - Armaan Malik.mp3', data: file2Data },
    ];

    const zipBlob = ZipBuilder.buildZip(entries);
    expect(zipBlob).toBeDefined();
    expect(zipBlob.type).toBe('application/zip');
    expect(zipBlob.size).toBeGreaterThan(file1Data.byteLength + file2Data.byteLength);

    const buffer = Buffer.from(await zipBlob.arrayBuffer());

    // PKZIP local file header signature: 0x04034b50 ('PK\x03\x04')
    expect(buffer.readUInt32LE(0)).toBe(0x04034b50);

    // End of central directory record signature: 0x06054b50 ('PK\x05\x06')
    const endSignatureIndex = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(endSignatureIndex).toBeGreaterThan(0);

    // Number of entries in central directory should be 2
    const totalEntries = buffer.readUInt16LE(endSignatureIndex + 10);
    expect(totalEntries).toBe(2);
  });
});
