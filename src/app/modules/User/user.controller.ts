import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.services';
import uploadImage from '../../middleware/upload';

const getAllUsers = catchAsync(async (req, res) => {
  const result = await UserServices.getAllUsersFromDB(req.query);
  sendResponse(res, { statusCode: 200, success: true, message: 'Users retrieved', data: result });
});

const updateProfile = catchAsync(async (req, res) => {
  let imageUrl;
  if (req.file) {
    imageUrl = await uploadImage(req);
  }

  const data = req.body.data ? JSON.parse(req.body.data) : req.body;
  const payload = { ...data, image: imageUrl };

  const result = await UserServices.updateProfileInDB(req.user.userId!, payload);
  sendResponse(res, { statusCode: 200, success: true, message: 'Profile updated', data: result });
});

const setupProfile = catchAsync(async (req, res) => {
  let imageUrl;
  if (req.file) imageUrl = await uploadImage(req);

  const data = JSON.parse(req.body.data);
  const payload = { ...data, image: imageUrl };

  const result = await UserServices.updateProfileInDB(req.user.userId!, payload);
  sendResponse(res, { statusCode: 200, success: true, message: 'Profile set up successfully', data: result });
});

const getMe = catchAsync(async (req, res) => {
  const { userId } = req.user; 
    const role = req.user.role;
  const result = await UserServices.getMeFromDB(userId!, role);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

export const UserControllers = {
  getAllUsers,
  updateProfile,
  setupProfile,
  getMe,
};