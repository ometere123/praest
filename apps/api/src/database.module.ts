import {Global,Module} from "@nestjs/common";import {createDatabase} from "@praest/database";
export const DATABASE=Symbol("DATABASE"),DB=Symbol("DB"),POOL=Symbol("POOL");
@Global() @Module({providers:[{provide:DATABASE,useFactory:()=>createDatabase()},{provide:DB,useFactory:(x:any)=>x.db,inject:[DATABASE]},{provide:POOL,useFactory:(x:any)=>x.pool,inject:[DATABASE]}],exports:[DB,POOL]}) export class DatabaseModule{}
