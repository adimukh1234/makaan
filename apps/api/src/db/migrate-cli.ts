import { loadConfig } from '../config';
import { openDatabase } from './index';

const config = loadConfig();
openDatabase(config.DATABASE_URL);
console.log(`Database ready at ${config.DATABASE_URL}`);
