import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "./useToast";

const meta: Meta<typeof ToastProvider> = {
  title: "Core/Toast",
  component: ToastProvider,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ToastProvider>;

function ToastPlayground(): React.ReactElement {
  const toast = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({
            title: "Information",
            description: "Market session opens at 09:15 IST.",
            tone: "neutral",
          })
        }
      >
        Neutral Toast
      </Button>

      <Button
        variant="primary"
        onClick={() =>
          toast.show({
            title: "Order Executed",
            description: "BUY 50 NIFTY 24500 CE completed successfully.",
            tone: "success",
          })
        }
      >
        Success Toast
      </Button>

      <Button
        variant="danger"
        onClick={() =>
          toast.show({
            title: "Execution Rejected",
            description: "Insufficient margin to place requested order.",
            tone: "danger",
          })
        }
      >
        Danger Toast
      </Button>
    </div>
  );
}

export const Playground: Story = {
  render: () => (
    <ToastProvider>
      <ToastPlayground />
    </ToastProvider>
  ),
};
