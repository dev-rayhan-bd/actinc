import httpStatus from 'http-status'
import AppError from '../../errors/AppError';
import { Admin } from '../Admin/admin.model';
import { User } from './user.model';
import QueryBuilder from '../../builder/QueryBuilder';

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ isDeleted: false }), query)
    .search(['firstName', 'lastName', 'email', 'phone', 'employeeId'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  return { meta, result };
};

const updateProfileInDB = async (userId: string, payload: any) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');

  // Strip restricted fields
  delete payload.role;
  delete payload.password;
  delete payload.email;
  delete payload.isOtpVerified;
  delete payload.isDeleted;
  delete payload.authType;

  payload.lastActiveAt = new Date();

  return await User.findByIdAndUpdate(userId, payload, { new: true, runValidators: true });
};

const defaultBranding = {
  primaryColor: '#8ACDDE',
  secondaryColor: '#E9308F',
  videoTitle: '',
  videoDescription: '',
  presenterName: '',
  presenterDesignation: '',
  videoUrl: '',
};

const getMeFromDB = async (userId: string, role: string) => {
  let result: any = null;
  if (role === 'admin' || role === 'superAdmin') {
    result = await Admin.findById(userId);
    return result;
  }

  result = await User.findById(userId);
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User profile not found!');
  }

  const userObj = result.toObject ? result.toObject() : { ...result };

  // If regular user assigned to a company, fetch that company's branding
  if (role === 'user' && result.companyId) {
    const company = await User.findById(result.companyId).select('branding');
    const compBranding: any = company?.branding || {};

    userObj.branding = {
      primaryColor: compBranding.primaryColor || defaultBranding.primaryColor,
      secondaryColor: compBranding.secondaryColor || defaultBranding.secondaryColor,
      videoTitle: compBranding.videoTitle || defaultBranding.videoTitle,
      videoDescription: compBranding.videoDescription || defaultBranding.videoDescription,
      presenterName: compBranding.presenterName || defaultBranding.presenterName,
      presenterDesignation: compBranding.presenterDesignation || defaultBranding.presenterDesignation,
      videoUrl: compBranding.videoUrl || defaultBranding.videoUrl,
    };
  } else if (role === 'company') {
    const compBranding: any = result.branding || {};
    userObj.branding = {
      primaryColor: compBranding.primaryColor || defaultBranding.primaryColor,
      secondaryColor: compBranding.secondaryColor || defaultBranding.secondaryColor,
      videoTitle: compBranding.videoTitle || defaultBranding.videoTitle,
      videoDescription: compBranding.videoDescription || defaultBranding.videoDescription,
      presenterName: compBranding.presenterName || defaultBranding.presenterName,
      presenterDesignation: compBranding.presenterDesignation || defaultBranding.presenterDesignation,
      videoUrl: compBranding.videoUrl || defaultBranding.videoUrl,
    };
  }

  return userObj;
};

const getUsersByCompany = async (companyId: string, query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(
    User.find({ companyId, role: 'user', isDeleted: false }).select('-password -otp -otpExpires'),
    query,
  )
    .search(['firstName', 'lastName', 'email', 'phone', 'employeeId'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  return { meta, result };
};

export const UserServices = {
  getAllUsersFromDB,
  updateProfileInDB,
  getMeFromDB,
  getUsersByCompany,
};