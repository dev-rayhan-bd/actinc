import twilio from 'twilio';
import config from '../config';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';

let client: ReturnType<typeof twilio> | null = null;

const getClient = () => {
  if (!client) {
    client = twilio(config.twilio_sid, config.twilio_auth_token);
  }
  return client;
};

export const sendOTP = async (to: string, otp: string) => {
  try {
    const result = await getClient().messages.create({
      body: `Your WePlan verification code is: ${otp}. Valid for 10 minutes.`,
      from: config.twilio_phone_number,
      to: to,
    });
    return result;
  } catch (error: any) {

    throw new AppError(
      httpStatus.BAD_GATEWAY, 
      `Twilio SMS Service Error: ${error.message}`
    );
  }
};