import { HashHelper } from '../hash.helper';

describe('HashHelper', () => {
  describe('hash', () => {
    it('should hash a plain text string', async () => {
      const result = await HashHelper.hash('testPassword123');
      expect(result).toBeDefined();
      expect(result).not.toBe('testPassword123');
      expect(result).toContain('$2b$');
    });

    it('should produce different hashes for same input (different salts)', async () => {
      const hash1 = await HashHelper.hash('samePassword');
      const hash2 = await HashHelper.hash('samePassword');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compare', () => {
    it('should return true for matching password', async () => {
      const hash = await HashHelper.hash('myPassword');
      const result = await HashHelper.compare('myPassword', hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const hash = await HashHelper.hash('myPassword');
      const result = await HashHelper.compare('wrongPassword', hash);
      expect(result).toBe(false);
    });
  });
});
