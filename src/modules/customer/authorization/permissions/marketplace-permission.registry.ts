/** Code-owned marketplace catalogue. It is intentionally empty until a real differentiated role use case exists. */
export const MARKETPLACE_PERMISSION_REGISTRY: ReadonlyArray<{
  code: string;
  name: string;
  description: string;
  platform: 'MARKETPLACE';
  category: string;
  resource: string;
  action: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isAssignable: boolean;
}> = [];
