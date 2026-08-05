import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { FeaturedTrainingServices } from './featuredTraining.services';

const createFeaturedTraining = catchAsync(async (req, res) => {
  const companyId = req.user.role === 'company' ? req.user.userId : req.user.companyId;
  
  const result = await FeaturedTrainingServices.createFeaturedTraining({
    ...req.body,
    companyId,
    createdBy: req.user.userId,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Featured training created successfully',
    data: result,
  });
});

const getFeaturedTrainings = catchAsync(async (req, res) => {
  const companyId = req.user.role === 'company' ? req.user.userId : req.user.companyId;
  const result = await FeaturedTrainingServices.getCompanyFeaturedTrainings(companyId, req.user.role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Featured trainings retrieved successfully',
    data: result,
  });
});

const deleteFeaturedTraining = catchAsync(async (req, res) => {
  const companyId = req.user.role === 'company' ? req.user.userId : req.user.companyId;
  const result = await FeaturedTrainingServices.deleteFeaturedTraining(req.params.id as string, companyId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Featured training deleted successfully',
    data: result,
  });
});

export const FeaturedTrainingControllers = {
  createFeaturedTraining,
  getFeaturedTrainings,
  deleteFeaturedTraining,
};
