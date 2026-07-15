import { Model, Types } from 'mongoose';

export type TUserRole = 'user' | 'admin' | 'superAdmin' | 'company';

export type TAuthType = 'email' | 'employeeId' | 'anonymous';

export interface TUser {
  firstName: string;
  lastName?: string;
  fullName?: string;
  image?: string;
  email?: string;
  phone?: string;
  password?: string;
  authType: TAuthType;
  role: TUserRole;
  employeeId?: string;
  companyId?: Types.ObjectId;
  teamId?: Types.ObjectId;
  status: 'active' | 'blocked';
  isOtpVerified: boolean;
  isDeleted: boolean;
  otp?: string | null;
  otpExpires?: Date | null;
  acceptedTerms?: boolean;
  fcmToken?: string | null;
  passwordChangedAt?: Date;
  lastActiveAt?: Date;
}

export interface IUserMethods {
  isPasswordMatched(plain: string, hashed: string): Promise<boolean>;
}


export interface UserModel extends Model<TUser, Record<string, never>, IUserMethods> {
  isUserExistsById(id: string): Promise<TUser>;
  isJWTIssuedBeforePasswordChanged(passwordChangedAt: Date, jwtIssuedTimestamp: number): boolean;
}