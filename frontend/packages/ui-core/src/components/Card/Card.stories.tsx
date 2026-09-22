import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Core/Card",
  component: Card,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <p className="text-body text-text-primary">
        This is a simple card container with basic body content.
      </p>
    </Card>
  ),
};

export const WithHeaderAndFooter: Story = {
  render: () => (
    <Card
      title="System Status"
      actions={
        <Button size="sm" variant="secondary">
          Refresh
        </Button>
      }
      footer={
        <div className="flex justify-between items-center text-body-sm text-text-muted">
          <span>Last updated: 2 mins ago</span>
          <Button size="sm" variant="primary">
            View Details
          </Button>
        </div>
      }
      className="max-w-lg"
    >
      <p className="text-body text-text-secondary">
        All market feeds and broker sessions are operating normally.
      </p>
    </Card>
  ),
};
