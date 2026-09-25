import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router";
import { Button, useToast } from "@nova/ui-core";
import type { Strategy } from "@nova/contracts";
import {
  getDataMode,
  useCreateStrategy,
  useSaveStrategyVersion,
  useStrategy,
  useUpdateStrategy,
} from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { BasicsFields } from "./BasicsFields";
import { EditorFormSchema, emptyForm, fromSpec, toSpec, type EditorForm } from "./editorForm";
import { ModeSwitch } from "./ModeSwitch";
import { PythonFields } from "./PythonFields";
import { RuleGroupEditor } from "./RuleGroupEditor";
import { SpecPreview } from "./SpecPreview";

function StrategyEditor({
  defaults,
  cancelTo,
  existing,
}: {
  defaults: EditorForm;
  cancelTo: string;
  existing?: Strategy;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const create = useCreateStrategy();
  const saveVersion = useSaveStrategyVersion();
  const update = useUpdateStrategy();
  const form = useForm<EditorForm>({
    resolver: zodResolver(EditorFormSchema),
    defaultValues: defaults,
    shouldFocusError: true,
  });
  const mode = form.watch("mode");

  /** New strategy → version 1; existing → a new immutable version (+ rename if needed) (D43). */
  const save = async (values: EditorForm): Promise<Strategy> => {
    const spec = toSpec(values);
    const name = values.name.trim();
    const description = values.description.trim();
    if (!existing) return create.mutateAsync({ name, description, spec });
    let saved = await saveVersion.mutateAsync({
      strategyId: existing.id,
      note: "Saved from the editor",
      spec,
    });
    if (name !== existing.name || description !== existing.description) {
      saved = await update.mutateAsync({ strategyId: existing.id, name, description });
    }
    return saved;
  };

  const onValid = async (values: EditorForm) => {
    try {
      const saved = await save(values);
      if (getDataMode() === "real") {
        toast.show({
          title: "Strategy saved",
          description: `Version ${saved.latestVersion}`,
          tone: "success",
        });
        navigate(`/strategies/${saved.id}`);
        return;
      }
      toast.show({
        title: "Draft saved",
        description: "Demo only: mock mode stores nothing.",
        tone: "success",
      });
    } catch (err) {
      toast.show({
        title: "Could not save the strategy",
        description: err instanceof Error ? err.message : undefined,
        tone: "danger",
      });
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onValid)} noValidate className="flex flex-col gap-6">
        <ModeSwitch />
        <BasicsFields />
        {mode === "visual" ? (
          <div className="flex flex-col gap-6">
            <RuleGroupEditor group="entry" title="Entry rules" />
            <RuleGroupEditor group="exit" title="Exit rules" />
          </div>
        ) : (
          <PythonFields />
        )}
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
  return <StrategyEditor defaults={emptyForm()} cancelTo="/strategies" />;
}

export function EditStrategyPage() {
  const { id = "" } = useParams();
  const query = useStrategy(id);
  return (
    <QueryState query={query} back={{ to: "/strategies", label: "Back to strategies" }}>
      {(strategy) => {
        const latest = strategy.versions.find((v) => v.version === strategy.latestVersion)!;
        return (
          <StrategyEditor
            defaults={fromSpec(strategy.name, strategy.description, latest.spec)}
            cancelTo={`/strategies/${strategy.id}`}
            existing={strategy}
          />
        );
      }}
    </QueryState>
  );
}
