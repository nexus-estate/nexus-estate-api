import { getMetadataArgsStorage } from 'typeorm';
import { AuthorizationAuditLog } from './authorization-audit-log.entity';

describe('AuthorizationAuditLog entity', () => {
  it('persists actor, target, request, and before/after authorization state', () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === AuthorizationAuditLog)
      .map((column) => column.options.name ?? column.propertyName);
    expect(columns).toEqual(
      expect.arrayContaining([
        'actor_administrator_id',
        'platform',
        'action',
        'target_type',
        'target_id',
        'before_state',
        'after_state',
        'request_id',
      ]),
    );
  });
});
