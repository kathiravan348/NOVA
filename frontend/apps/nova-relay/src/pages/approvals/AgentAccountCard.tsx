import { useState } from "react";
import { AgentAccountCreateSchema, AgentPasswordUpdateSchema } from "@nova/contracts";
import {
  useAgentAccount,
  useCreateAgentAccount,
  useUpdateAgentAccess,
  useUpdateAgentPassword,
} from "@nova/services";
import { Button, Card, Input, Skeleton, Switch } from "@nova/ui-core";
import { QueryError } from "../../components/QueryState";
import { formatIstShort } from "../../lib/format";

export function AgentAccountCard() {
  const query = useAgentAccount();
  const create = useCreateAgentAccount();
  const passwordUpdate = useUpdateAgentPassword();
  const access = useUpdateAgentAccess();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || passwordUpdate.isPending || access.isPending;
  const clearPasswords = () => {
    setPassword("");
    setRepeat("");
    create.reset();
    passwordUpdate.reset();
  };
  const submit = async () => {
    setError(null);
    const parsed = query.data
      ? AgentPasswordUpdateSchema.safeParse({ password })
      : AgentAccountCreateSchema.safeParse({ name: name.trim(), email: email.trim(), password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    if (password !== repeat) {
      setError("Passwords must match.");
      return;
    }
    try {
      if (query.data) await passwordUpdate.mutateAsync({ password });
      else await create.mutateAsync({ name: name.trim(), email: email.trim(), password });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the agent account.");
    } finally {
      clearPasswords();
    }
  };
  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <Card title="Agent account">
      <div className="flex flex-col gap-4">
        {query.data && (
          <>
            <p className="break-all text-body">
              {query.data.name} · {query.data.email}
            </p>
            <p className="text-body-sm text-text-secondary">
              Last sign-in:{" "}
              {query.data.lastLoginAt ? formatIstShort(query.data.lastLoginAt) : "Never"}
            </p>
            <Switch
              label="Agent access"
              checked={query.data.enabled}
              disabled={busy}
              onCheckedChange={(enabled) => {
                setError(null);
                void access
                  .mutateAsync({ enabled })
                  .catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : "Could not change access."),
                  );
              }}
            />
          </>
        )}
        {!editing ? (
          <Button
            className="self-start"
            disabled={busy}
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
          >
            {query.data ? "Set new password" : "Create agent"}
          </Button>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {!query.data && (
              <>
                <Input
                  label="Name"
                  value={name}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </>
            )}
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              description="At least 12 characters."
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              disabled={busy}
              onChange={(event) => setRepeat(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy}>
                {query.data ? "Save password" : "Create agent"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  clearPasswords();
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
        {error && (
          <p role="alert" className="text-body-sm text-loss">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
