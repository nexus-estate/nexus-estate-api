import { BcryptService } from './bcrypt.service';

describe('BcryptService', () => {
  it('hashes and compares a plaintext value', async () => {
    const service = new BcryptService();
    const digest = await service.hash('correct-value');

    await expect(service.compare('correct-value', digest)).resolves.toBe(true);
    await expect(service.compare('wrong-value', digest)).resolves.toBe(false);
  });
});
