# Security Task: M-001 - Missing Rate Limiting on Token Generation

## Status: 🟡 PENDING
**Priority**: MEDIUM  
**Severity**: MEDIUM  
**Estimated Hours**: 3-4  
**Created**: 2026-02-11  
**From**: Security Audit #001

---

## Issue Description

No rate limiting on token generation endpoints, allowing potential DoS attacks through:
- Repeated token generation requests
- Expensive RSA crypto operations
- Resource exhaustion

**Affected Files**:
- `src/token-generation.ts`
- `src/auth.ts` (createCustomToken)

## Security Impact

- **Severity**: MEDIUM
- **Attack Vector**: Resource exhaustion via repeated token generation
- **Potential Impact**:
  - CPU exhaustion from RSA operations
  - Memory exhaustion from token caching
  - Service degradation or downtime

## Remediation

### Implementation Options

**Option 1: Application-Level Rate Limiter (Recommended)**

```typescript
// src/utils/rate-limiter.ts
export class TokenRateLimiter {
  private attempts = new Map<string, number[]>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  
  constructor(maxAttempts = 10, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }
  
  checkLimit(identifier: string): void {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Filter to recent attempts within window
    const recentAttempts = attempts.filter(t => now - t < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      throw new Error(`Rate limit exceeded. Max ${this.maxAttempts} requests per ${this.windowMs}ms`);
    }
    
    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);
    
    // Cleanup old entries periodically
    if (this.attempts.size > 10000) {
      this.cleanup();
    }
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      const recent = attempts.filter(t => now - t < this.windowMs);
      if (recent.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recent);
      }
    }
  }
  
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}
```

**Option 2: Documentation-Only Approach**

Document that rate limiting should be implemented at the infrastructure level (API Gateway, Load Balancer, etc.)

### Recommended Implementation

1. **Add rate limiter utility**
2. **Make it optional** (don't break existing usage)
3. **Document best practices**
4. **Provide examples**

```typescript
// src/token-generation.ts
import { TokenRateLimiter } from './utils/rate-limiter';

let rateLimiter: TokenRateLimiter | null = null;

export function enableTokenRateLimiting(maxAttempts = 10, windowMs = 60000): void {
  rateLimiter = new TokenRateLimiter(maxAttempts, windowMs);
}

export function disableTokenRateLimiting(): void {
  rateLimiter = null;
}

export async function getAdminAccessToken(identifier?: string): Promise<string> {
  // Check rate limit if enabled
  if (rateLimiter && identifier) {
    rateLimiter.checkLimit(identifier);
  }
  
  // ... existing implementation
}
```

## Files to Create/Modify

- `src/utils/rate-limiter.ts` - New rate limiter utility
- `src/utils/rate-limiter.spec.ts` - Unit tests
- `src/token-generation.ts` - Add optional rate limiting
- `src/auth.ts` - Add optional rate limiting to createCustomToken
- `README.md` - Document rate limiting best practices

## Testing Requirements

- [ ] Unit tests for rate limiter
- [ ] Test rate limit enforcement
- [ ] Test rate limit reset
- [ ] Test cleanup mechanism
- [ ] Test with concurrent requests

## Documentation Updates

Add to README.md:
```markdown
### Rate Limiting (Recommended)

To prevent abuse, implement rate limiting on token generation:

#### Option 1: Application-Level (Built-in)
\`\`\`typescript
import { enableTokenRateLimiting } from '@prmichaelsen/firebase-admin-sdk-v8';

// Enable rate limiting: 10 requests per minute per identifier
enableTokenRateLimiting(10, 60000);

// Now token generation will be rate limited
const token = await getAdminAccessToken('user-123');
\`\`\`

#### Option 2: Infrastructure-Level (Recommended for Production)
- Use API Gateway rate limiting
- Use Load Balancer rate limiting
- Use Cloudflare rate limiting
- Use Redis-based rate limiting

#### Option 3: Custom Implementation
\`\`\`typescript
// Example with Redis
import Redis from 'ioredis';
const redis = new Redis();

async function checkRateLimit(userId: string): Promise<void> {
  const key = \`rate-limit:token:\${userId}\`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60); // 60 seconds
  }
  
  if (count > 10) {
    throw new Error('Rate limit exceeded');
  }
}
\`\`\`
```

## References

- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- Security Audit #001: M-001

## Acceptance Criteria

- [ ] Rate limiter utility implemented
- [ ] Optional integration in token generation
- [ ] All test cases pass
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Backward compatible (rate limiting is opt-in)
