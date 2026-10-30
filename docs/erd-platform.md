# Database diagram: the booking platform

Generated from `prisma/schema.prisma` by `pnpm docs:erd`. Do not edit by hand. Everything except AI and MCP (those are in [erd-ai-mcp.md](erd-ai-mcp.md)): people and teams, places and rooms,
bookings and the nights they hold, calendars, experiences, money, reviews and notifications.

Guarantees that Prisma cannot express live in hand-written SQL migrations:

- `occupancy_no_overlap`: an EXCLUDE constraint, so no two active stays share a room night.
- `session_seats_guard`: a trigger, so a session never sells more seats than it has.
- CHECK constraints on date ranges, guest counts, ratings, seats and payments.

Only the keys, statuses, kinds and a few telling columns are shown; "Every column" below has the full tables. The
whole database in one diagram: [erd.md](erd.md).

```mermaid
erDiagram
  User {
    String id PK
    String email UK
    PlatformRole platformRole
  }
  HostProfile {
    String userId PK, FK
    HostContact contactBy
  }
  Session {
    String id PK
    String token UK
    String userId FK
  }
  Account {
    String id PK
    String userId FK
  }
  Verification {
    String id PK
  }
  SiteSetting {
    String id PK
    String updatedById FK
  }
  Business {
    String id PK
    String slug UK
    BookingUnit bookingUnit
    BookingMode bookingMode
    BusinessStatus status
    Plan plan
    String stripeCustomerId UK
    String stripeSubscriptionId UK
  }
  Role {
    String id PK
    String businessId FK
  }
  Membership {
    String id PK
    String userId FK
    String businessId FK
    String roleId FK
    MembershipStatus status
  }
  Invitation {
    String id PK
    String businessId FK
    String roleId FK
    String invitedById FK
    String token UK
    InvitationStatus status
    String acceptedById FK
  }
  Room {
    String id PK
    String businessId FK
    Int capacity
    Int bedrooms
    Int bathrooms
    String exportToken UK
    RoomKind kind
  }
  Photo {
    String id PK
    String businessId FK
    String roomId FK
    String offeringId FK
    String storedImageId FK
    PhotoArea area
  }
  RateOverride {
    String id PK
    String businessId FK
    String roomId FK
  }
  Category {
    String slug PK
    ListingKind kind
  }
  BusinessCategory {
    String businessId FK
    String categorySlug FK
  }
  CalendarFeed {
    String id PK
    String businessId FK
    String roomId FK
    FeedSource source
  }
  Booking {
    String id PK
    String reference UK
    String businessId FK
    String roomId FK
    String guestUserId FK
    DateTime checkIn
    DateTime checkOut
    BookingMode bookingMode
    BookingStatus status
    String publicToken UK
    String decidedById FK
  }
  Occupancy {
    String id PK
    String businessId FK
    String roomId FK
    DateTime checkIn
    DateTime checkOut
    OccupancyKind kind
    Boolean active
    String bookingId UK, FK
    String feedId FK
  }
  Payment {
    String id PK
    String businessId FK
    String bookingId FK
    String sessionBookingId FK
    BigInt amountCents
    String currency
    PaymentMethod method
    PaymentStatus status
    String providerRef UK
  }
  Refund {
    String id PK
    String businessId FK
    String paymentId FK
    BigInt amountCents
    RefundStatus status
    String doneById FK
  }
  Payout {
    String id PK
    String businessId FK
    BigInt amountCents
    String currency
    PayoutMethod method
    PayoutStatus status
    String requestedById FK
    String decidedById FK
  }
  PlanPayment {
    String id PK
    String businessId FK
    String paidById FK
    Plan plan
    PaymentMethod method
    PaymentStatus status
    String providerRef UK
  }
  WhishSandboxPayment {
    String externalId PK
    String code UK
  }
  WebhookEvent {
    String id PK
  }
  Favorite {
    String id PK
    String userId FK
    String businessId FK
  }
  Review {
    String id PK
    String businessId FK
    String roomId FK
    String bookingId UK, FK
    String offeringId FK
    String sessionBookingId UK, FK
    String authorId FK
    ReviewStatus status
  }
  ActivityLog {
    String id PK
    String userId FK
    String businessId FK
  }
  AuditLog {
    String id PK
    String actorId FK
    String businessId FK
  }
  Offering {
    String id PK
    String businessId FK
    ListingKind kind
    String slug UK
    String categorySlug FK
    PriceUnit priceUnit
    ActivityLevel activityLevel
    SkillLevel skillLevel
  }
  OfferingSession {
    String id PK
    String businessId FK
    String offeringId FK
    DateTime startsAt
  }
  SessionBooking {
    String id PK
    String reference UK
    String publicToken UK
    String businessId FK
    String offeringId FK
    String sessionId FK
    String guestUserId FK
    BookingMode bookingMode
    BookingStatus status
    String decidedById FK
  }
  StoredImage {
    String id PK
    String businessId FK
  }
  PushSubscription {
    String id PK
    String endpoint UK
    String userId FK
  }
  User ||--o{ AiChat : "user"
  Business |o--o{ AiChat : "business"
  User ||--o{ HostProfile : "user"
  User ||--o{ Session : "user"
  User ||--o{ Account : "user"
  User |o--o{ SiteSetting : "updatedBy"
  Business ||--o{ Role : "business"
  User ||--o{ Membership : "user"
  Business ||--o{ Membership : "business"
  Role ||--o{ Membership : "role"
  Business ||--o{ Invitation : "business"
  Role ||--o{ Invitation : "role"
  User ||--o{ Invitation : "invitedBy"
  User |o--o{ Invitation : "acceptedBy"
  Business ||--o{ Room : "business"
  Business ||--o{ Photo : "business"
  Room |o--o{ Photo : "room"
  Offering |o--o{ Photo : "offering"
  StoredImage |o--o{ Photo : "storedImage"
  Business ||--o{ RateOverride : "business"
  Room ||--o{ RateOverride : "room"
  Business ||--o{ BusinessCategory : "business"
  Category ||--o{ BusinessCategory : "category"
  Business ||--o{ CalendarFeed : "business"
  Room ||--o{ CalendarFeed : "room"
  Business ||--o{ Booking : "business"
  Room ||--o{ Booking : "room"
  User ||--o{ Booking : "guestUser"
  User |o--o{ Booking : "decidedBy"
  Business ||--o{ Occupancy : "business"
  Room ||--o{ Occupancy : "room"
  Booking |o--o| Occupancy : "booking"
  CalendarFeed |o--o{ Occupancy : "feed"
  Business ||--o{ Payment : "business"
  Booking |o--o{ Payment : "booking"
  SessionBooking |o--o{ Payment : "sessionBooking"
  Business ||--o{ Refund : "business"
  Payment ||--o{ Refund : "payment"
  User |o--o{ Refund : "doneBy"
  Business ||--o{ Payout : "business"
  User ||--o{ Payout : "requestedBy"
  User |o--o{ Payout : "decidedBy"
  Business ||--o{ PlanPayment : "business"
  User |o--o{ PlanPayment : "paidBy"
  User ||--o{ Favorite : "user"
  Business ||--o{ Favorite : "business"
  Business ||--o{ Review : "business"
  Room |o--o{ Review : "room"
  Booking |o--o| Review : "booking"
  Offering |o--o{ Review : "offering"
  SessionBooking |o--o| Review : "sessionBooking"
  User |o--o{ Review : "author"
  User |o--o{ ActivityLog : "user"
  Business |o--o{ ActivityLog : "business"
  User |o--o{ AuditLog : "actor"
  Business |o--o{ AuditLog : "business"
  Business ||--o{ ApiKey : "business"
  Membership ||--o{ ApiKey : "membership"
  User ||--o{ ApiKey : "createdBy"
  Business ||--o{ McpAuditLog : "business"
  Business ||--o{ Offering : "business"
  Category |o--o{ Offering : "category"
  Business ||--o{ OfferingSession : "business"
  Offering ||--o{ OfferingSession : "offering"
  Business ||--o{ SessionBooking : "business"
  Offering ||--o{ SessionBooking : "offering"
  OfferingSession ||--o{ SessionBooking : "session"
  User ||--o{ SessionBooking : "guestUser"
  User |o--o{ SessionBooking : "decidedBy"
  Business ||--o{ StoredImage : "business"
  User |o--o{ OauthClient : "user"
  Session |o--o{ OauthRefreshToken : "session"
  User ||--o{ OauthRefreshToken : "user"
  Session |o--o{ OauthAccessToken : "session"
  User |o--o{ OauthAccessToken : "user"
  User |o--o{ OauthConsent : "user"
  User ||--o{ PushSubscription : "user"
```

<details>
<summary>Every column</summary>

```mermaid
erDiagram
  User {
    String id PK
    String name
    String email UK
    Boolean emailVerified
    String image
    String phone
    String locale
    PlatformRole platformRole
    DateTime notificationsSeenAt
    String deletedEmail
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  HostProfile {
    String userId PK, FK
    String displayName
    String bio
    String city
    String_list languages
    Int hostingSince
    Boolean showOnListings
    HostContact contactBy
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Session {
    String id PK
    DateTime expiresAt
    String token UK
    String ipAddress
    String userAgent
    String userId FK
    String mcpBusinessId
    DateTime createdAt
    DateTime updatedAt
  }
  Account {
    String id PK
    String accountId
    String providerId
    String userId FK
    String accessToken
    String refreshToken
    String idToken
    DateTime accessTokenExpiresAt
    DateTime refreshTokenExpiresAt
    String scope
    String password
    DateTime createdAt
    DateTime updatedAt
  }
  Verification {
    String id PK
    String identifier
    String value
    DateTime expiresAt
    DateTime createdAt
    DateTime updatedAt
  }
  SiteSetting {
    String id PK
    String palette
    String updatedById FK
    DateTime updatedAt
  }
  Business {
    String id PK
    String name
    String slug UK
    String description
    String area
    String region
    String address
    Float latitude
    Float longitude
    String phone
    String whatsapp
    String timezone
    String currency
    Int lbpRate
    Int commissionRateBps
    Int holdHours
    String paymentInstructions
    String checkInTime
    String checkOutTime
    String houseRules
    BookingUnit bookingUnit
    BookingMode bookingMode
    DateTime onlineTermsAcceptedAt
    Boolean listedPublicly
    String_list tags
    String_list accessibility
    Int minGuestAge
    BusinessStatus status
    Plan plan
    String stripeCustomerId UK
    String stripeSubscriptionId UK
    DateTime planRenewsAt
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Role {
    String id PK
    String businessId FK
    String name
    String description
    String_list permissions
    Boolean isOwner
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Membership {
    String id PK
    String userId FK
    String businessId FK
    String roleId FK
    MembershipStatus status
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Invitation {
    String id PK
    String businessId FK
    String roleId FK
    String invitedById FK
    String name
    String email
    String phone
    String locale
    String token UK
    InvitationStatus status
    DateTime expiresAt
    String acceptedById FK
    DateTime acceptedAt
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Room {
    String id PK
    String businessId FK
    String name
    String description
    Int capacity
    Int bedrooms
    Int beds
    Int bathrooms
    BigInt baseRateCents
    Int minNights
    String_list amenities
    String exportToken UK
    RoomKind kind
    Boolean active
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Photo {
    String id PK
    String businessId FK
    String roomId FK
    String offeringId FK
    String url
    String storedImageId FK
    String alt
    PhotoArea area
    Int position
    Boolean isDeleted
    DateTime createdAt
  }
  RateOverride {
    String id PK
    String businessId FK
    String roomId FK
    DateTime date
    BigInt rateCents
    Boolean isDeleted
  }
  Category {
    String slug PK
    ListingKind kind
    String nameEn
    String nameAr
    String icon
    Int position
    Boolean isDeleted
  }
  BusinessCategory {
    String businessId FK
    String categorySlug FK
    Boolean isDeleted
  }
  CalendarFeed {
    String id PK
    String businessId FK
    String roomId FK
    String url
    FeedSource source
    DateTime lastSyncedAt
    String lastError
    Boolean isDeleted
    DateTime createdAt
  }
  Booking {
    String id PK
    String reference UK
    String businessId FK
    String roomId FK
    String guestUserId FK
    String guestName
    String guestPhone
    String guestEmail
    Int guestCount
    String guestNote
    String locale
    DateTime checkIn
    DateTime checkOut
    BigInt totalCents
    String currency
    BookingMode bookingMode
    BookingStatus status
    String publicToken UK
    DateTime holdExpiresAt
    String decidedById FK
    DateTime decidedAt
    String cancelReason
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Occupancy {
    String id PK
    String businessId FK
    String roomId FK
    DateTime checkIn
    DateTime checkOut
    OccupancyKind kind
    Boolean active
    String note
    Boolean conflict
    String bookingId UK, FK
    String feedId FK
    String externalUid
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  Payment {
    String id PK
    String businessId FK
    String bookingId FK
    String sessionBookingId FK
    BigInt amountCents
    String currency
    PaymentMethod method
    PaymentStatus status
    String providerRef UK
    String note
    String providerPaymentId
    String checkoutUrl
    DateTime paidAt
    BigInt refundedCents
    Boolean isDeleted
    DateTime createdAt
  }
  Refund {
    String id PK
    String businessId FK
    String paymentId FK
    BigInt amountCents
    String currency
    RefundStatus status
    String reason
    String providerRef
    DateTime doneAt
    String doneById FK
    Boolean isDeleted
    DateTime createdAt
  }
  Payout {
    String id PK
    String businessId FK
    BigInt amountCents
    String currency
    PayoutMethod method
    String accountName
    String bankName
    String iban
    String whishPhone
    PayoutStatus status
    String requestedById FK
    String reference
    String adminNote
    String decidedById FK
    DateTime decidedAt
    Boolean isDeleted
    DateTime createdAt
  }
  PlanPayment {
    String id PK
    String businessId FK
    String paidById FK
    Plan plan
    Int months
    BigInt amountCents
    String currency
    PaymentMethod method
    PaymentStatus status
    String providerRef UK
    String checkoutUrl
    DateTime paidAt
    Boolean isDeleted
    DateTime createdAt
  }
  WhishSandboxPayment {
    String externalId PK
    String code UK
    String amount
    String currency
    String invoice
    String successCallbackUrl
    String failureCallbackUrl
    String successRedirectUrl
    String failureRedirectUrl
    String status
    String payerPhone
    DateTime createdAt
  }
  WebhookEvent {
    String id PK
    String provider
    String eventId
    Json payload
    DateTime receivedAt
  }
  Favorite {
    String id PK
    String userId FK
    String businessId FK
    Boolean isDeleted
    DateTime createdAt
  }
  Review {
    String id PK
    String businessId FK
    String roomId FK
    String bookingId UK, FK
    String offeringId FK
    String sessionBookingId UK, FK
    String authorId FK
    Int rating
    String comment
    String ownerReply
    ReviewStatus status
    String hiddenReason
    Boolean isDeleted
    DateTime createdAt
  }
  ActivityLog {
    String id PK
    String userId FK
    String businessId FK
    String action
    String entity
    String entityId
    Json meta
    Boolean isDeleted
    DateTime createdAt
  }
  AuditLog {
    String id PK
    String actorId FK
    String businessId FK
    String action
    String entity
    String entityId
    Json meta
    Boolean isDeleted
    DateTime createdAt
  }
  Offering {
    String id PK
    String businessId FK
    ListingKind kind
    String slug UK
    String title
    String description
    String categorySlug FK
    String area
    String region
    String meetingPoint
    Float latitude
    Float longitude
    Int durationMinutes
    BigInt priceCents
    PriceUnit priceUnit
    Int maxGuests
    Int minAge
    ActivityLevel activityLevel
    SkillLevel skillLevel
    String_list included
    String_list notIncluded
    String_list accessibility
    String_list languages
    String_list tags
    Boolean active
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  OfferingSession {
    String id PK
    String businessId FK
    String offeringId FK
    DateTime startsAt
    DateTime endsAt
    Int capacity
    Boolean active
    Boolean isDeleted
    DateTime createdAt
  }
  SessionBooking {
    String id PK
    String reference UK
    String publicToken UK
    String businessId FK
    String offeringId FK
    String sessionId FK
    String guestUserId FK
    String guestName
    String guestPhone
    String guestEmail
    String guestNote
    String locale
    Int seats
    BigInt totalCents
    String currency
    BookingMode bookingMode
    BookingStatus status
    DateTime holdExpiresAt
    String decidedById FK
    DateTime decidedAt
    String cancelReason
    Boolean isDeleted
    DateTime createdAt
    DateTime updatedAt
  }
  StoredImage {
    String id PK
    String businessId FK
    String mimeType
    Bytes bytes
    String storageKey
    Int size
    Boolean isDeleted
    DateTime createdAt
  }
  PushSubscription {
    String id PK
    String endpoint UK
    String p256dh
    String auth
    String userId FK
    DateTime createdAt
  }
  User ||--o{ AiChat : "user"
  Business |o--o{ AiChat : "business"
  User ||--o{ HostProfile : "user"
  User ||--o{ Session : "user"
  User ||--o{ Account : "user"
  User |o--o{ SiteSetting : "updatedBy"
  Business ||--o{ Role : "business"
  User ||--o{ Membership : "user"
  Business ||--o{ Membership : "business"
  Role ||--o{ Membership : "role"
  Business ||--o{ Invitation : "business"
  Role ||--o{ Invitation : "role"
  User ||--o{ Invitation : "invitedBy"
  User |o--o{ Invitation : "acceptedBy"
  Business ||--o{ Room : "business"
  Business ||--o{ Photo : "business"
  Room |o--o{ Photo : "room"
  Offering |o--o{ Photo : "offering"
  StoredImage |o--o{ Photo : "storedImage"
  Business ||--o{ RateOverride : "business"
  Room ||--o{ RateOverride : "room"
  Business ||--o{ BusinessCategory : "business"
  Category ||--o{ BusinessCategory : "category"
  Business ||--o{ CalendarFeed : "business"
  Room ||--o{ CalendarFeed : "room"
  Business ||--o{ Booking : "business"
  Room ||--o{ Booking : "room"
  User ||--o{ Booking : "guestUser"
  User |o--o{ Booking : "decidedBy"
  Business ||--o{ Occupancy : "business"
  Room ||--o{ Occupancy : "room"
  Booking |o--o| Occupancy : "booking"
  CalendarFeed |o--o{ Occupancy : "feed"
  Business ||--o{ Payment : "business"
  Booking |o--o{ Payment : "booking"
  SessionBooking |o--o{ Payment : "sessionBooking"
  Business ||--o{ Refund : "business"
  Payment ||--o{ Refund : "payment"
  User |o--o{ Refund : "doneBy"
  Business ||--o{ Payout : "business"
  User ||--o{ Payout : "requestedBy"
  User |o--o{ Payout : "decidedBy"
  Business ||--o{ PlanPayment : "business"
  User |o--o{ PlanPayment : "paidBy"
  User ||--o{ Favorite : "user"
  Business ||--o{ Favorite : "business"
  Business ||--o{ Review : "business"
  Room |o--o{ Review : "room"
  Booking |o--o| Review : "booking"
  Offering |o--o{ Review : "offering"
  SessionBooking |o--o| Review : "sessionBooking"
  User |o--o{ Review : "author"
  User |o--o{ ActivityLog : "user"
  Business |o--o{ ActivityLog : "business"
  User |o--o{ AuditLog : "actor"
  Business |o--o{ AuditLog : "business"
  Business ||--o{ ApiKey : "business"
  Membership ||--o{ ApiKey : "membership"
  User ||--o{ ApiKey : "createdBy"
  Business ||--o{ McpAuditLog : "business"
  Business ||--o{ Offering : "business"
  Category |o--o{ Offering : "category"
  Business ||--o{ OfferingSession : "business"
  Offering ||--o{ OfferingSession : "offering"
  Business ||--o{ SessionBooking : "business"
  Offering ||--o{ SessionBooking : "offering"
  OfferingSession ||--o{ SessionBooking : "session"
  User ||--o{ SessionBooking : "guestUser"
  User |o--o{ SessionBooking : "decidedBy"
  Business ||--o{ StoredImage : "business"
  User |o--o{ OauthClient : "user"
  Session |o--o{ OauthRefreshToken : "session"
  User ||--o{ OauthRefreshToken : "user"
  Session |o--o{ OauthAccessToken : "session"
  User |o--o{ OauthAccessToken : "user"
  User |o--o{ OauthConsent : "user"
  User ||--o{ PushSubscription : "user"
```

</details>
