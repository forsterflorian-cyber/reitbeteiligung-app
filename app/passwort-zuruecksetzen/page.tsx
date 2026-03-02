import { AuthPanel } from "@/components/blocks/auth-panel";

import { PasswordResetForm } from "@/app/passwort-zuruecksetzen/reset-password-form";

export default function PasswortZuruecksetzenPage() {
  return (
    <AuthPanel
      eyebrow="Passwort zurücksetzen"
      subtitle="Öffne den Link aus deiner E-Mail auf diesem Gerät und wähle dann ein neues Passwort."
      title="Neues Passwort festlegen"
    >
      <PasswordResetForm />
    </AuthPanel>
  );
}