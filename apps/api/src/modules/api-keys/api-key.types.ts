/** What a validated key gives to the ingestion code. */
export interface ApiKeyContext {
  apiKeyId: string;
  projectId: string;
  organizationId: string;
}
