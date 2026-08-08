import { DateHelper } from '../date.helper';

describe('DateHelper', () => {
  describe('now', () => {
    it('should return current date', () => {
      const result = DateHelper.now();
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('addDays', () => {
    it('should add days to a date', () => {
      const date = new Date('2024-01-01');
      const result = DateHelper.addDays(date, 7);
      expect(result.getDate()).toBe(8);
    });
  });

  describe('isExpired', () => {
    it('should return true for past date', () => {
      const past = new Date('2020-01-01');
      expect(DateHelper.isExpired(past)).toBe(true);
    });

    it('should return false for future date', () => {
      const future = DateHelper.addDays(new Date(), 30);
      expect(DateHelper.isExpired(future)).toBe(false);
    });
  });

  describe('format', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-12-25');
      expect(DateHelper.format(date, 'YYYY-MM-DD')).toBe('2024-12-25');
    });
  });
});
