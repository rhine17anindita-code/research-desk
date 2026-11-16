/** Create / migrate the SQLite database and insert default feeds, signals and settings: `npm run db:init` */
import { getDb, resolveDbPath } from "../src/lib/db";

getDb();
console.log(`Database ready at ${resolveDbPath()}`);
