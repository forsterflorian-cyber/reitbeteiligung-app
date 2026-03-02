import { logoutAction } from "@/app/actions";

import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";

type LogoutFormProps = {
  className?: string;
};

export function LogoutForm({ className }: LogoutFormProps) {
  return (
    <form action={logoutAction}>
      <SubmitButton className={buttonVariants("secondary", className)} idleLabel="Abmelden" pendingLabel="Wird abgemeldet..." />
    </form>
  );
}
