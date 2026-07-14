export const USER_ROLE = {
  user: 'user',
  vendor: 'vendor',
  admin: 'admin',
  superAdmin: 'superAdmin',
  company: 'company',
} as const;

export const AUTH_TYPE = {
  email: 'email',
  employeeId: 'employeeId',
  anonymous: 'anonymous',
  qrCode: 'qrCode',
} as const;

export const USER_STATUS = {
  pending: 'pending',
  active: 'active',
  blocked: 'blocked',
} as const;