# Database diagram: AI and MCP

Generated from `prisma/schema.prisma` by `pnpm docs:erd`. Do not edit by hand. The assistants' saved chats and costs, live progress of queued answers, and AI apps connecting to a host's data:
personal API keys, OAuth (apps, consents, tokens, signing keys) and the log of every tool call. Boxes with no
columns (`User`, `Business`, …) are platform tables from [erd-platform.md](erd-platform.md), drawn only to show
where AI connects.

Not drawn here: the job queues. pg-boss keeps them in its own `pgboss` schema in the same database (jobs, queues,
schedules), creates and upgrades it itself, and nothing reads it through Prisma. See
[Queues and workers](architecture.md#queues-and-workers). Rate-limit counters are not in the database either: they
live in Redis, where each window expires by itself.

Only the keys, statuses, kinds and a few telling columns are shown; "Every column" below has the full tables. The
whole database in one diagram: [erd.md](erd.md).

```mermaid
erDiagram
  AiChat {
    String id PK
    String userId FK
    String businessId FK
  }
  AiChatMessage {
    String id PK
    String chatId FK
  }
  ApiKey {
    String id PK
    String businessId FK
    String membershipId FK
    String createdById FK
    String hash UK
  }
  McpAuditLog {
    String id PK
    String businessId FK
  }
  JobProgress {
    String jobId PK
  }
  AiUsage {
    String id PK
    String surface
    BigInt costMicroUsd
  }
  Jwks {
    String id PK
  }
  OauthClient {
    String id PK
    String clientId UK
    String userId FK
  }
  OauthResource {
    String id PK
    String identifier UK
  }
  OauthClientResource {
    String id PK
    String clientId FK
    String resourceId FK
  }
  OauthRefreshToken {
    String id PK
    String token UK
    String clientId FK
    String sessionId FK
    String userId FK
  }
  OauthAccessToken {
    String id PK
    String token UK
    String clientId FK
    String sessionId FK
    String userId FK
    String refreshId FK
    DateTime expiresAt
    String_list scopes
  }
  OauthConsent {
    String id PK
    String clientId FK
    String userId FK
    String referenceId
    String_list scopes
  }
  OauthClientAssertion {
    String id PK
  }
  User ||--o{ AiChat : "user"
  Business |o--o{ AiChat : "business"
  AiChat ||--o{ AiChatMessage : "chat"
  Business ||--o{ ApiKey : "business"
  Membership ||--o{ ApiKey : "membership"
  User ||--o{ ApiKey : "createdBy"
  Business ||--o{ McpAuditLog : "business"
  User |o--o{ OauthClient : "user"
  OauthClient ||--o{ OauthClientResource : "client"
  OauthResource ||--o{ OauthClientResource : "resource"
  OauthClient ||--o{ OauthRefreshToken : "client"
  Session |o--o{ OauthRefreshToken : "session"
  User ||--o{ OauthRefreshToken : "user"
  OauthClient ||--o{ OauthAccessToken : "client"
  Session |o--o{ OauthAccessToken : "session"
  User |o--o{ OauthAccessToken : "user"
  OauthRefreshToken |o--o{ OauthAccessToken : "refresh"
  OauthClient ||--o{ OauthConsent : "client"
  User |o--o{ OauthConsent : "user"
```

<details>
<summary>Every column</summary>

```mermaid
erDiagram
  AiChat {
    String id PK
    String userId FK
    String businessId FK
    String surface
    String title
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  AiChatMessage {
    String id PK
    String chatId FK
    String role
    String content
    Json data
    Boolean isDeleted
    DateTime createdAt
  }
  ApiKey {
    String id PK
    String businessId FK
    String membershipId FK
    String createdById FK
    String name
    String prefix
    String hash UK
    Boolean canWrite
    DateTime lastUsedAt
    DateTime expiresAt
    DateTime revokedAt
    Boolean isDeleted
    DateTime createdAt
  }
  McpAuditLog {
    String id PK
    String businessId FK
    String apiKeyId
    String userId
    String channel
    String tool
    String outcome
    Int latencyMs
    Boolean isDeleted
    DateTime createdAt
  }
  JobProgress {
    String jobId PK
    String step
    String text
    DateTime updatedAt
  }
  AiUsage {
    String id PK
    String surface
    String businessId
    Int promptTokens
    Int completionTokens
    BigInt costMicroUsd
    Boolean isDeleted
    DateTime createdAt
  }
  Jwks {
    String id PK
    String publicKey
    String privateKey
    DateTime createdAt
    DateTime expiresAt
    String alg
    String crv
  }
  OauthClient {
    String id PK
    String clientId UK
    String clientSecret
    String clientDiscoveryId
    Boolean disabled
    Boolean skipConsent
    Boolean enableEndSession
    String subjectType
    String_list scopes
    String_list clientCredentialsScopes
    String userId FK
    DateTime createdAt
    DateTime updatedAt
    String name
    String uri
    String icon
    String_list contacts
    String tos
    String policy
    String softwareId
    String softwareVersion
    String softwareStatement
    String_list redirectUris
    String_list postLogoutRedirectUris
    String backchannelLogoutUri
    Boolean backchannelLogoutSessionRequired
    String tokenEndpointAuthMethod
    String applicationType
    String jwks
    String jwksUri
    String_list grantTypes
    String_list responseTypes
    Boolean requirePKCE
    Boolean dpopBoundAccessTokens
    String referenceId
    Json metadata
  }
  OauthResource {
    String id PK
    String identifier UK
    String name
    Int accessTokenTtl
    Int refreshTokenTtl
    String signingAlgorithm
    String signingKeyId
    String_list allowedScopes
    Json customClaims
    Boolean dpopBoundAccessTokensRequired
    Boolean disabled
    DateTime createdAt
    DateTime updatedAt
    Int policyVersion
    Json metadata
  }
  OauthClientResource {
    String id PK
    String clientId FK
    String resourceId FK
    Json metadata
    DateTime createdAt
  }
  OauthRefreshToken {
    String id PK
    String token UK
    String clientId FK
    String sessionId FK
    String userId FK
    String referenceId
    String authorizationCodeId
    String_list resources
    String_list requestedUserInfoClaims
    DateTime expiresAt
    DateTime createdAt
    DateTime revoked
    DateTime rotatedAt
    String rotationReplayResponse
    DateTime rotationReplayExpiresAt
    DateTime authTime
    Json confirmation
    String_list scopes
  }
  OauthAccessToken {
    String id PK
    String token UK
    String clientId FK
    String sessionId FK
    String userId FK
    String referenceId
    String authorizationCodeId
    String_list resources
    String_list requestedUserInfoClaims
    String refreshId FK
    DateTime expiresAt
    DateTime createdAt
    DateTime revoked
    Json confirmation
    String_list scopes
  }
  OauthConsent {
    String id PK
    String clientId FK
    String userId FK
    String referenceId
    String_list resources
    String_list requestedUserInfoClaims
    String_list scopes
    DateTime createdAt
    DateTime updatedAt
  }
  OauthClientAssertion {
    String id PK
    DateTime expiresAt
  }
  User ||--o{ AiChat : "user"
  Business |o--o{ AiChat : "business"
  AiChat ||--o{ AiChatMessage : "chat"
  Business ||--o{ ApiKey : "business"
  Membership ||--o{ ApiKey : "membership"
  User ||--o{ ApiKey : "createdBy"
  Business ||--o{ McpAuditLog : "business"
  User |o--o{ OauthClient : "user"
  OauthClient ||--o{ OauthClientResource : "client"
  OauthResource ||--o{ OauthClientResource : "resource"
  OauthClient ||--o{ OauthRefreshToken : "client"
  Session |o--o{ OauthRefreshToken : "session"
  User ||--o{ OauthRefreshToken : "user"
  OauthClient ||--o{ OauthAccessToken : "client"
  Session |o--o{ OauthAccessToken : "session"
  User |o--o{ OauthAccessToken : "user"
  OauthRefreshToken |o--o{ OauthAccessToken : "refresh"
  OauthClient ||--o{ OauthConsent : "client"
  User |o--o{ OauthConsent : "user"
```

</details>
