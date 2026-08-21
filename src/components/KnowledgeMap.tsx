import { Progress } from "@/components/ui/progress";

export type Skill = { name: string; mastery: number };

function tone(m: number) {
  if (m >= 75) return "text-success";
  if (m >= 45) return "text-primary";
  return "text-accent-foreground";
}

export function KnowledgeMap({ skills }: { skills: Skill[] }) {
  if (!skills.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Your knowledge map builds itself as you learn.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {skills.map((s) => (
        <div key={s.name} className="rise">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{s.name}</span>
            <span className={`text-xs font-semibold tabular-nums ${tone(s.mastery)}`}>
              {Math.round(s.mastery)}%
            </span>
          </div>
          <Progress value={s.mastery} className="h-2" />
        </div>
      ))}
    </div>
  );
}
