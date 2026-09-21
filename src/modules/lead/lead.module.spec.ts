import { MODULE_METADATA } from '@nestjs/common/constants';
import { LeadController } from './lead/controllers/lead.controller';
import { LeadModule } from './lead.module';
import { LeadService } from './lead/services/lead.service';

describe('lead module', () => {
  it('wires the lead HTTP adapter and service from the feature boundary', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, LeadModule),
    ).toContain(LeadController);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, LeadModule),
    ).toContain(LeadService);
  });
});
