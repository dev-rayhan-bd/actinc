import express, { RequestHandler } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../Auth/auth.constant';
import { EventRequestControllers } from './eventRequest.controller';
import { upload } from '../../middleware/multer';

const router = express.Router();

const uploadImages = upload.array('referenceImages', 5) as unknown as RequestHandler;

// ── User Routes ──

// Post a new event requirement
router.post(
  '/',
  auth(USER_ROLE.user),
  uploadImages,
  EventRequestControllers.createEventRequest,
);

// Get my own event requests
router.get(
  '/my-requests',
  auth(USER_ROLE.user),
  EventRequestControllers.getMyEventRequests,
);

// Get single event request detail (own only)
router.get(
  '/my-requests/:id',
  auth(USER_ROLE.user),
  EventRequestControllers.getSingleEventRequest,
);

// Update event request status (close/cancel)
router.patch(
  '/my-requests/:id/status',
  auth(USER_ROLE.user),
  EventRequestControllers.updateEventRequestStatus,
);

// Cancel an event request (dedicated endpoint)
router.patch(
  '/my-requests/:id/cancel',
  auth(USER_ROLE.user),
  EventRequestControllers.cancelEventRequest,
);

// ── Vendor Routes ──

// Get all active event requests (for bidding - All Posts)
router.get(
  '/all',
  auth(USER_ROLE.vendor),
  EventRequestControllers.getAllActiveEventRequests,
);

// Get single event request detail for vendor (before sending quote)
router.get(
  '/vendor/:id',
  auth(USER_ROLE.vendor),
  EventRequestControllers.getEventRequestDetailForVendor,
);

export const EventRequestRoutes = router;
