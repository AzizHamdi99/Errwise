import { z } from "zod";

/** Sent by the callback page after GitHub redirects the owner back. */
export const completeGithubInstallationSchema = z.object({
  installationId: z.string().regex(/^\d+$/, "Invalid installation id"),
  code: z.string().min(1).max(200),
  state: z.string().min(1).max(2000),
});

export const setGithubRepoSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Expected owner/repo"),
});

export type CompleteGithubInstallationInput = z.infer<
  typeof completeGithubInstallationSchema
>;
export type SetGithubRepoInput = z.infer<typeof setGithubRepoSchema>;

export interface GithubInstallUrl {
  url: string;
}

export interface GithubRepo {
  fullName: string;
  private: boolean;
}

/** What every member can see. The installation id stays on the server. */
export interface GithubConnection {
  installed: boolean;
  repo: string | null;
}

/** Returned after the connection succeeds, so the web app can go back to the project. */
export interface GithubInstallResult {
  organizationId: string;
  projectId: string;
}

export interface GithubIssueLink {
  number: number;
  url: string;
}
