import dataSource from '../../../../database/type.config';

import { backfillLegacyEstateSellers } from './backfill-legacy-estate-sellers';

/** Executes the seller-account backfill as an explicit CLI operation. */
async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const created = await backfillLegacyEstateSellers(dataSource);
    console.log(
      `Seller account backfill complete: ${created} account(s) created.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('Seller account backfill failed.', error);
  process.exitCode = 1;
});
