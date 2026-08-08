import dataSource from '../../type.config';

import { seedLocation } from './location.seed';

async function run(): Promise<void> {
  try {
    await dataSource.initialize();

    console.log('Database connected');

    await seedLocation(dataSource);

    console.log('Location seed completed');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run();
