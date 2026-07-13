import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { EventRequest } from './eventRequest.model';
import { EventQuote } from '../EventQuote/eventQuote.model';
import { User } from '../User/user.model';
import { sendNotification, sendNotificationToMultipleUsers } from '../../utils/sendNotification';

/**
 * User: Create a new event request (post requirement)
 */
const createEventRequestIntoDB = async (userId: string, payload: Record<string, unknown>) => {
  const requestData = {
    user: new Types.ObjectId(userId),
    eventType: new Types.ObjectId(payload.eventType as string),
    eventDate: new Date(payload.eventDate as string),
    guestCount: payload.guestCount as number,
    budgetMin: payload.budgetMin as number,
    budgetMax: payload.budgetMax as number,
    area: new Types.ObjectId(payload.area as string),
    serviceCategory: new Types.ObjectId(payload.serviceCategory as string),
    additionalDetails: payload.additionalDetails as string,
    referenceImages: payload.referenceImages as string[],
  };

  const result = await EventRequest.create(requestData);

  // ── Push notification to relevant vendors ──
  try {
    const relevantVendors = await User.find({
      role: 'vendor',
      status: 'active',
      isDeleted: false,
      'vendor.categories': payload.serviceCategory as string,
      'vendor.serviceArea': payload.area as string,
    }).select('_id');

    if (relevantVendors.length > 0) {
      sendNotificationToMultipleUsers(
        relevantVendors.map((v) => v._id.toString()),
        '⏳ New Project Posted!',
        'Submit your quotation before others take the lead!',
        'new_requirement',
        { eventRequestId: result._id.toString(), action: 'new_requirement' },
      );
    }
  } catch (error) {
    console.error('❌ Error sending new-requirement vendor notification:', error);
  }

  return result;
};

/**
 * User: Get my own event requests
 */
const getMyEventRequestsFromDB = async (userId: string, query: Record<string, unknown>) => {
  const serviceQuery = new QueryBuilder(
    EventRequest.find({ user: new Types.ObjectId(userId) })
      .populate('eventType', 'name image')
      .populate('area', 'name region')
      .populate('serviceCategory', 'name image')
      .sort('-createdAt'),
    query,
  )
    .filter()
    .paginate()
    .fields();

  const result = await serviceQuery.modelQuery;
  const meta = await serviceQuery.countTotal();
  return { meta, result };
};

/**
 * User: Get single event request detail (own requests only)
 */
const getSingleEventRequestFromDB = async (userId: string, requestId: string) => {
  const result = await EventRequest.findOne({
    _id: new Types.ObjectId(requestId),
    user: new Types.ObjectId(userId),
  })
    .populate('eventType', 'name image')
    .populate('area', 'name region')
    .populate('serviceCategory', 'name image');
  if (!result) throw new AppError(httpStatus.NOT_FOUND, 'Event request not found');
  return result;
};

/**
 * Vendor: Get all active event requests (for "All Posts" / bidding page)
 */
const getAllActiveEventRequestsFromDB = async (query: Record<string, unknown>) => {
  const serviceQuery = new QueryBuilder(
    EventRequest.find({ status: 'active' })
      .populate('user', 'firstName lastName image')
      .populate('eventType', 'name image')
      .populate('area', 'name region')
      .populate('serviceCategory', 'name image'),
    query,
  )
    .search(['additionalDetails'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await serviceQuery.modelQuery;
  const meta = await serviceQuery.countTotal();
  return { meta, result };
};

/**
 * Vendor: Get single event request detail (for viewing before bidding)
 */
const getEventRequestDetailForVendorFromDB = async (requestId: string) => {
  const result = await EventRequest.findById(requestId)
    .populate('user', 'firstName lastName image')
    .populate('eventType', 'name image')
    .populate('area', 'name region')
    .populate('serviceCategory', 'name image');
  if (!result) throw new AppError(httpStatus.NOT_FOUND, 'Event request not found');
  return result;
};

/**
 * User: Update event request status (close/cancel)
 */
const updateEventRequestStatusFromDB = async (
  userId: string,
  requestId: string,
  status: string,
) => {
  const eventRequest = await EventRequest.findOne({
    _id: new Types.ObjectId(requestId),
    user: new Types.ObjectId(userId),
  });
  if (!eventRequest) throw new AppError(httpStatus.NOT_FOUND, 'Event request not found or unauthorized');

  // Prevent changing already closed/cancelled requests
  if (eventRequest.status === 'closed' || eventRequest.status === 'cancelled') {
    throw new AppError(httpStatus.BAD_REQUEST, `This event request is already ${eventRequest.status}`);
  }

  // If cancelling, decline all associated quotes and notify vendors
  if (status === 'cancelled') {
    const pendingQuotes = await EventQuote.find({
      eventRequest: eventRequest._id,
      status: { $in: ['pending', 'countered'] },
    });

    await EventQuote.updateMany(
      { eventRequest: eventRequest._id, status: { $in: ['pending', 'countered'] } },
      { status: 'declined' },
    );

    // Notify all vendors whose quotes are being declined due to cancellation
    for (const quote of pendingQuotes) {
      sendNotification(
        quote.vendor.toString(),
        'Event Request Cancelled',
        `The client has cancelled their event request. Your quote of PKR ${(quote.quoteAmount ?? 0).toLocaleString()} has been declined.`,
        'request_cancelled',
        { eventRequestId: eventRequest._id.toString(), quoteId: quote._id.toString(), action: 'request_cancelled' }
      );
    }

    // Notify the user
    sendNotification(
      userId,
      'Event Request Cancelled',
      'Your event request has been cancelled successfully.',
      'request_cancelled',
      { eventRequestId: eventRequest._id.toString(), action: 'request_cancelled' }
    );
  }

  eventRequest.status = status as import('./eventRequest.interface').TEventRequestStatus;
  await eventRequest.save();

  return eventRequest;
};

export const EventRequestServices = {
  createEventRequestIntoDB,
  getMyEventRequestsFromDB,
  getSingleEventRequestFromDB,
  getAllActiveEventRequestsFromDB,
  getEventRequestDetailForVendorFromDB,
  updateEventRequestStatusFromDB,
};
