import {
  assertEventRevision,
  compareEventRevision,
  MAX_EVENT_REVISION,
} from './event-revision';

describe('event revision contract', () => {
  it.each(['1', '2', '10', '9007199254740993', MAX_EVENT_REVISION])(
    'accepts %s as an exact positive int64 decimal',
    (revision) => {
      expect(() => assertEventRevision(revision)).not.toThrow();
    },
  );

  it.each([
    '',
    '0',
    '-1',
    '+1',
    '01',
    '1.0',
    '1.5',
    '1e3',
    ' 1',
    '1 ',
    '9223372036854775808',
  ])('rejects non-canonical revision %s', (revision) => {
    expect(() => assertEventRevision(revision)).toThrow();
  });

  it('compares large revisions without losing precision', () => {
    expect(compareEventRevision('1', '2')).toBe(-1);
    expect(compareEventRevision('2', '2')).toBe(0);
    expect(compareEventRevision('3', '2')).toBe(1);
    expect(compareEventRevision('9007199254740992', '9007199254740993')).toBe(
      -1,
    );
  });
});
