export type Actor={type:"user"|"api_key"|"internal";id:string;organizationId?:string;permissions:string[];email?:string;workosOrganizationId?:string};
declare module "http" {interface IncomingMessage{praestActor?:Actor;rawBody?:Buffer}}
export const hasPermission=(a:Actor|undefined,p:string)=>!!a&&(a.type==="internal"||a.permissions.includes("*")||a.permissions.includes(p));
