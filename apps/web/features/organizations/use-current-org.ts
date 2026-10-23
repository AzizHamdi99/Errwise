import { useParams } from "next/navigation";
import { useOrganizations } from "./queries";

export function useCurrentOrg() {
  const { orgId } = useParams<{ orgId?: string }>();
  const { data: orgs, isPending, error, refetch } = useOrganizations();
  const org = orgs?.find((o) => o.id === orgId) ?? null;
  return { orgId, orgs, org, isPending, error, refetch };
}
