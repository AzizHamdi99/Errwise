import { Brand } from "@/components/shared/brand";
import { AuthShowcase } from "@/features/auth/components/auth-showcase";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[55fr_45fr]">
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Brand className="mb-12" />
          {children}
        </div>
      </section>
      <AuthShowcase />
    </main>
  );
}
