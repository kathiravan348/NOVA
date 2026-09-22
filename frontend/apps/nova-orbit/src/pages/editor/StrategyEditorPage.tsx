import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router";
import { Code2 } from "lucide-react";
import { Button, EmptyState, useToast } from "@nova/ui-core";
import { useStrategy } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { BasicsFields } from "./BasicsFields";
import { EditorFormSchema, emptyForm, fromSpec, type EditorForm } from "./editorForm";
import { RuleGroupEditor } from "./RuleGroupEditor";
import { SpecPreview } from "./SpecPreview";

function VisualEditor({ defaults, cancelTo }: { defaults: EditorForm; cancelTo: string }) {
  const toast = useToast();
  const form = useForm<EditorForm>({
    resolver: zodResolver(EditorFormSchema),
    defaultValues: defaults,
    shouldFocusError: true,
  });

  const onValid = () =>
    toast.show({
      title: "Draft saved",
      description: "Demo only: nothing is stored in Stage A.",
      tone: "success",
    });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onValid)} noValidate className="flex flex-col gap-6">
        <BasicsFields />
        <div className="flex flex-col gap-6">
          <RuleGroupEditor group="entry" title="Entry rules" />
          <RuleGroupEditor group="exit" title="Exit rules" />
        </div>
        <SpecPreview />
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Save draft</Button>
          <Button asChild variant="secondary">
            <Link to={cancelTo}>Cancel</Link>
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export function NewStrategyPage() {
  return <VisualEditor defaults={emptyForm()} cancelTo="/strategies" />;
}

export function EditStrategyPage() {
  const { id = "" } = useParams();
  const query = useStrategy(id);
  return (
    <QueryState query={query} back={{ to: "/strategies", label: "Back to strategies" }}>
      {(strategy) => {
        const latest = strategy.versions.find((v) => v.version === strategy.latestVersion)!;
        if (latest.spec.mode !== "visual") {
          return (
            <EmptyState
              icon={<Code2 className="h-6 w-6" />}
              title="Python strategies use the code editor"
              description={`${strategy.name} is written in Python.`}
              action={
                <Button asChild variant="secondary">
                  <Link to={`/strategies/${strategy.id}`}>Back to strategy</Link>
                </Button>
              }
            />
          );
        }
        return (
          <VisualEditor
            defaults={fromSpec(strategy.name, strategy.description, latest.spec)}
            cancelTo={`/strategies/${strategy.id}`}
          />
        );
      }}
    </QueryState>
  );
}
