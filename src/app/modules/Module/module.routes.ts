import express from 'express';
import validateRequest from '../../middleware/validateRequest';
import auth from '../../middleware/auth';
import { upload } from '../../middleware/multer';
import { ModuleControllers } from './module.controller';
import { ModuleValidation } from './module.validation';
import { USER_ROLE } from '../Auth/auth.constant';

const router = express.Router();

// ── Create Module (multipart for thumbnail image) ──
router.post(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  upload.single('thumbnailImage') as any,
  ModuleControllers.createModule,
);

// ── Duplicate Module ──
router.post(
  '/duplicate/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  validateRequest(ModuleValidation.duplicateModuleSchema),
  ModuleControllers.duplicateModule,
);

// ── Get All Modules ──
router.get(
  '/',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  ModuleControllers.getAllModules,
);

// ── Get Single Module ──
router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  ModuleControllers.getModuleById,
);

// ── Update Module (multipart for thumbnail image) ──
router.patch(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  upload.single('thumbnailImage') as any,
  ModuleControllers.updateModule,
);

// ── Delete Module ──
router.delete(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.superAdmin),
  ModuleControllers.deleteModule,
);

export const ModuleRoutes = router;
