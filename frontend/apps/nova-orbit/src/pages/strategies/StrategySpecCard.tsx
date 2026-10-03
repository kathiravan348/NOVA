import type { CandleStrategySpec, StrategySpec } from "@nova/contracts";
import { Card, CodeEditor, DescriptionList } from "@nova/ui-core";
import { segmentLabel, timeframeLabel } from "../../lib/format";
import { describeBuying, describeSetup } from "../../lib/intradayText";
import {
  describeAveraging,
  describeExits,
  describePortfolio,
  describeRegime,
  describeRisk,
  describeRotation,
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

function Body({ spec }: { spec: CandleStrategySpec }) {
  if (spec.mode === "visual") {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <RuleBlock title="Entry" group={describeRuleGroup(spec.entry)} />
        <RuleBlock title="Exit" group={describeRuleGroup(spec.exit)} />
      </div>
    );
  }
  if (spec.mode === "python") {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-card-title text-text-primary">Code</h3>
        <p className="text-body-sm text-text-muted">
          Python strategy: entry and exit rules live in its code.
        </p>
        <CodeEditor value={spec.code} readOnly minHeight={80} ariaLabel="Strategy code" />
      </section>
    );
  }
  const rotation = describeRotation(spec.rotation);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <RuleBlock
        title="Score"
        group={{ heading: "Stocks with the highest total are held", lines: rotation.score }}
      />
      {rotation.filter && <RuleBlock title="Only stocks where" group={rotation.filter} />}
    </div>
  );
}

export interface StrategySpecCardProps {
  spec: StrategySpec;
  version: number;
}

export function StrategySpecCard({ spec, version }: StrategySpecCardProps) {
  if (spec.mode === "intraday") {
    const items = [
      { label: "Mode", value: "Intraday" },
      { label: "Segment", value: segmentLabel[spec.segment] },
      { label: "Exchange", value: spec.exchange },
      { label: "Timeframe", value: "5m context, 1m confirmation" },
      { label: "Setup", value: describeSetup(spec.setup) },
      { label: "Buying", value: describeBuying(spec.buying) },
    ];
    return (
      <Card title={`Specification · v${version}`}>
        <DescriptionList columns={2} items={items} />
      </Card>
    );
  }
  const common = [
    { label: "Segment", value: segmentLabel[spec.segment] },
    { label: "Exchange", value: spec.exchange },
    { label: "Timeframe", value: timeframeLabel[spec.timeframe] },
    { label: "Risk", value: describeRisk(spec.risk) },
    { label: "Other exits", value: describeExits(spec.risk) },
    { label: "Market filter", value: describeRegime(spec.regime) },
  ];
  const items =
    spec.mode === "rotation"
      ? [
          { label: "Mode", value: "Rotation" },
          ...common,
          { label: "Rebalance", value: describeRotation(spec.rotation).rebalance },
          { label: "Hold", value: describeRotation(spec.rotation).hold },
        ]
      : [
          { label: "Mode", value: spec.mode === "visual" ? "Visual rules" : "Python" },
          ...common,
          { label: "Sizing", value: describeSizing(spec.sizing) },
          { label: "Cost averaging", value: describeAveraging(spec.averaging) },
          { label: "Positions", value: describePortfolio(spec.portfolio) },
        ];
  return (
    <Card title={`Specification · v${version}`}>
      <div className="flex flex-col gap-6">
        <DescriptionList columns={2} items={items} />
        <Body spec={spec} />
      </div>
    </Card>
  );
}
