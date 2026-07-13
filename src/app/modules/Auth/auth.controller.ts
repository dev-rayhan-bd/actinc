import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './auth.services';
import uploadImage from '../../middleware/upload';

const registerUser = catchAsync(async (req, res) => {
  const image = req.file ? await uploadImage(req) : '';
  const result = await AuthServices.registerUser({ ...req.body, image });
  sendResponse(res, { statusCode: 201, success: true, message: 'OTP sent', data: result });
});

const userLogin = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUser(req.body);
  res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: true });
  sendResponse(res, { statusCode: 200, success: true, message: 'Login Success', data: result });
});

const VerifyOtpForRegistration = catchAsync(async (req, res) => {
  const result = await AuthServices.verifyOTPForRegistration(req.body.identifier, req.body.otp);
  sendResponse(res, { statusCode: 200, success: true, message: 'Verified', data: result });
});

const resendOtp = catchAsync(async (req, res) => {
  const result = await AuthServices.resendOTP(req.body.identifier);
  sendResponse(res, { statusCode: 200, success: true, message: result.message, data: null });
});

const forgotPassword = catchAsync(async (req, res) => {
  const result = await AuthServices.forgotPass(req.body.identifier);
  sendResponse(res, { statusCode: 200, success: true, message: result.message, data: null });
});

const resetPassword = catchAsync(async (req, res) => {
  const result = await AuthServices.resetPassword(req.body);
  sendResponse(res, { statusCode: 200, success: true, message: result.message, data: null });
});

const changePassword = catchAsync(async (req, res) => {
  const result = await AuthServices.changePassword(req.user.userId, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: result.message, data: null });
});

const refreshToken = catchAsync(async (req, res) => {
  const result = await AuthServices.refreshToken(req.body.refreshToken || req.cookies.refreshToken);
  sendResponse(res, { statusCode: 200, success: true, message: 'Token Refreshed', data: result });
});

const logout = catchAsync(async (req, res) => {
  res.clearCookie('refreshToken');
  sendResponse(res, { statusCode: 200, success: true, message: 'Logged out', data: null });
});

export const AuthControllers = { registerUser, userLogin, VerifyOtpForRegistration, resendOtp, forgotPassword, resetPassword, changePassword, refreshToken, logout, AdminLogin: userLogin };