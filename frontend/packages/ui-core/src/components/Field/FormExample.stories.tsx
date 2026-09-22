import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../Button/Button";
import { Input } from "../Input/Input";
import { Select } from "../Select/Select";
import { Checkbox } from "../Checkbox/Checkbox";
import { Switch } from "../Switch/Switch";
import { DateTimePicker } from "../DateTimePicker/DateTimePicker";
import { Field } from "./Field";

const formSchema = z.object({
  strategyName: z.string().min(1, "Strategy name is required"),
  universe: z.string().min(1, "Universe is required"),
  customNote: z.string().min(1, "Custom note is required"),
  agreed: z.literal(true, { message: "Must accept terms" }),
  autoSquareOff: z.literal(true, {
    message: "Auto-square off must be enabled",
  }),
  startTime: z.string().min(1, "Start time is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function FormExample() {
  const [submittedData, setSubmittedData] = React.useState<FormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      strategyName: "",
      universe: "",
      customNote: "",
      agreed: false as unknown as true,
      autoSquareOff: false as unknown as true,
      startTime: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    setSubmittedData(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 max-w-md p-6 bg-bg-surface border border-border-default rounded-lg"
      noValidate
    >
      <Input
        label="Strategy Name"
        placeholder="Enter strategy name"
        error={errors.strategyName?.message}
        {...register("strategyName")}
      />

      <Select
        label="Index Universe"
        placeholder="Select index"
        options={[
          { value: "nifty50", label: "NIFTY 50" },
          { value: "niftybank", label: "NIFTY Bank" },
        ]}
        error={errors.universe?.message}
        {...register("universe")}
      />

      <Field label="Custom Execution Note" htmlFor="custom-note" error={errors.customNote?.message}>
        <textarea
          id="custom-note"
          rows={3}
          className="w-full rounded-md border border-border-strong bg-bg-surface p-2.5 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
          {...register("customNote")}
        />
      </Field>

      <Controller
        name="agreed"
        control={control}
        render={({ field }) => (
          <Checkbox
            label="I accept algo execution risk disclaimer"
            checked={field.value}
            onCheckedChange={field.onChange}
            error={errors.agreed?.message}
          />
        )}
      />

      <Controller
        name="autoSquareOff"
        control={control}
        render={({ field }) => (
          <Switch
            label="Mandatory Auto-Square Off"
            checked={field.value}
            onCheckedChange={field.onChange}
            error={errors.autoSquareOff?.message}
          />
        )}
      />

      <Controller
        name="startTime"
        control={control}
        render={({ field }) => (
          <DateTimePicker
            label="Execution Start Time (IST)"
            value={field.value}
            onChange={(val) => field.onChange(val ?? "")}
            error={errors.startTime?.message}
          />
        )}
      />

      <Button type="submit">Submit Strategy</Button>

      {submittedData && (
        <p className="text-body-sm text-profit" data-testid="success-message">
          Form submitted successfully!
        </p>
      )}
    </form>
  );
}

const meta: Meta<typeof FormExample> = {
  title: "Core/Forms/Example",
  component: FormExample,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof FormExample>;

export const Example: Story = {
  render: () => <FormExample />,
};
