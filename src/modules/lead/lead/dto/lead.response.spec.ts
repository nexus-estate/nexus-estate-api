import { LeadStatus } from '../entities';
import type { LeadResponse } from './lead.response';

describe('LeadResponse', () => {
  it('exposes the listing identity and lifecycle state', () => {
    const response = {
      id: 'lead-id',
      listingId: 'listing-id',
      status: LeadStatus.NEW,
      name: 'Jane',
      phone: '0900000000',
      email: null,
      message: null,
      createdAt: new Date(),
    } as LeadResponse;

    expect(response.listingId).toBe('listing-id');
    expect(response.status).toBe(LeadStatus.NEW);
  });
});
