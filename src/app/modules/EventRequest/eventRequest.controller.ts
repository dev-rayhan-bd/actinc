import httpStatus from 'http-status';
import { Types } from 'mongoose';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import uploadImage from '../../middleware/upload';
import { EventRequestServices } from './eventRequest.services';
import { createEventRequestSchema, updateEventRequestStatusSchema } from './eventRequest.validation';


/**
 * User: Post a new event requirement
 */
const createEventRequest = catchAsync(async (req, res) => {
  // Upload reference images if any (multipart/form-data)
  let imageUrls: string[] = [];
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    const uploadPromises = req.files.map((file) => uploadImage(req, file));
    imageUrls = await Promise.all(uploadPromises);
  }

  // Parse data — multipart sends JSON string in 'data' field; regular JSON uses body directly
  const rawData = req.body.data ? JSON.parse(req.body.data) : req.body;

  // Validate with Zod
  const validated = createEventRequestSchema.parse({
    body: rawData,
  });

  const payload = {
    ...validated.body,
    ...(imageUrls.length > 0 && { referenceImages: imageUrls }),
  };

  const result = await EventRequestServices.createEventRequestIntoDB(
    req.user.userId,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Event request posted successfully',
    data: result,
  });
});

/**
 * User: Get my own event requests
 */
const getMyEventRequests = catchAsync(async (req, res) => {
  const result = await EventRequestServices.getMyEventRequestsFromDB(
    req.user.userId,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Your event requests retrieved successfully',
    data: result,
  });
});

/**
 * User: Get single event request detail
 */
const getSingleEventRequest = catchAsync(async (req, res) => {
  const result = await EventRequestServices.getSingleEventRequestFromDB(
    req.user.userId,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Event request retrieved successfully',
    data: result,
  });
});

/**
 * Vendor: Get all active event requests (All Posts)
 */
const getAllActiveEventRequests = catchAsync(async (req, res) => {
  const result = await EventRequestServices.getAllActiveEventRequestsFromDB(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Active event requests retrieved successfully',
    data: result,
  });
});

/**
 * Vendor: Get single event request detail for bidding
 */
const getEventRequestDetailForVendor = catchAsync(async (req, res) => {
  const result = await EventRequestServices.getEventRequestDetailForVendorFromDB(
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Event request detail retrieved successfully',
    data: result,
  });
});

/**
 * User: Update event request status (close/cancel)
 */
const updateEventRequestStatus = catchAsync(async (req, res) => {
  const validated =updateEventRequestStatusSchema.parse({
    body: req.body,
  });

  const result = await EventRequestServices.updateEventRequestStatusFromDB(
    req.user.userId,
    req.params.id as string,
    validated.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Event request status updated',
    data: result,
  });
});

/**
 * User: Cancel an event request (dedicated endpoint)
 */
const cancelEventRequest = catchAsync(async (req, res) => {
  const result = await EventRequestServices.updateEventRequestStatusFromDB(
    req.user.userId,
    req.params.id as string,
    'cancelled',
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Event request cancelled successfully',
    data: result,
  });
});

export const EventRequestControllers = {
  createEventRequest,
  getMyEventRequests,
  getSingleEventRequest,
  getAllActiveEventRequests,
  getEventRequestDetailForVendor,
  updateEventRequestStatus,
  cancelEventRequest,
};
