import httpStatus from 'http-status';
import bcrypt from 'bcrypt';
import AppError from '../../errors/AppError';
import { User } from '../User/user.model';
import { createToken, verifyToken } from './auth.utils';
import config from '../../config';
import { sendOTP } from '../../utils/twilio';
import { getEmailTemplate } from '../../utils/emailTemplate';
import sendEmail from '../../utils/sendEmail';
import { TResetPassword } from './auth.interface';
import { TUser } from '../User/user.interface';



export const sendOtpToUser = async (user: any, plainOtp: string, title: string, _identifier?: string) => {

  // --- Always send OTP via Email (primary channel) ---
  const html = getEmailTemplate({
    userName: user.firstName,
    title,
    body: `Your verification code is below. Please use it within 10 minutes.`,
    otpCode: plainOtp,
  });

  await sendEmail({
    to: user.email,
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


const registerUser = async (payload: TUser) => {
  const isExist = await User.findOne({ $or: [{ email: payload.email }, { phone: payload.phone }] });
  if (isExist) throw new AppError(409, 'Email or Phone already registered');

  const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
  
  payload.otp = plainOtp;
  payload.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  payload.role = 'user'; 
  payload.status = 'active'; 
  payload.isOtpVerified = false;

  // ── Security: Strip restricted fields that users must not set ──
  delete (payload as any).isSponsored;
  delete (payload as any).isFeatured;
  delete (payload as any).isDeleted;
  if (payload.vendor) {
    delete (payload.vendor as any).isVerifiedBadge;
    delete (payload.vendor as any).isProfileCompleted;
    delete (payload.vendor as any).profileScore;
    delete (payload.vendor as any).passwordChangedAt;
  }

  const newUser = await User.create(payload);

  // --- Send OTP via Email (primary channel) ---
  // v2: To also send SMS, set SMS_ENABLED=true in .env — sendOtpToUser handles it
  try {
    const emailHtml = getEmailTemplate({
      userName: payload.firstName,
      title: 'Verify Your Account',
      body: 'Welcome to WePlan! Use the verification code below to activate your account.',
      otpCode: plainOtp,
    });
    await sendEmail({
      to: payload.email,
      subject: 'Your WePlan Verification Code',
      html: emailHtml,
    });
    console.log('✅ OTP sent via Email to:', payload.email);

    // v2: SMS OTP (parallel, non-blocking)
    if (config.sms_enabled && payload.phone) {
      sendOTP(payload.phone, plainOtp)
        .then(() => console.log('✅ OTP also sent via SMS to:', payload.phone))
        .catch((err: any) => console.warn('⚠️ SMS OTP skipped:', err?.message || err));
    }
  } catch (emailError: any) {
    // Email failed → rollback
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

const loginUser = async (payload: { identifier: string; password: string; fcmToken?: string }) => {
  const user = await User.findOne({ $or: [{ email: payload.identifier }, { phone: payload.identifier }] }).select('+password');
  if (!user || user.status === 'blocked' || !user.isOtpVerified) 
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid credentials or account not verified');

  const isMatch = await user.isPasswordMatched(payload.password, user.password!);
  if (!isMatch) throw new AppError(httpStatus.FORBIDDEN, 'Incorrect password');

  // Update FCM token for push notifications (latest device)
  if (payload.fcmToken) {
    user.fcmToken = payload.fcmToken;
  }

  // Track last activity for visibility score (fire-and-forget)
  user.lastActiveAt = new Date();
  await user.save();

  const jwtPayload = { userId: user._id.toString(), role: user.role };
  return {
    accessToken: createToken(jwtPayload, config.jwt_access_secret!, config.jwt_access_expires_in!),
    refreshToken: createToken(jwtPayload, config.jwt_refresh_secret!, config.jwt_refresh_expires_in!),
    user
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
  const user = await User.findById(decoded.userId);
  if (!user || user.status === 'blocked') throw new AppError(httpStatus.FORBIDDEN, 'Unauthorized');
  return { accessToken: createToken({ userId: user._id.toString(), role: user.role }, config.jwt_access_secret!, '1d') };
};




export const AuthServices = { registerUser, verifyOTPForRegistration, loginUser, resendOTP, forgotPass, resetPassword, changePassword, refreshToken,sendOtpToUser };