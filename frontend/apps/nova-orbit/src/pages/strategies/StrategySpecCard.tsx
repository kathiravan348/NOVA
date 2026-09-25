import type { StrategySpec } from "@nova/contracts";
import { Card, CodeEditor, DescriptionList } from "@nova/ui-core";
import { segmentLabel, timeframeLabel } from "../../lib/format";
import {
  describeAveraging,
  describeRisk,
  describeRuleGroup,
  describeSizing,
} from "../../lib/strategyText";

function RuleBlock({
  title,
  group,
}: {
  title: string;
  group: ReturnType<typeof describeRuleGroup>;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-card-title text-text-primary">{title}</h3>
      <p className="text-body-sm text-text-muted">{group.heading}:</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-text-primary">
        {group.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export interface StrategySpecCardProps {
  spec: StrategySpec;
  version: number;
}

export function StrategySpecCard({ spec, version }: StrategySpecCardProps) {
  return (
    <Card title={`Specification · v${version}`}>
      <div className="flex flex-col gap-6">
        <DescriptionList
          columns={2}
          items={[
            { label: "Mode", value: spec.mode === "visual" ? "Visual rules" : "Python" },
            { label: "Segment", value: segmentLabel[spec.segment] },
            { label: "Exchange", value: spec.exchange },
            { label: "Timeframe", value: timeframeLabel[spec.timeframe] },
            { label: "Sizing", value: describeSizing(spec.sizing) },
            { label: "Risk", value: describeRisk(spec.risk) },
            { label: "Cost averaging", value: describeAveraging(spec.averaging) },
          ]}
        />
        {spec.mode === "visual" ? (
          <div className="grid gap-6 md:grid-cols-2">
            <RuleBlock title="Entry" group={describeRuleGroup(spec.entry)} />
            <RuleBlock title="Exit" group={describeRuleGroup(spec.exit)} />
          </div>
        ) : (
          <section className="flex flex-col gap-2">
            <h3 className="text-card-title text-text-primary">Code</h3>
            <p className="text-body-sm text-text-muted">
              Python strategy: entry and exit rules live in its code.
            </p>
            <CodeEditor value={spec.code} readOnly minHeight={80} ariaLabel="Strategy code" />
          </section>
        )}
      </div>
    </Card>
  );
}
