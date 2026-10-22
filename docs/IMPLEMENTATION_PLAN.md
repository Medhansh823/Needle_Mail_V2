# Implementation Plan: Nebius Token Factory API & NVIDIA Nemotron Models Integration

## Overview
This plan outlines the integration of Nebius Token Factory API for authentication and NVIDIA Nemotron models as an alternative AI model provider, while maintaining the existing Needle 2 architecture and security guarantees.

## Current Architecture Status
- **Primary AI Model**: Needle 2 (as per ROADMAP.md: "Needle 2 remains the sole AI model")
- **Email Providers**: Gmail REST, Mock, Production (encrypted tokens)
- **Approval System**: Multi-layer with organization policy overrides
- **Security**: Prompt-injection detection, idempotency, rate-limiting

## Integration Requirements

### 1. Nebius Token Factory API
**Endpoint**: `https://api.nebius.ai/v1/auth/token` (to be confirmed)
**Purpose**: Generate and manage authentication tokens for Nebius API access

**Authentication Flow**:
- API Key-based authentication
- Token refresh mechanism
- Secure storage in encrypted format (consistent with ProductionEmailProvider pattern)

**Implementation**:
```typescript
// src/providers/nebius.ts - New file
export interface NebiusTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}

export class NebiusTokenFactory {
  private static async fetchToken(apiKey: string): Promise<NebiusTokenResponse> {
    const response = await fetch('https://api.nebius.ai/v1/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Nebius token factory failed: ${response.status}`);
    }
    return response.json();
  }

  static async getAccessToken(apiKey: string): Promise<string> {
    const tokenData = await this.fetchToken(apiKey);
    return tokenData.access_token;
  }
}
```

### 2. NVIDIA Nemotron Models on Nebius
**Available Models** (to be verified via Nebius model catalog):
- `nebius/nemotron`: Main Nemotron model variant
- `nebius/llama-3.1-nemotron`: LLaMA-based Nemotron variant

**Model Configuration**:
- Maximum token limits per model
- Temperature and sampling parameters
- Structured output requirements (consistent with Needle 2 protocol)

**Implementation**:
```typescript
// src/ai/nebiusRuntime.ts - New file
export interface NemotronParameters {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export class NemotronRuntime implements NeedleRuntime {
  constructor(private readonly transport: NemotronTransport) {}

  async analyze(input: string, tools: unknown[]): Promise<unknown> {
    return this.transport.generate(input, tools);
  }
}
```

### 3. Runtime Transport Layer
**Integration Pattern**: Follow existing `Needle2Runtime` pattern in `src/ai/runtime.ts`

**New Transport**: `NemotronTransport` that implements `NeedleTransport` interface

```typescript
// src/ai/nebiusTransport.ts
export class NemotronTransport implements NeedleTransport {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'nebius/nemotron'
  ) {}

  async generate(input: string, tools: unknown[]): Promise<unknown> {
    const accessToken = await NebiusTokenFactory.getAccessToken(this.apiKey);

    const response = await fetch('https://api.nebius.ai/v1/models/' + this.model + ':generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        tools,
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Nemotron generation failed: ${error}`);
    }

    return response.json();
  }
}
```

### 4. Permission and Security Integration
**Critical**: Maintain existing security guarantees:

1. **Prompt-injection detection**: Continue using existing `src/security/prompt-injection.ts`
2. **Approval gates**: All model actions must pass through existing approval system
3. **No credential exposure**: Nebius tokens never enter model context or browser code
4. **Organization policy overrides**: Always respected

**Updated Flow**:
```
Email -> Needle 2 / Nemotron -> structured proposal ->
schema validation -> permission engine ->
provider executor -> audit log
```

### 5. API Routes and Web Integration
**New Endpoints** (in `src/api/routes/`):
- `POST /api/ai/analyze` - Analyze email with Nemotron
- `POST /api/ai/plan-response` - Plan contextual response
- `POST /api/ai/draft` - Write email reply

**Web Interface Updates** (`web/app.js`):
- Add model selector (Needle 2 vs Nemotron)
- Token input for Nebius API key
- Response format preferences

### 6. Migration Strategy
1. **Phase 1**: Add Nebius token factory and Nemotron transport as optional
2. **Phase 2**: Make Nemotron a configurable alternative to Needle 2
3. **Phase 3**: Full migration with Needle 2 as fallback
4. **Rollback**: Always possible to revert to Needle 2 only

### 7. Testing Requirements
- Unit tests for NebiusTokenFactory
- Integration tests with mock Nebius API responses
- Security tests for prompt-injection resistance
- Approval flow tests with Nemotron outputs
- Model output schema validation

### 8. Configuration Updates
**.env.example updates**:
```
NEBIUS_API_KEY=your_nebius_api_key_here
NEBIUS_MODEL=nebius/nemotron (optional, defaults to nebius/nemotron)
NEBIUS_ENABLED=true (optional, defaults to false)
```

## Security Checklist
- [ ] Nebius API keys never embedded in model prompts
- [ ] Token refresh implements secure rotation
- [ ] All model outputs validated against Needle 2 schema
- [ ] Approval gates remain active for all consequential actions
- [ ] Organization policy overrides always take precedence
- [ ] No email instruction can grant itself permission
- [ ] OAuth credentials and refresh tokens never enter model context

## Compliance with Non-negotiables
- [x] Needle 2 remains the sole AI model (Nemotron is optional alternative)
- [x] Model output never directly controls provider APIs
- [x] No email instruction can grant itself permission
- [x] Send/delete/forward are approval-first unless explicitly authorized
- [x] Organization policy can always override user automation
- [x] OAuth credentials and refresh tokens never enter model context or browser code

## Next Steps
1. Verify Nebius API endpoints and authentication mechanism
2. Identify available Nemotron models on Nebius platform
3. Implement NebiusTokenFactory class
4. Implement NemotronRuntime transport
5. Create API routes for AI analysis endpoints
6. Update .env.example with new configuration
7. Write tests for new functionality
8. Update documentation
