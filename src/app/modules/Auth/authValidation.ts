import { z } from 'zod';

export const AuthValidation = {
   registerSchema: z.object({
    body: z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().email(),
      phone: z.string(),
      password: z.string().min(8),
      acceptedTerms: z.literal(true),
       fcmToken: z.string().optional(),
      role: z.enum(['user', 'vendor']),
    }),
  }),


  loginSchema: z.object({
    identifier: z.string({ required_error: "Email or Phone is required" }),
    password: z.string({ required_error: "Password is required" }),
    fcmToken: z.string().optional(),
  }),
changePasswordSchema: z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(8, "New password must be 8 characters"),
  }),
  verifyOtpSchema: z.object({
    identifier: z.string({ required_error: 'Email or phone is required' }),
    otp: z.string().length(6, { message: 'OTP must be 6 digits' }),
  }),

  forgotPasswordSchema: z.object({
    phone: z.string(),
  }),

  resetPasswordSchema: z.object({
    phone: z.string(),
    otp: z.string().length(6),
    newPassword: z.string().min(8),
  }),

  refreshTokenValidationSchema: z.object({
    refreshToken: z.string({ required_error: 'Refresh Token is required!' }),
  }),

};