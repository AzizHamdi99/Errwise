import { execSync } from "node:child_process";

/** The handler tests run a child process against dist/, so build it first. */
export default function setup(): void {
  execSync("yarn build", { stdio: "inherit" });
}
