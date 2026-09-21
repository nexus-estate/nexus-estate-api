import { BusinessException } from '../../../../common/exceptions/business.exception';
import { ProviderAccountErrorCodes } from '../errors/provider-account-error-codes';
import { ProviderType } from '../enums/account.enums';

/** Normalizes and validates a provider display name, rejecting blank input. */
export function normalizeProviderDisplayName(
  displayName: string | undefined,
): string {
  const normalized = displayName?.trim();
  if (!normalized) {
    throw new BusinessException(
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_DISPLAY_NAME,
    );
  }
  return normalized;
}

/** Asserts that the requested provider type is supported. */
export function assertValidProviderType(
  type: ProviderType | undefined,
): asserts type is ProviderType {
  if (!Object.values(ProviderType).includes(type as ProviderType)) {
    throw new BusinessException(
      ProviderAccountErrorCodes.PROVIDER_ACCOUNT_INVALID_TYPE,
    );
  }
}
