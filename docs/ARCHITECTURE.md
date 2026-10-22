# NeedleMail Architecture

Email -> Needle 2 -> structured proposal -> schema validation -> permission engine -> provider executor -> audit log.

Needle never receives credentials and never directly mutates Gmail. Email content is untrusted data. The permission engine is the only authority for consequential actions.

Needle handles classification, priority, extraction, command parsing and contextual response planning. Normal software handles OAuth, provider APIs, persistence, search, permissions, response composition and billing.

Permission precedence: organization blocks -> organization approval requirements -> user rules -> default approval.