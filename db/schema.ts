import { pgTable, text, uuid, timestamp, serial, json, boolean } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emails = pgTable("emails", {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: text("thread_id"),
    accountId: uuid("account_id"),
    sender: text("sender").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    receivedAt: timestamp("received_at"),
    labels: json("labels").default("[]"),
    category: text("category"),
    priority: text("priority"),
});

export const emailAccounts = pgTable("email_accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    scopes: json("scopes").default("[]"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const permissionRules = pgTable("permission_rules", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    mode: text("mode").notNull(),
    minConfidence: text("min_confidence").default("0.000"),
    allowedCategories: json("allowed_categories").default("[]"),
    blockedCategories: json("blocked_categories").default("[]"),
    allowedSenders: json("allowed_senders").default("[]"),
    blockedSenders: json("blocked_senders").default("[]"),
    maxBulkSize: serial("max_bulk_size"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const automationRules = pgTable("automation_rules", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    conditions: json("conditions").default("[]"),
    actions: json("actions").default("[]"),
    permissionMode: text("permission_mode").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const approvalRequests = pgTable("approval_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    proposal: json("proposal").notNull(),
    risk: text("risk").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    decidedAt: timestamp("decided_at"),
    decidedBy: uuid("decided_by").references(() => users.id),
});

export const auditEvents = pgTable("audit_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => emailAccounts.id),
    emailId: text("email_id"),
    threadId: text("thread_id"),
    action: text("action").notNull(),
    outcome: text("outcome").notNull(),
    risk: text("risk").notNull(),
    reason: text("reason").notNull(),
    confidence: text("confidence").default("0.000"),
    metadata: json("metadata"),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});

export const organizationPolicies = pgTable("organization_policies", {
    organizationId: uuid("organization_id").primaryKey().references(() => organizations.id, { onDelete: "cascade" }),
    blockedActions: json("blocked_actions").default("[]"),
    blockedCategories: json("blocked_categories").default("[]"),
    requireApprovalFor: json("require_approval_for").default("[]"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const threads = pgTable("threads", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    subject: text("subject"),
    rootMessageId: uuid("root_message_id").references(() => emailAccounts.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emailAccountId: uuid("email_account_id").references(() => emailAccounts.id),
    messageId: text("message_id"),
    subject: text("subject"),
    body: text("body"),
    direction: text("direction").notNull(),
    status: text("status").notNull(),
    receivedAt: timestamp("received_at"),
    sentAt: timestamp("sent_at"),
    openedAt: timestamp("opened_at"),
    flags: json("flags").default("[]"),
    headers: json("headers"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const idempotencyKeys = pgTable("idempotency_keys", {
    key: text("key").primaryKey(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
});

export type Schema = typeof organizations & typeof users & typeof emails & typeof emailAccounts & typeof permissionRules & typeof automationRules & typeof approvalRequests & typeof auditEvents & typeof organizationPolicies & typeof threads & typeof messages & typeof idempotencyKeys;
