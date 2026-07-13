import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.services';
import uploadImage from '../../middleware/upload';
import  httpStatus  from 'http-status';

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

  const result = await UserServices.updateProfileInDB(req.user.userId, payload);
  sendResponse(res, { statusCode: 200, success: true, message: 'Profile updated', data: result });
});

const setupProfile = catchAsync(async (req, res) => {
  let imageUrl;
  if (req.file) imageUrl = await uploadImage(req);

  const data = JSON.parse(req.body.data);
  const payload = { ...data, image: imageUrl };

  const result = await UserServices.updateProfileInDB(req.user.userId, payload);
  sendResponse(res, { statusCode: 200, success: true, message: 'Profile set up successfully', data: result });
});

const updatePortfolio = catchAsync(async (req, res) => {
  const files = req.files as any;
  const portfolioUrls = [];
  
  if (files) {
    for (const file of files) {
      portfolioUrls.push(await uploadImage(req, file));
    }
  }

  const result = await UserServices.updateProfileInDB(req.user.userId, {
    $push: { 'vendor.portfolio': { $each: portfolioUrls } }
  } as any);

  sendResponse(res, { statusCode: 200, success: true, message: 'Portfolio updated', data: result });
});

const updateAvailability = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const { availability } = req.body;

  const result = await UserServices.manageAvailabilityInDB(userId, availability);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Availability schedule updated',
    data: result,
  });
});

const becomeVendorRequest = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const vendorData = req.body;

  const result = await UserServices.applyToBecomeVendor(userId, vendorData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Application submitted. Pending admin approval.',
    data: result,
  });
});

const getMe = catchAsync(async (req, res) => {
  const { userId } = req.user; 
    const role = req.user.role;
  const result = await UserServices.getMeFromDB(userId,role);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

const updateAvailabilityStatus = catchAsync(async (req, res) => {
  const result = await UserServices.updateVendorAvailabilityInDB(
    req.user.userId,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Date marked as ${req.body.status}`,
    data: result,
  });
});

// ══════════════════════════════════════════════
//  PUBLIC: GET SINGLE VENDOR PROFILE
// ══════════════════════════════════════════════

const getVendorProfile = catchAsync(async (req, res) => {
  const vendorId = req.params.vendorId as string;
  const result = await UserServices.getVendorProfileFromDB(vendorId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Vendor profile retrieved successfully',
    data: result,
  });
});

// ══════════════════════════════════════════════
//  VISIBILITY SCORE
// ══════════════════════════════════════════════

const getMyVisibilityTasks = catchAsync(async (req, res) => {
  const result = await UserServices.getMyVisibilityTasksFromDB(req.user.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Visibility tasks retrieved',
    data: result,
  });
});

export const UserControllers = {
  getAllUsers,
  updateProfile,
  setupProfile,
  updatePortfolio,
  updateAvailability,
  becomeVendorRequest,
  getMe,
  updateAvailabilityStatus,
  getVendorProfile,
  getMyVisibilityTasks,
};