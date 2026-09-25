import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { brand } from "@nova/brand";
import { DemoBanner, LoginForm, type LoginCredentials } from "@nova/ui-core";
import { getDataMode, signIn, useSession } from "@nova/services";

const product = brand.products.relay;

/** Only same-app paths are allowed as `next`, never another origin. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const real = getDataMode() === "real";

  if (session) return <Navigate to={next} replace />;

  const handleSubmit = async ({ username, password }: LoginCredentials) => {
    setSubmitting(true);
    setError(undefined);
    try {
      await signIn(username, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-ground">
      {!real && <DemoBanner />}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <LoginForm
          title={product.name}
          subtitle={product.description}
          hint={real ? undefined : "Demo mode: any username and password work."}
          identifierLabel={real ? "Email" : "Username"}
          identifierType={real ? "email" : "text"}
          error={error}
          submitting={submitting}
          onSubmit={(credentials) => void handleSubmit(credentials)}
        />
      </main>
    </div>
  );
}
