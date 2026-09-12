/** Provider account operating model. */
export enum ProviderType {
  INDIVIDUAL = 'INDIVIDUAL',
  BROKER = 'BROKER',
  AGENCY = 'AGENCY',
}

/** Lifecycle state controlling provider supply mutations. */
export enum ProviderStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/** Verification state used by onboarding and future compliance workflows. */
export enum ProviderVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

/** @deprecated Use provider terminology in new code. */
