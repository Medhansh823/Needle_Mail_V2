import type { Email } from "../domain/types.ts";
export interface EmailProvider {
    listInbox(accountId: string): Promise<Email[]>; getThread(threadId: string): Promise<Email[]>;
    applyLabel(emailId: string, label: string): Promise<void>; removeLabel(emailId: string, label: string): Promise<void>;
    archive(emailId: string): Promise<void>; restore(emailId: string): Promise<void>;
    markRead(emailId: string): Promise<void>; markUnread(emailId: string): Promise<void>;
    star(emailId: string): Promise<void>; unstar(emailId: string): Promise<void>; move(emailId: string, destination: string): Promise<void>;
    delete(emailId: string): Promise<void>; createDraft(to: string[], subject: string, body: string, threadId?: string): Promise<string>;
    sendReply(emailId: string, body: string): Promise<string>; sendForward(emailId: string, to: string[], body: string): Promise<string>;
    createTask(threadId: string, title: string): Promise<void>; createReminder(threadId: string, title: string): Promise<void>; bulkAction(operations: string, threadId: string): Promise<void>;
}
