import httpStatus from 'http-status';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { User } from '../User/user.model';
import { Company } from '../Company/company.model';
import { Team } from '../Team/team.model';
import { createToken, verifyToken } from './auth.utils';
import config from '../../config';
import { sendOTP } from '../../utils/twilio';
import { getEmailTemplate } from '../../utils/emailTemplate';
import sendEmail from '../../utils/sendEmail';
import { TResetPassword, TEmployeeIdLogin, TGuestLogin } from './auth.interface';
import { TUser } from '../User/user.interface';
import { USER_ROLE, AUTH_TYPE } from './auth.constant';



export const sendOtpToUser = async (user: any, plainOtp: string, title: string, _identifier?: string) => {

  // --- Always send OTP via Email (primary channel) ---
  const html = getEmailTemplate({
    userName: user.firstName,
    title,
    body: `Your verification code is below. Please use it within 10 minutes.`,
    otpCode: plainOtp,
  });

  await sendEmail({
    to: user.email!,
    subject: title,
    html,
  });
  console.log('✅ OTP sent via Email to:', user.email);

  // --- v2: SMS OTP — enable by setting SMS_ENABLED=true in .env ---
  if (config.sms_enabled && user.phone) {
    try {
      await sendOTP(user.phone, plainOtp);
      console.log('✅ OTP also sent via SMS to:', user.phone);
    } catch (smsError: any) {
      console.warn('⚠️ SMS OTP skipped (optional channel):', smsError?.message || smsError);
    }
  }
};


// ─────────────────────────────────────────────
//  FLOW 4: Email & Password Registration (Website - Standard)
//  Requires companyId and teamId. Validates team belongs to company.
// ─────────────────────────────────────────────
const registerUser = async (payload: TUser & { companyId: string; teamId: string }) => {
  const { companyId, teamId } = payload;

  // Validate email uniqueness
  const isExist = await User.findOne({ email: payload.email });
  if (isExist) throw new AppError(409, 'Email already registered');

  // Validate company exists and is active
  const company = await Company.findById(companyId);
  if (!company) throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  if (company.status !== 'active') throw new AppError(httpStatus.FORBIDDEN, 'Company account is not active');

  // Validate team belongs to company
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  if (team.companyId.toString() !== companyId) throw new AppError(httpStatus.BAD_REQUEST, 'Team does not belong to this company');

  const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();

  const userData: Partial<TUser> = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    password: payload.password,
    role: 'user',
    authType: 'email',
    companyId: new Types.ObjectId(companyId),
    teamId: new Types.ObjectId(teamId),
    status: 'active',
    isOtpVerified: false,
    otp: plainOtp,
    otpExpires: new Date(Date.now() + 10 * 60 * 1000),
  };

  const newUser = await User.create(userData);

  // Send OTP via Email
  try {
    const emailHtml = getEmailTemplate({
      userName: payload.firstName,
      title: 'Verify Your Account',
      body: 'Welcome to ActInc! Use the verification code below to activate your account.',
      otpCode: plainOtp,
    });
    await sendEmail({
      to: payload.email!,
      subject: 'Your ActInc Verification Code',
      html: emailHtml,
    });
    console.log('✅ OTP sent via Email to:', payload.email);
  } catch (emailError: any) {
    await User.findByIdAndDelete(newUser._id);
    console.error('❌ Email OTP failed:', emailError?.message || emailError);
    throw new AppError(502, 'Failed to send OTP via Email. Please try again.');
  }

  return newUser;
};


const verifyOTPForRegistration = async (identifier: string, otp: string) => {
  const user = await User.findOne({
    $or: [{ email: identifier }, { phone: identifier }],
  }).select('+otp +otpExpires');

  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

  // Check if OTP is already expired
  if (user.otpExpires && user.otpExpires < new Date()) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'OTP has expired. Please request a new one via /resendOtp');
  }

  if (!user.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No OTP found. Please request a new one via /resendOtp');
  }

  const isMatch = await bcrypt.compare(otp, user.otp);
  if (!isMatch) throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid OTP');

  user.isOtpVerified = true;
  user.otp = null;
  user.otpExpires = null;
  await user.save();

  const jwtPayload = { userId: user._id.toString(), role: user.role };
  return { 
    accessToken: createToken(jwtPayload, config.jwt_access_secret!, config.jwt_access_expires_in!),
    refreshToken: createToken(jwtPayload, config.jwt_refresh_secret!, config.jwt_refresh_expires_in!),
    user 
  };
};

// ─────────────────────────────────────────────
//  FLOW 1 & 2: Login via email/password
//  Supports: superAdmin, admin, company, user roles
//  For 'company' role — verifies company is active
// ─────────────────────────────────────────────
const loginUser = async (payload: { identifier: string; password: string; fcmToken?: string }) => {
  const user = await User.findOne({ $or: [{ email: payload.identifier }, { phone: payload.identifier }] }).select('+password');
  if (!user || user.status === 'blocked' || !user.isOtpVerified) 
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid credentials or account not verified');

  const isMatch = await user.isPasswordMatched(payload.password, user.password!);
  if (!isMatch) throw new AppError(httpStatus.FORBIDDEN, 'Incorrect password');

  // If user has 'company' role, verify their company is active
  if (user.role === 'company' && user.companyId) {
    const company = await Company.findById(user.companyId);
    if (!company || company.status !== 'active') {
      throw new AppError(httpStatus.FORBIDDEN, 'Your company account is not active. Contact support.');
    }
  }

  // Update FCM token
  if (payload.fcmToken) {
    user.fcmToken = payload.fcmToken;
  }

  user.lastActiveAt = new Date();
  await user.save();

  const jwtPayload = { userId: user._id.toString(), role: user.role };
  return {
    accessToken: createToken(jwtPayload, config.jwt_access_secret!, config.jwt_access_expires_in!),
    refreshToken: createToken(jwtPayload, config.jwt_refresh_secret!, config.jwt_refresh_expires_in!),
    user
  };
};

// ─────────────────────────────────────────────
//  FLOW 3: Employee ID Login (Just-in-Time Registration)
//  If user exists with employeeId in company → login
//  If not → create new user with role:user, authType:employeeId
// ─────────────────────────────────────────────
const employeeIdLogin = async (payload: TEmployeeIdLogin) => {
  const { employeeId, companyId, teamId, firstName, lastName } = payload;

  // Validate team belongs to company
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  if (team.companyId.toString() !== companyId) throw new AppError(httpStatus.BAD_REQUEST, 'Team does not belong to this company');

  // Validate company is active
  const company = await Company.findById(companyId);
  if (!company) throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  if (company.status !== 'active') throw new AppError(httpStatus.FORBIDDEN, 'Company account is not active');

  // Check if user already exists with this employeeId in this company
  let user = await User.findOne({ employeeId, companyId: new Types.ObjectId(companyId) });

  if (!user) {
    // Just-in-time registration: create new user
    user = await User.create({
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      employeeId,
      role: 'user',
      authType: 'employeeId',
      companyId: new Types.ObjectId(companyId),
      teamId: new Types.ObjectId(teamId),
      status: 'active',
      isOtpVerified: true, // No OTP needed for employee ID flow
      lastActiveAt: new Date(),
    });
    console.log(`✅ JIT user created via employeeId: ${employeeId} in company ${companyId}`);
  } else {
    // Update last active
    user.lastActiveAt = new Date();
    await user.save();
  }

  const jwtPayload = { userId: user._id.toString(), role: user.role, companyId, teamId, authType: 'employeeId' };
  return {
    accessToken: createToken(jwtPayload, config.jwt_access_secret!, config.jwt_access_expires_in!),
    refreshToken: createToken(jwtPayload, config.jwt_refresh_secret!, config.jwt_refresh_expires_in!),
    user,
  };
};

// ─────────────────────────────────────────────
//  FLOW 5: Guest Login (Anonymous via Passcode)
//  Verifies passcode against Team model.
//  Issues JWT with role:guest — NO DB record created.
// ─────────────────────────────────────────────
const guestLogin = async (payload: TGuestLogin) => {
  const { passcode, companyId, teamId } = payload;

  // Validate company is active
  const company = await Company.findById(companyId);
  if (!company) throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  if (company.status !== 'active') throw new AppError(httpStatus.FORBIDDEN, 'Company account is not active');

  // Validate team belongs to company
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  if (team.companyId.toString() !== companyId) throw new AppError(httpStatus.BAD_REQUEST, 'Team does not belong to this company');

  // Verify passcode against stored hash
  const isValidPasscode = await Team.isPasscodeValid(teamId, passcode);
  if (!isValidPasscode) throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid passcode');

  // Issue JWT with guest role — no DB record
  const jwtPayload = { role: 'guest', companyId, teamId, authType: 'anonymous' };
  const guestAccessToken = createToken(jwtPayload, config.jwt_access_secret!, config.jwt_guest_access_expires_in || '4h');
  const guestRefreshToken = createToken(jwtPayload, config.jwt_refresh_secret!, '8h');

  return {
    accessToken: guestAccessToken,
    refreshToken: guestRefreshToken,
    user: null, // No user record for guests
    message: 'Guest login successful',
  };
};

// ─────────────────────────────────────────────
//  FLOW 6: QR Code Login/Registration
//  Scans QR code containing encrypted token with companyId, teamId, and optional user data
//  If user exists → login; if not → register new user
// ─────────────────────────────────────────────
const qrCodeLogin = async (payload: { qrToken: string; firstName?: string; lastName?: string; email?: string; phone?: string }) => {
  const { qrToken, firstName, lastName, email, phone } = payload;

  // Decode and verify QR token
  let decoded: any;
  try {
    decoded = verifyToken(qrToken, config.jwt_access_secret!);
  } catch (error) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired QR code');
  }

  const { companyId, teamId, type } = decoded;
  
  if (type !== 'qr_login') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid QR code type');
  }

  // Validate company is active
  const company = await Company.findById(companyId);
  if (!company) throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  if (company.status !== 'active') throw new AppError(httpStatus.FORBIDDEN, 'Company account is not active');

  // Validate team belongs to company
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  if (team.companyId.toString() !== companyId) throw new AppError(httpStatus.BAD_REQUEST, 'Team does not belong to this company');

  // Check if user already exists (by email or phone if provided)
  let user = null;
  if (email) {
    user = await User.findOne({ email, companyId: new Types.ObjectId(companyId) });
  } else if (phone) {
    user = await User.findOne({ phone, companyId: new Types.ObjectId(companyId) });
  }

  if (user) {
    // Existing user - login
    user.lastActiveAt = new Date();
    await user.save();

    const jwtPayload = { userId: user._id.toString(), role: user.role, companyId, teamId, authType: 'email' };
    return {
      accessToken: createToken(jwtPayload, config.jwt_access_secret!, config.jwt_access_expires_in!),
      refreshToken: createToken(jwtPayload, config.jwt_refresh_secret!, config.jwt_refresh_expires_in!),
      user,
      isNewUser: false,
    };
  }

  // New user - register
  if (!firstName || !lastName) {
    throw new AppError(httpStatus.BAD_REQUEST, 'First name and last name required for new user registration');
  }

  const authType: 'email' | 'employeeId' | 'anonymous' = email ? 'email' : 'employeeId';
  const identifier = email || phone;

  user = await User.create({
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email,
    phone,
    role: 'user',
    authType,
    companyId: new Types.ObjectId(companyId),
    teamId: new Types.ObjectId(teamId),
    status: 'active',
    isOtpVerified: true, // QR code acts as verification
    lastActiveAt: new Date(),
  });

  console.log(`✅ New user registered via QR code: ${identifier} in company ${companyId}`);

  const jwtPayload = { userId: user._id.toString(), role: user.role, companyId, teamId, authType };
  return {
    accessToken: createToken(jwtPayload, config.jwt_access_secret!, config.jwt_access_expires_in!),
    refreshToken: createToken(jwtPayload, config.jwt_refresh_secret!, config.jwt_refresh_expires_in!),
    user,
    isNewUser: true,
  };
};

// ---------------------------------------

const resendOTP = async (identifier: string) => {
  const user = await User.findOne({ 
    $or: [{ email: identifier }, { phone: identifier }] 
  }).select('+otp +otpExpires');
  
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

  const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = plainOtp; 
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOtpToUser(user, plainOtp, "Your New Verification Code",identifier);
  return { message: 'Verification code resent successfully' };
};

const forgotPass = async (identifier: string) => {
  const user = await User.findOne({ 
    $or: [{ email: identifier }, { phone: identifier }] 
  }).select('+otp +otpExpires');
  
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

  const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = plainOtp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOtpToUser(user, plainOtp, "Password Reset OTP",identifier);
  return { message: 'Reset OTP sent successfully' };
};


const resetPassword = async (payload: TResetPassword) => {
  const { identifier, otp, newPassword } = payload;
  
 
  const user = await User.findOne({ 
    $or: [{ phone: identifier }, { email: identifier }] 
  }).select('+otp +otpExpires');

  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');


  if (!user.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No OTP found. Please request a new one via /forgotPass');
  }

  const isOtpMatched = await bcrypt.compare(otp, user.otp);
  if (!isOtpMatched || (user.otpExpires && user.otpExpires < new Date())) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid or expired OTP');
  }

  user.password = newPassword;
  user.otp = null;
  user.otpExpires = null;
  await user.save();

  return { message: 'Password reset successful' };
};


// -------------------------------

// const resendOTP = async (phone: string) => {
//   const user = await User.findOne({ phone });
//   if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');
//   const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
//   user.otp = plainOtp;
//   user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
//   await user.save();
//   await sendOTP(phone, plainOtp);
//   return { message: 'OTP resent successfully' };
// };


// const forgotPass = async (identifier: string) => {
//   const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
//   if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');
//   const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
//   user.otp = plainOtp;
//   user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
//   await user.save();
//   await sendOTP(user.phone, plainOtp);
//   return { message: 'Reset OTP sent' };
// };


// const resetPassword = async (payload: any) => {
//   const user = await User.findOne({ phone: payload.phone }).select('+otp +otpExpires');
//   const isMatch = await bcrypt.compare(payload.otp, user?.otp || '');
//   if (!user || !isMatch) throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid OTP');
//   user.password = payload.newPassword;
//   user.otp = null;
//   await user.save();
//   return { message: 'Password reset successful' };
// };


const changePassword = async (userId: string, payload: any) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  if (!user.password) throw new AppError(httpStatus.BAD_REQUEST, 'Password not set');
  const isMatch = await user.isPasswordMatched(payload.oldPassword, user.password);
  if (!isMatch) throw new AppError(httpStatus.FORBIDDEN, 'Old password incorrect');
  user.password = payload.newPassword;
  await user.save();
  return { message: 'Password updated' };
};


const refreshToken = async (token: string) => {
  const decoded = verifyToken(token, config.jwt_refresh_secret!) as any;
  
  // Guest token refresh — no DB check needed
  if (decoded.role === 'guest') {
    const jwtPayload = { role: 'guest', companyId: decoded.companyId, teamId: decoded.teamId, authType: 'anonymous' };
    return {
      accessToken: createToken(jwtPayload, config.jwt_access_secret!, config.jwt_guest_access_expires_in || '4h'),
    };
  }

  const user = await User.findById(decoded.userId);
  if (!user || user.status === 'blocked') throw new AppError(httpStatus.FORBIDDEN, 'Unauthorized');
  return { accessToken: createToken({ userId: user._id.toString(), role: user.role }, config.jwt_access_secret!, '1d') };
};




export const AuthServices = {
  registerUser,
  verifyOTPForRegistration,
  loginUser,
  employeeIdLogin,
  guestLogin,
  qrCodeLogin,
  resendOTP,
  forgotPass,
  resetPassword,
  changePassword,
  refreshToken,
  sendOtpToUser,
};