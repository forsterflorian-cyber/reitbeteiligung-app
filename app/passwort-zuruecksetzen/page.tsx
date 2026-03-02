import { PasswordResetForm } from "@/app/passwort-zuruecksetzen/reset-password-form";

export default function PasswortZuruecksetzenPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <PasswordResetForm />
    </div>
  );
}
