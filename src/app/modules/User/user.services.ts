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

const getMeFromDB = async (userId: string, role: string) => {
  let result = null;
  if (role === 'admin' || role === 'superAdmin') {
    result = await Admin.findById(userId);
  } else {
    result = await User.findById(userId);
  }
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User profile not found!');
  }
  return result;
};

export const UserServices = {
  getAllUsersFromDB,
  updateProfileInDB,
  getMeFromDB,
};