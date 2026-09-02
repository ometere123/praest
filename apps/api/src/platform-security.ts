import {CallHandler,CanActivate,ExecutionContext,HttpException,HttpStatus,Inject,Injectable,NestInterceptor} from '@nestjs/common';
class TooManyRequestsException extends HttpException{constructor(){super('Too Many Requests',HttpStatus.TOO_MANY_REQUESTS)}}
import {Observable,tap} from 'rxjs';
import {Redis} from '@upstash/redis';
import {DB} from './database.module.js';
import {auditLogs} from '@praest/database';

const buckets=new Map<string,{count:number,reset:number}>();
function clientKey(req:any){const actor=req.praestActor?.id||req.ip||req.socket?.remoteAddress||'anonymous';return `${req.praestActor?.organizationId||'global'}:${actor}`}
@Injectable() export class RateLimitGuard implements CanActivate{
 private redis?:Redis;
 constructor(){if(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN)this.redis=new Redis({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN})}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest<any>();if(req.praestActor?.type==='internal')return true;const limit=Number(process.env.PRAEST_RATE_LIMIT_PER_MINUTE||240);const key=clientKey(req);if(this.redis){const window=Math.floor(Date.now()/60000);const rk=`praest:rl:${window}:${key}`;const n=await this.redis.incr(rk);if(n===1)await this.redis.expire(rk,120);if(n>limit)throw new TooManyRequestsException();return true}const now=Date.now();let b=buckets.get(key);if(!b||b.reset<=now)b={count:0,reset:now+60000};b.count++;buckets.set(key,b);if(b.count>limit)throw new TooManyRequestsException();return true}
}

@Injectable() export class AuditInterceptor implements NestInterceptor{
 constructor(@Inject(DB)private db:any){}
 intercept(ctx:ExecutionContext,next:CallHandler):Observable<any>{const req=ctx.switchToHttp().getRequest<any>();if(!['POST','PUT','PATCH','DELETE'].includes(req.method)||!req.praestActor?.organizationId)return next.handle();const started=Date.now();return next.handle().pipe(tap({next:()=>this.write(req,'success',started),error:(e)=>this.write(req,'failure',started,e)}))}
 private write(req:any,outcome:string,started:number,error?:any){void this.db.insert(auditLogs).values({organizationId:req.praestActor.organizationId,actorType:req.praestActor.type,actorId:req.praestActor.id,action:`${req.method} ${req.url}`,resourceType:String(req.routerPath||req.url).split('?')[0],resourceId:req.params?.id||null,metadata:{outcome,durationMs:Date.now()-started,error:error?String(error?.message||error):undefined,ip:req.ip,userAgent:req.headers?.['user-agent']||null}}).catch(()=>{})}
}
