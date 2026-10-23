"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  label?: string;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "children" | "value">;

export function CopyButton({
  value,
  label = "Copy",
  variant = "outline",
  ...props
}: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // clipboard not available: do nothing
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  const Icon = copied ? Check : Copy;
  return (
    <Button type="button" variant={variant} onClick={copy} {...props}>
      <Icon aria-hidden />
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}
