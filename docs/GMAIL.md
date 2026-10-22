# Gmail Integration

The provider uses a server-side OAuth access token and Gmail REST API. Do not place the token in browser JavaScript or in a prompt.

For an initial MVP, use Gmail read/modify/draft/send capabilities only as required by enabled features. Deletion and send are high-risk and should remain approval-first unless the user explicitly enables automatic execution.

Production OAuth should persist encrypted refresh tokens server-side, rotate credentials safely, validate OAuth state/PKCE, and support disconnect/revocation.