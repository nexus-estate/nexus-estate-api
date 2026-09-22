import { Estate } from '../entities';
import { EstatePurpose, EstateType } from '../types/estate.type';

/**
 * Owns the publication-quality data rule for the Property activation command.
 * Provider ownership is checked by the service before this policy is called.
 */
export class EstateActivationPolicy {
  missingFields(estate: Estate): string[] {
    const missing: string[] = [];
    if (!estate.title?.trim()) missing.push('title');
    if (!Object.values(EstateType).includes(estate.type)) missing.push('type');
    if (!Object.values(EstatePurpose).includes(estate.purpose)) {
      missing.push('purpose');
    }
    if (!estate.addressLine?.trim()) missing.push('address');
    if (!estate.provinceId) missing.push('province');
    if (!estate.wardId) missing.push('ward');

    const price = Number(estate.price);
    if (!Number.isFinite(price) || price < 0) missing.push('price');

    return missing;
  }
}
