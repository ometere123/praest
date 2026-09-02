import routes from "./routes.json" with {type:"json"};
import chains from "./chains.json" with {type:"json"};
export {routes,chains};
export type ChainConfig=(typeof chains)[number];
