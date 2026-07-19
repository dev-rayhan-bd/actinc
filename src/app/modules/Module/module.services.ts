import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { Module } from './module.model';
import QueryBuilder from '../../builder/QueryBuilder';

// ── Create Module ──
const createModuleInDB = async (payload: any, userId: string) => {
  payload.createdBy = userId;
  const result = await Module.create(payload);
  return result;
};

// ── Get All Modules (with search, filter, pagination) ──
const getAllModulesFromDB = async (query: Record<string, unknown>) => {
  const moduleQuery = new QueryBuilder(
    Module.find({ isDeleted: false }).populate('createdBy', 'firstName lastName email'),
    query,
  )
    .search(['title', 'description'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await moduleQuery.modelQuery;
  const meta = await moduleQuery.countTotal();

  return { result, meta };
};

// ── Get Single Module ──
const getModuleByIdFromDB = async (id: string) => {
  const result = await Module.findOne({ _id: id, isDeleted: false }).populate(
    'createdBy',
    'firstName lastName email',
  );

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found');
  }

  return result;
};

// ── Update Module ──
const updateModuleInDB = async (id: string, payload: any) => {
  const isExist = await Module.findOne({ _id: id, isDeleted: false });

  if (!isExist) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found');
  }

  // Handle thumbnail update — payload.thumbnailImage may come from
  // the controller after Cloudinary upload, or from req.body.data
  const result = await Module.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).populate('createdBy', 'firstName lastName email');

  return result;
};

// ── Delete Module (soft delete) ──
const deleteModuleFromDB = async (id: string) => {
  const isExist = await Module.findOne({ _id: id, isDeleted: false });

  if (!isExist) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found');
  }

  await Module.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

  return null;
};

// ── Duplicate Module ──
const duplicateModuleInDB = async (id: string, newTitle: string, userId: string) => {
  const original = await Module.findOne({ _id: id, isDeleted: false }).lean();

  if (!original) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found');
  }

  // Create a deep copy without _id and timestamps, with new title
  const duplicatedPayload = {
    title: newTitle,
    description: original.description,
    thumbnailImage: original.thumbnailImage,
    questions: original.questions.map((q: any) => {
      // Assign new unique ids to each question
      const { _id, ...rest } = q;
      return {
        ...rest,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      };
    }),
    status: 'draft' as const,
    createdBy: userId,
  };

  const result = await Module.create(duplicatedPayload);
  return result;
};

export const ModuleServices = {
  createModuleInDB,
  getAllModulesFromDB,
  getModuleByIdFromDB,
  updateModuleInDB,
  deleteModuleFromDB,
  duplicateModuleInDB,
};
