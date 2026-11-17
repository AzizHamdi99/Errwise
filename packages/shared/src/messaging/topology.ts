import { ISSUE_CREATED, issueCreatedSchema } from "./issue-created";
import type { z } from "zod";
export const MESSAGES_EXCHANGE = "errwise.events";
import { ISSUE_REGRESSED, issueRegressedSchema } from "./issue-regressed";
/** Routing key -> schema. Add one line per new message type. */
export const messageSchemas = {
  [ISSUE_CREATED]: issueCreatedSchema,
  [ISSUE_REGRESSED]: issueRegressedSchema,
} as const;

export type MessageType = keyof typeof messageSchemas;
export type Message<T extends MessageType = MessageType> = z.infer<
  (typeof messageSchemas)[T]
>;

/** One queue per consumer. A consumer lists the messages it reacts to. */
export const QUEUES = {
  notificationsEmail: {
    name: "notifications.email",
    bindings: [ISSUE_CREATED, ISSUE_REGRESSED],
  },
} as const;
