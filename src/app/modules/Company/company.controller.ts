import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CompanyServices } from './company.services';
import uploadImage from '../../middleware/upload';

const createCompany = catchAsync(async (req, res) => {
  const { company, tempPassword } = await CompanyServices.createCompanyIntoDB(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Company created successfully. Login credentials have been sent to the company email.',
    data: {
      company,
      tempPassword, // admin can see it — credentials also sent via email
    },
  });
});

const getAllCompanies = catchAsync(async (req, res) => {
  const result = await CompanyServices.getAllCompaniesFromDB(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Companies retrieved successfully',
    data: result,
  });
});

const getSingleCompany = catchAsync(async (req, res) => {
  const result = await CompanyServices.getSingleCompanyFromDB(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company retrieved successfully',
    data: result,
  });
});

const updateCompany = catchAsync(async (req, res) => {
  const result = await CompanyServices.updateCompanyInDB(req.params.id as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company updated successfully',
    data: result,
  });
});

// ── Branding update: supports multipart/form-data (logo + video + JSON fields) ──
const updateBranding = catchAsync(async (req, res) => {
  // Parse JSON from multipart/form-data if wrapped in `data` field
  const bodyData = req.body.data ? JSON.parse(req.body.data) : req.body;
  const payload: Record<string, any> = { ...bodyData };

  // Upload logo if provided (field name: "logo")
  if (req.files && (req.files as any).logo) {
    const logoUrl = await uploadImage(req, (req.files as any).logo[0]);
    payload.logo = logoUrl;

    // Also update the company's top-level logo field
    await CompanyServices.updateCompanyInDB(req.params.id as string, { logo: logoUrl } as any);
  }

  // Upload onboarding video if provided (field name: "video")
  if (req.files && (req.files as any).video) {
    const videoUrl = await uploadImage(req, (req.files as any).video[0]);
    payload.videoUrl = videoUrl;
  }

  const result = await CompanyServices.updateBrandingInDB(req.params.id as string, payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company branding updated successfully',
    data: result,
  });
});

const updateCompanyStatus = catchAsync(async (req, res) => {
  const result = await CompanyServices.updateCompanyStatusInDB(req.params.id as string, req.body.status);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company status updated successfully',
    data: result,
  });
});

const deleteCompany = catchAsync(async (req, res) => {
  const result = await CompanyServices.deleteCompanyFromDB(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Company deleted successfully',
    data: result,
  });
});

export const CompanyControllers = {
  createCompany,
  getAllCompanies,
  getSingleCompany,
  updateCompany,
  updateCompanyStatus,
  updateBranding,
  deleteCompany,
};
