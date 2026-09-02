import { Card } from "@/components/ui/Card";
import { Timeline } from "@/components/ui/Timeline";

export function ContextPanel({ path }: { path: string }) {
  if (path.includes("hyperlane") || path.includes("/routes"))
    return (
      <Card title="Decision transport">
        <Timeline
          events={[
            { title: "StudioNet finalized decision", status: "finalized" },
            { title: "PRAEST verifies DecisionOutbox payload", status: "processing" },
            { title: "zkSync Sepolia gateway dispatches Hyperlane message", status: "processing" },
            { title: "Destination Mailbox + ISM verify", status: "pending" },
            { title: "Local escrow executes and PRAEST reconciles proof", status: "pending" },
          ]}
        />
      </Card>
    );
  if (path.includes("genlayer") || path.includes("adjudication"))
    return (
      <div className="provisional-notice">
        <div>
          <strong>Finality rule.</strong> ACCEPTED is provisional. PRAEST authorizes cross-chain settlement only after the appeal window and GenLayer FINALIZED state.
        </div>
      </div>
    );
  return null;
}
