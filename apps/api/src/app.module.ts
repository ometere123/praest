import {Module} from "@nestjs/common";
import {APP_GUARD,APP_INTERCEPTOR} from "@nestjs/core";
import {DatabaseModule} from "./database.module.js";
import {AuthGuard} from "./auth.guard.js";
import {HealthController} from "./health.controller.js";
import {BootstrapController} from "./bootstrap.controller.js";
import {ResourcesController,ResourceService} from "./resources.js";
import {EvidenceController,EvidenceService} from "./evidence.js";
import {MonitoringController,MonitoringService} from "./monitoring.js";
import {LifecycleController,LifecycleService} from "./lifecycle.js";
import {SettlementEngine} from "./settlement-engine.js";
import {BillingController,BillingService} from "./billing.js";
import {WalletController,WalletService} from "./wallets.js";
import {X402Controller,X402Service} from "./x402.js";
import {NotificationService,InternalNotificationsController} from "./notifications.js";
import {WorkflowsController} from "./workflows.js";
import {DomainController,DomainService} from "./domains.js";
import {ExplorerController,AnalyticsController} from "./explorer.js";
import {TlsNotaryController,TlsNotaryService} from "./tlsnotary.js";
import {ProbeController} from "./probes.js";
import {InternetCourtController,InternetCourtService} from "./internet-court.js";
import {RateLimitGuard,AuditInterceptor} from "./platform-security.js";
@Module({imports:[DatabaseModule],controllers:[HealthController,BootstrapController,ResourcesController,EvidenceController,MonitoringController,LifecycleController,BillingController,WalletController,X402Controller,InternalNotificationsController,WorkflowsController,DomainController,ExplorerController,AnalyticsController,TlsNotaryController,ProbeController,InternetCourtController],providers:[ResourceService,EvidenceService,MonitoringService,LifecycleService,SettlementEngine,BillingService,WalletService,X402Service,NotificationService,DomainService,TlsNotaryService,InternetCourtService,{provide:APP_GUARD,useClass:AuthGuard},{provide:APP_GUARD,useClass:RateLimitGuard},{provide:APP_INTERCEPTOR,useClass:AuditInterceptor}]})
export class AppModule{}
