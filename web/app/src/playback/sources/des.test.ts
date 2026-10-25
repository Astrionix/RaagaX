import { describe, expect, it } from 'vitest';
import { decryptDesEcbBase64 } from './des';

describe('DES ECB decryption', () => {
  it('correctly decrypts JioSaavn encrypted media url', () => {
    const cipher = 'ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDyUAfhmijvFBT8pPh5PqKgzsRHfUZzMKSjj3NUx57Nm2u/4CmI0GLa9hw7tS9a8Gtq';
    const key = '38346591';
    const decrypted = decryptDesEcbBase64(cipher, key);
    expect(decrypted).toBe('https://aac.saavncdn.com/396/b4e570050007b056c662f2a98c9f28ec_96.mp4');
  });

  it('handles empty input gracefully', () => {
    expect(decryptDesEcbBase64('', '38346591')).toBe('');
  });
});
