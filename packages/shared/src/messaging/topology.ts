import { ISSUE_CREATED, issueCreatedSchema } from "./issue-created";

export const MESSAGES_EXCHANGE = "errwise.events";

/** Routing key -> schema. Add one line per new message type. */
export const messageSchemas = {
  [ISSUE_CREATED]: issueCreatedSchema,
} as const;

export type MessageType = keyof typeof messageSchemas;

/** One queue per consumer. A consumer lists the messages it reacts to. */
export const QUEUES = {
  notificationsEmail: {
    name: "notifications.email",
    bindings: [ISSUE_CREATED],
  },
} as const;
