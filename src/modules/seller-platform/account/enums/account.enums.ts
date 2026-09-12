/** Seller account operating model. */
export enum SellerType {
  INDIVIDUAL = 'INDIVIDUAL',
  BROKER = 'BROKER',
  AGENCY = 'AGENCY',
}

/** Lifecycle state controlling seller supply mutations. */
export enum SellerStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/** Verification state used by onboarding and future compliance workflows. */
export enum SellerVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}
