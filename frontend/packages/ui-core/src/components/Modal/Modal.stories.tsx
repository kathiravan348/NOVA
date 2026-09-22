import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { Modal } from "./Modal";

const meta: Meta<typeof Modal> = {
  title: "Core/Modal",
  component: Modal,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  render: () => (
    <Modal
      trigger={<Button variant="primary">Open Modal</Button>}
      title="Confirm Order"
      description="Review order execution parameters before submitting."
      footer={
        <>
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary">Submit Order</Button>
        </>
      }
    >
      <p className="text-body text-text-secondary">
        Order details: BUY 100 shares of INFY at ₹1,550.00 Limit price.
      </p>
    </Modal>
  ),
};

export const WithoutDescription: Story = {
  render: () => (
    <Modal
      trigger={<Button variant="secondary">Quick Modal</Button>}
      title="Quick Notice"
      footer={<Button variant="primary">Understood</Button>}
    >
      <p className="text-body text-text-secondary">
        Your broker token will expire in 30 minutes. Please re-authenticate.
      </p>
    </Modal>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Modal
      trigger={<Button variant="secondary">View Terms</Button>}
      title="Terms and Conditions"
      description="Please scroll through and read the full agreement."
      footer={
        <>
          <Button variant="secondary">Decline</Button>
          <Button variant="primary">Accept Agreement</Button>
        </>
      }
    >
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <h4 className="font-semibold text-text-primary mb-1">Clause {i + 1}</h4>
            <p className="text-body text-text-secondary">
              This system executes automated algorithmic strategies strictly under user discretion
              and supervised risk constraints.
            </p>
          </div>
        ))}
      </div>
    </Modal>
  ),
};
