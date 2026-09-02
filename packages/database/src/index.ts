import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
export * from "./schema.js";
export function createDatabase(url=process.env.DATABASE_URL){if(!url)throw new Error("DATABASE_URL is required");const pool=new Pool({connectionString:url,max:10,ssl:url.includes("localhost")?false:{rejectUnauthorized:false}});return {db:drizzle(pool),pool};}
