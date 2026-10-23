import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r bg-card/30 lg:sticky lg:top-0 lg:block lg:h-svh">
        <SidebarContent />
      </aside>
      <div className="flex min-w-0 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
