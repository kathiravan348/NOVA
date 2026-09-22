import * as React from "react";
import { cn } from "../../lib/cn";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { Input } from "../Input/Input";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginFormProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small helper text under the button, e.g. how demo sign-in works. */
  hint?: React.ReactNode;
  error?: string;
  submitting?: boolean;
  onSubmit: (credentials: LoginCredentials) => void;
  className?: string;
}

export function LoginForm({
  title,
  subtitle,
  hint,
  error,
  submitting = false,
  onSubmit,
  className,
}: LoginFormProps): React.ReactElement {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({ username, password });
  };

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6" noValidate>
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title text-text-primary">{title}</h1>
          {subtitle && <p className="text-body-sm text-text-secondary">{subtitle}</p>}
        </div>
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-body-sm text-loss-text">
            {error}
          </p>
        )}
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        {hint && <p className="text-body-sm text-text-muted">{hint}</p>}
      </form>
    </Card>
  );
}
