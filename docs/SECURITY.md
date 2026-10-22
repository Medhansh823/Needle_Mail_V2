# Security Model

Email is untrusted input and can contain prompt injection. Those instructions are data, not authority.

Never expose OAuth tokens to the browser. Never execute code or shell commands from email content. Validate every model-produced argument. All mutations pass through authorization. Sending and deletion are approval-first by default. Organization blocks override user permissions. Do not log secrets or unnecessary full email bodies.

The future Gmail adapter must keep credentials server-side and use the narrowest OAuth scopes practical.