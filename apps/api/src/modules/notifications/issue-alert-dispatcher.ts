export interface NewIssueAlert {
  projectId: string;
  issueId: string;
  environment: string;
}

/** How "a new issue appeared" becomes an alert. Ingestion only knows this class. */
export abstract class IssueAlertDispatcher {
  /** Never throws: an alert problem must not break ingestion. */
  abstract dispatch(alerts: NewIssueAlert[]): Promise<void>;
}
