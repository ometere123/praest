import "reflect-metadata";
import {NestFactory} from "@nestjs/core";
import {FastifyAdapter,NestFastifyApplication} from "@nestjs/platform-fastify";
import {SwaggerModule,DocumentBuilder} from "@nestjs/swagger";
import {AppModule} from "./app.module.js";
import {initTelemetry} from "./telemetry.js";

async function bootstrap(){
 initTelemetry();
 const app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({trustProxy:true}),{rawBody:true});
 app.enableCors({origin:(origin,cb)=>cb(null,!origin||origin===process.env.PRAEST_APP_URL),credentials:true});
 const config=new DocumentBuilder().setTitle("PRAEST API").setDescription("Accountability and resolution infrastructure").setVersion("1.0").addBearerAuth().build();
 SwaggerModule.setup("docs",app,SwaggerModule.createDocument(app,config));
 await app.listen({port:Number(process.env.PORT||4000),host:"0.0.0.0"});
}
bootstrap();
