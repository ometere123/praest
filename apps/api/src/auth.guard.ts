import {CanActivate,ExecutionContext,Inject,Injectable,UnauthorizedException,ForbiddenException} from "@nestjs/common";
import {Reflector} from "@nestjs/core";
import {createRemoteJWKSet,jwtVerify} from "jose";
import {createHash,timingSafeEqual} from "node:crypto";
import {eq,and,isNull} from "drizzle-orm";
import {apiKeys,memberships,organizations,users} from "@praest/database";
import {DB} from "./database.module.js"; import {IS_PUBLIC} from "./public.decorator.js";

@Injectable() export class AuthGuard implements CanActivate{
 private jwks?:ReturnType<typeof createRemoteJWKSet>;
 constructor(private reflector:Reflector,@Inject(DB) private db:any){}
 async canActivate(ctx:ExecutionContext){
  if(this.reflector.getAllAndOverride<boolean>(IS_PUBLIC,[ctx.getHandler(),ctx.getClass()]))return true;
  const req=ctx.switchToHttp().getRequest<any>(); const header=String(req.headers.authorization||"");
  const internal=req.headers["x-praest-internal-token"];
  if(internal&&process.env.PRAEST_INTERNAL_TOKEN&&internal===process.env.PRAEST_INTERNAL_TOKEN){req.praestActor={type:"internal",id:"internal",organizationId:String(req.headers["x-praest-organization-id"]||"")||undefined,permissions:["*"]};return true;}
  if(header.startsWith("PraestKey "))return this.apiKey(req,header.slice(10));
  if(!header.startsWith("Bearer "))throw new UnauthorizedException("Bearer token or PraestKey required");
  const url=process.env.WORKOS_JWKS_URL;if(!url)throw new UnauthorizedException("WORKOS_JWKS_URL not configured");this.jwks??=createRemoteJWKSet(new URL(url));
  const {payload}=await jwtVerify(header.slice(7),this.jwks,{audience:process.env.WORKOS_CLIENT_ID||undefined});
  const sub=String(payload.sub||""); if(!sub)throw new UnauthorizedException("missing subject");
  const workosOrg=String((payload as any).org_id||(payload as any).organization_id||"");
  let localOrgId:string|undefined; let perms=Array.isArray((payload as any).permissions)?(payload as any).permissions.map(String):[];
  if(workosOrg){const [o]=await this.db.select().from(organizations).where(eq(organizations.workosOrganizationId,workosOrg)).limit(1);localOrgId=o?.id;}
  if(localOrgId){const [u]=await this.db.select().from(users).where(eq(users.workosUserId,sub)).limit(1); if(u){const [m]=await this.db.select().from(memberships).where(and(eq(memberships.organizationId,localOrgId),eq(memberships.userId,u.id))).limit(1);if(m)perms=[...new Set([...perms,...((m.permissions as string[])||[]),m.role==="owner"?"*":""])].filter(Boolean);}}
  req.praestActor={type:"user",id:sub,organizationId:localOrgId,workosOrganizationId:workosOrg,permissions:perms,email:String((payload as any).email||"")};return true;
 }
 private async apiKey(req:any,raw:string){const dot=raw.indexOf(".");if(dot<5)throw new UnauthorizedException("invalid API key");const prefix=raw.slice(0,dot);const hash=createHash("sha256").update(raw).digest("hex");const [k]=await this.db.select().from(apiKeys).where(and(eq(apiKeys.prefix,prefix),isNull(apiKeys.revokedAt))).limit(1);if(!k)throw new UnauthorizedException();const a=Buffer.from(hash),b=Buffer.from(k.secretHash);if(a.length!==b.length||!timingSafeEqual(a,b))throw new UnauthorizedException();req.praestActor={type:"api_key",id:k.id,organizationId:k.organizationId,permissions:(k.permissions as string[])||[]};return true;}
}
