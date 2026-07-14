import { Model, Types } from 'mongoose';

export type TUserRole = 'user' | 'vendor' | 'admin' | 'superAdmin' | 'company' | 'guest';

export type TAuthType = 'email' | 'employeeId' | 'anonymous';

export interface TVendorAvailability {
  day: string; // e.g., 'Monday'
  isOpen: boolean;
  startTime?: string;
  endTime?: string;
}

export interface TVendorDetails {
  businessName: string;
  ownerName: string;
  whatsappNumber?: string;
  location: {
    address: string;
    city: string;
    area: string;
    zipCode?: string;
  };
  lat: number;
  long: number;
  businessDetails: string;
  experienceYears: number;
  teamSize?: number;
  socialLinks?: { instagram?: string; facebook?: string; website?: string };
   googleMapLink?: string;
  categories: string[];
  serviceArea: string[];
  documents: string[]; // URLs
  portfolio: string[]; // Image Gallery URLs
 bookedDates: string[];
  availability: TVendorAvailability[];
  profileScore: number; // 0-100
  isVerifiedBadge: boolean;
  isProfileCompleted: boolean;
  completedTasks: string[]; // e.g. ['BUSINESS_VERIFICATION', 'SERVICES_VARIETY']
}

export interface TUser {
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  password?: string;
  image?: string;
  lat?: number;
  long?: number;
  role: TUserRole;
  authType: TAuthType;
  employeeId?: string;
  companyId?: Types.ObjectId;
  teamId?: Types.ObjectId;
  status: 'pending' | 'active' | 'blocked';
  isOtpVerified: boolean;
  otp?: string | null;
  otpExpires?: Date | null;
  acceptedTerms?: boolean;
  vendor?: TVendorDetails;
  isDeleted: boolean;
  isSponsored?: boolean;
  isFeatured?: boolean;
  isOnline?: boolean;
  passwordChangedAt?: Date;
  fcmToken?: string | null;
  favoriteServices?: Types.ObjectId[];
  lastActiveAt?: Date;
}

export interface IUserMethods {
  isPasswordMatched(plain: string, hashed: string): Promise<boolean>;
}


export interface UserModel extends Model<TUser, Record<string, never>, IUserMethods> {
  isUserExistsById(id: string): Promise<TUser>;
  isJWTIssuedBeforePasswordChanged(passwordChangedAt: Date, jwtIssuedTimestamp: number): boolean;
}