import {Controller,Get} from "@nestjs/common";import {Public} from "./public.decorator.js";
@Controller() export class HealthController{@Public() @Get("healthz") health(){return {ok:true,service:"praest-api",time:new Date().toISOString()}}}
