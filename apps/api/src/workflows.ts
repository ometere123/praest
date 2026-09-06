// Background work used to run as Temporal workflows. PRAEST only ever used three, and all three
// were "call the API, sleep, repeat", so Temporal was removed and the scheduler in apps/worker
// drives idempotent sweep endpoints instead. See docs/BUILD_PLAN.md.
//
// These two endpoints are kept so the API surface does not change: they now perform the work
// directly rather than starting a durable workflow. The recurring half of what the old workflows
// did (re-running monitors, finalizing once an appeal window closes) is the scheduler's job.
import { Body, Controller, ForbiddenException, Param, Post, Req } from "@nestjs/common";
import { hasPermission } from "./request-context.js";
import { LifecycleService } from "./lifecycle.js";
import { MonitoringService } from "./monitoring.js";

@Controller("v1/workflows")
export class WorkflowsController {
  constructor(
    private lifecycle: LifecycleService,
    private monitoring: MonitoringService,
  ) {}

  // Was: start caseLifecycle (adjudicate -> wait for appeal deadline -> finalize).
  // Now: adjudicate immediately. Finalization happens when the scheduler's adjudication sweep
  // sees the appeal window has closed - the wait was never work, only a timer.
  @Post("cases/:id")
  async case(@Req() r: any, @Param("id") id: string) {
    if (!hasPermission(r.praestActor, "disputes:write")) throw new ForbiddenException();
    const adjudication = await this.lifecycle.adjudicate(r.praestActor.organizationId, id);
    return { mode: "scheduler", adjudication, finalization: "pending-appeal-window" };
  }

  // Was: start monitorLoop (run monitor, sleep intervalSeconds, repeat).
  // Now: run once. The repeat is the scheduler's monitor sweep.
  @Post("monitors/:id")
  async monitor(@Req() r: any, @Param("id") id: string, @Body() b: any) {
    if (!hasPermission(r.praestActor, "monitors:write")) throw new ForbiddenException();
    const result = await this.monitoring.runById(r.praestActor.organizationId, id, b?.region || "manual");
    return { mode: "scheduler", result };
  }
}
