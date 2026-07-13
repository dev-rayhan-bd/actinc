import express from 'express';
import auth from '../../middleware/auth';
import { UserControllers } from './user.controller';
import { upload } from '../../middleware/multer';

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// Admin / SuperAdmin Routes
// ──────────────────────────────────────────────────────────────
router.get('/', auth('admin', 'superAdmin'), UserControllers.getAllUsers);

// ──────────────────────────────────────────────────────────────
// Authenticated User / Vendor Routes
// ──────────────────────────────────────────────────────────────
router.get(
  '/me',
  auth('user', 'vendor', 'admin', 'superAdmin'),
  UserControllers.getMe
);

router.patch(
  '/update-me',
  auth('user', 'vendor'),
  upload.single('image') as any,
  UserControllers.updateProfile
);

router.patch(
  '/setup-profile',
  auth('user', 'vendor'),
  upload.single('image') as any,
  UserControllers.setupProfile
);

// ──────────────────────────────────────────────────────────────
// Vendor-Only Routes
// ──────────────────────────────────────────────────────────────
router.patch(
  '/update-portfolio',
  auth('vendor'),
  upload.array('portfolio', 10) as any,
  UserControllers.updatePortfolio
);

router.post(
  '/become-vendor',
  auth('user'),
  UserControllers.becomeVendorRequest
);

router.patch('/manage-availability', auth('vendor'), UserControllers.updateAvailability);

router.patch(
  '/update-availability',
  auth('vendor'),
  UserControllers.updateAvailabilityStatus
);

// ──────────────────────────────────────────────────────────────
// Visibility Score Routes
// ──────────────────────────────────────────────────────────────
router.get(
  '/me/visibility-tasks',
  auth('vendor'),
  UserControllers.getMyVisibilityTasks,
);

// ──────────────────────────────────────────────────────────────
// Public Routes
// ──────────────────────────────────────────────────────────────
router.get(
  '/public/vendor/:vendorId',
  UserControllers.getVendorProfile
);

export const UserRoutes = router;