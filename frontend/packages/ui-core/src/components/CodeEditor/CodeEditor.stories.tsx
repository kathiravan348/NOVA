import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeEditor } from "./CodeEditor";

const sample = `# Buy when price closes above its 20-bar average
def on_bar(ctx):
    signals = []
    if ctx.close > ctx.sma(20) and ctx.position == 0:
        signals.append(ctx.buy(qty=10))  # enter long
    return signals
`;

function EditableDemo() {
  const [code, setCode] = React.useState(sample);
  return (
    <div className="flex flex-col gap-2">
      <CodeEditor value={code} onChange={setCode} ariaLabel="Strategy code" />
      <p className="text-body-sm text-text-muted">{code.split("\n").length} lines</p>
    </div>
  );
}

const meta: Meta<typeof CodeEditor> = {
  title: "Core/CodeEditor",
  component: CodeEditor,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof CodeEditor>;

export const Editable: Story = {
  render: () => <EditableDemo />,
};

export const ReadOnly: Story = {
  args: { value: sample, readOnly: true, ariaLabel: "Strategy code", minHeight: 120 },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
  render: () => <EditableDemo />,
};
