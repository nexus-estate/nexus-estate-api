import dataSource from '../../../database/type.config';

import { backfillLegacyEstateProviders } from './backfill-legacy-estate-providers';

/** Executes the provider-account backfill as an explicit CLI operation. */
async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const created = await backfillLegacyEstateProviders(dataSource);
    console.log(
      `Provider account backfill complete: ${created} account(s) created.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('Provider account backfill failed.', error);
  process.exitCode = 1;
});
