# NeedleMail Product Contract

## Inbox intelligence
- summarize threads and individual messages
- classify email by business category
- assign urgent/high/normal/low/no-action priority with reasons
- detect deadlines and requested actions
- extract people, companies, order/invoice references and other structured entities
- identify messages requiring a response
- surface unread/high-priority work first
- detect likely newsletters, automated mail and low-value notifications

## Actions
- labels and label removal
- archive
- read/unread
- star/unstar
- move
- draft reply
- send reply
- forward
- delete/restore where provider supports it
- bulk operations
- tasks/reminders through future integrations

## Contextual responses
Needle receives the relevant thread context and produces a structured response plan. The application must preserve factual claims from the thread and must not invent prices, dates, commitments, attachments or actions. By default, replies are drafted first. Auto-send requires an explicit permission rule and can be disabled globally.

## Permission UX
Every action has ASK, AUTO and DENY. Users can set rules globally, by sender, domain, category, confidence threshold and action. High-risk actions have stronger defaults. A user can revoke AUTO permission at any time. Organizations can impose stronger blocks/approval requirements.

## Auditability
Every proposal, approval, denial and execution is recorded with actor, timestamp, action, risk, confidence and reason. Sensitive message content is not copied into audit logs by default.
