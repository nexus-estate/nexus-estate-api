import dataSource from '../../../../database/type.config';
import { backfillTypedEstateLocations } from './backfill-typed-estate-locations';

/** Explicit deployment operation; never invoked during application startup. */
async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    console.log(
      `Typed estate locations backfilled: ${await backfillTypedEstateLocations(dataSource)}`,
    );
  } finally {
    await dataSource.destroy();
  }
}
void main().catch((error: unknown) => {
  console.error('Typed estate location backfill failed.', error);
  process.exitCode = 1;
});
