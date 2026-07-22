import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ModuleServices } from './module.services';
import uploadImage from '../../middleware/upload';

// ── Create Module (supports multipart for thumbnail) ──
const createModule = catchAsync(async (req, res) => {
  let thumbnailUrl: string | undefined;

  if (req.file) {
    thumbnailUrl = await uploadImage(req);
  }

  // If multipart, data comes as JSON string in req.body.data
  const data = req.body.data ? JSON.parse(req.body.data) : req.body;
  const payload = { ...data, ...(thumbnailUrl && { thumbnailImage: thumbnailUrl }) };

  const result = await ModuleServices.createModuleInDB(payload, req.user.userId!);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Module created successfully',
    data: result,
  });
});

// ── Get All Modules ──
const getAllModules = catchAsync(async (req, res) => {
  const result = await ModuleServices.getAllModulesFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Modules retrieved successfully',
    data: result.result,
    meta: result.meta,
  });
});

// ── Get Single Module ──
const getModuleById = catchAsync(async (req, res) => {
  const result = await ModuleServices.getModuleByIdFromDB(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module retrieved successfully',
    data: result,
  });
});

// ── Update Module (supports multipart for thumbnail) ──
const updateModule = catchAsync(async (req, res) => {
  let thumbnailUrl: string | undefined;

  if (req.file) {
    thumbnailUrl = await uploadImage(req);
  }

  // If multipart, data comes as JSON string in req.body.data
  const data = req.body.data ? JSON.parse(req.body.data) : req.body;
  const payload = { ...data, ...(thumbnailUrl && { thumbnailImage: thumbnailUrl }) };

  const result = await ModuleServices.updateModuleInDB(req.params.id as string, payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module updated successfully',
    data: result,
  });
});

// ── Delete Module ──
const deleteModule = catchAsync(async (req, res) => {
  await ModuleServices.deleteModuleFromDB(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module deleted successfully',
    data: null,
  });
});

// ── Duplicate Module ──
const duplicateModule = catchAsync(async (req, res) => {
  const result = await ModuleServices.duplicateModuleInDB(
    req.params.id as string,
    req.body.title,
    req.user.userId!,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Module duplicated successfully',
    data: result,
  });
});

// ── Assign Modules to Company ──
const assignModulesToCompany = catchAsync(async (req, res) => {
  const result = await ModuleServices.assignModulesToCompany(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Modules assigned to company successfully',
    data: result,
  });
});

// ── Unassign Module from Company ──
const unassignModuleFromCompany = catchAsync(async (req, res) => {
  const result = await ModuleServices.unassignModuleFromCompany(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Module unassigned from company successfully',
    data: result,
  });
});

// ── Get Modules by Company ──
const getModulesByCompany = catchAsync(async (req, res) => {
  const result = await ModuleServices.getModulesByCompany(req.params.companyId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company modules retrieved successfully',
    data: result,
  });
});

export const ModuleControllers = {
  createModule,
  getAllModules,
  getModuleById,
  updateModule,
  deleteModule,
  duplicateModule,
  assignModulesToCompany,
  unassignModuleFromCompany,
  getModulesByCompany,
};
