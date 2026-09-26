import { Modal, useToast } from "@nova/ui-core";
import { useFinishKiteLogin } from "@nova/services";
import { PassphraseForm } from "./PassphraseForm";

export interface FinishLoginModalProps {
  accountId: string;
  accountLabel: string;
  open: boolean;
  /** Called when the dialog closes, finished or not; the page then clears `?kite=finish`. */
  onClose: () => void;
}

/** The second half of the daily login (D55): the passphrase opens the saved Kite secret once. */
export function FinishLoginModal({
  accountId,
  accountLabel,
  open,
  onClose,
}: FinishLoginModalProps) {
  const toast = useToast();
  const finish = useFinishKiteLogin(accountId);

  const submit = async (passphrase: string) => {
    try {
      await finish.mutateAsync({ passphrase });
      toast.show({
        title: "Kite connected",
        description: "Today's session is active.",
        tone: "success",
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("log in to Kite again") || message.startsWith("Kite login failed")) {
        toast.show({ title: "Kite login failed", description: message, tone: "danger" });
        onClose();
        return;
      }
      throw err;
    } finally {
      // Drops the passphrase from the mutation state (the hook keeps no cache entry, gcTime 0).
      finish.reset();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Finish Kite login"
      description={`You logged in at Zerodha for ${accountLabel}. Enter your passphrase to finish. It unlocks the saved API secret for this login only.`}
    >
      {open && <PassphraseForm submitLabel="Finish login" onSubmit={submit} onCancel={onClose} />}
    </Modal>
  );
}
