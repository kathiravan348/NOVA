import { Modal, useToast } from "@nova/ui-core";
import { useCheckKitePassphrase } from "@nova/services";
import { PassphraseForm } from "./PassphraseForm";

export interface PassphraseCheckModalProps {
  accountId: string;
  open: boolean;
  onClose: () => void;
}

/** Tests the passphrase without logging in, e.g. before the market opens (D55). */
export function PassphraseCheckModal({ accountId, open, onClose }: PassphraseCheckModalProps) {
  const toast = useToast();
  const check = useCheckKitePassphrase(accountId);

  const submit = async (passphrase: string) => {
    try {
      await check.mutateAsync({ passphrase });
      toast.show({ title: "Passphrase is correct", tone: "success" });
      onClose();
    } finally {
      check.reset();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Test passphrase"
      description="Checks that your passphrase unlocks the saved API secret. Nothing is changed."
    >
      {open && (
        <PassphraseForm submitLabel="Test passphrase" onSubmit={submit} onCancel={onClose} />
      )}
    </Modal>
  );
}
