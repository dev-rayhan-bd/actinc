export type TLoginUser = {
  identifier: string; // Email or Phone
  password: string;
};

export type TVerifyOtp = {
  phone: string;
  otp: string;
};

export type TForgetPassword = {
  phone: string;
};

export type TResetPassword = {
  identifier: string;
  otp: string;
  newPassword: string;
};