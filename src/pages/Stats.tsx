import { PageShell } from "@/components/PageShell";
const Stats = () => (
  <PageShell title="Stats">
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Hoofprints</div>
        <div className="font-display text-3xl brass-text mt-1">0</div>
      </div>
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Podiums</div>
        <div className="font-display text-3xl brass-text mt-1">0</div>
      </div>
    </div>
  </PageShell>
);
export default Stats;
