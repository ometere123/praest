import {authkitProxy} from "@workos-inc/authkit-nextjs";
export default authkitProxy({eagerAuth:true,middlewareAuth:{enabled:true,unauthenticatedPaths:["/","/about","/how-it-works","/pricing","/developers","/docs","/security","/status","/login","/signup","/callback"]}});
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|brand/).*)"]};
