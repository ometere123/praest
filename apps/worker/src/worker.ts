import {NativeConnection,Worker} from "@temporalio/worker";
import {Client,Connection as ClientConnection,WorkflowExecutionAlreadyStartedError} from "@temporalio/client";
import {temporalConnectionOptions} from "@praest/config/temporal";
import * as activities from "./activities.js";
import {fileURLToPath} from "node:url";
async function main(){const {address,namespace,taskQueue,tls,apiKey}=temporalConnectionOptions();const opts={address,tls,apiKey};const connection=await NativeConnection.connect(opts);const worker=await Worker.create({connection,namespace,taskQueue,workflowsPath:fileURLToPath(new URL("./workflows.js",import.meta.url)),activities:activities.activities});const clientConn=await ClientConnection.connect(opts);const client=new Client({connection:clientConn,namespace});try{await client.workflow.start("webhookSweep",{taskQueue,workflowId:"praest:webhook-sweep",args:[]})}catch(e){if(!(e instanceof WorkflowExecutionAlreadyStartedError))throw e}try{await worker.run()}finally{await clientConn.close();await connection.close()}}main().catch(e=>{console.error(e);process.exit(1)});
