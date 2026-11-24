"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MAIN_NAV } from "../nav";
import { SiteLink } from "./site-link";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="md:hidden"
          />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] p-6">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Site navigation</SheetDescription>
        <Brand />
        <nav aria-label="Mobile" className="mt-4">
          <ul className="space-y-1">
            {MAIN_NAV.map((link) => (
              <li key={link.href}>
                <SiteLink
                  link={link}
                  onClick={close}
                  className="block rounded-md px-2 py-2.5 text-base font-medium hover:bg-muted"
                />
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <Button
            variant="outline"
            className="h-11"
            render={<Link href="/login" onClick={close} />}
            nativeButton={false}
          >
            Login
          </Button>
          <Button
            className="h-11"
            render={<Link href="/register" onClick={close} />}
            nativeButton={false}
          >
            Get started
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
