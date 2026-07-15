import httpStatus from 'http-status';
import crypto from 'crypto';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Company } from './company.model';
import { User } from '../User/user.model';
import { TCompany } from './company.interface';
import { getEmailTemplate } from '../../utils/emailTemplate';
import sendEmail from '../../utils/sendEmail';

// Auto-generate a human-readable temp password
const generateTempPassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';

  // Ensure at least one of each type
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += '!';
  // Fill remaining 6 chars randomly
  for (let i = 0; i < 6; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Slugify a company name
const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-');
};

const createCompanyIntoDB = async (payload: { name: string; email: string; address?: string }) => {
  const { name, email, address } = payload;

  // Check email uniqueness across Company + User collections
  const existingCompany = await Company.findOne({ email: email.toLowerCase() });
  if (existingCompany) {
    throw new AppError(httpStatus.CONFLICT, 'A company with this email already exists');
  }
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError(httpStatus.CONFLICT, 'This email is already registered as a user');
  }

  // Auto-generate slug — append suffix if conflict
  let slug = slugify(name);
  let slugCounter = 1;
  while (await Company.findOne({ slug })) {
    slug = `${slugify(name)}-${slugCounter++}`;
  }

  // Auto-generate temp password
  const tempPassword = generateTempPassword();

  // 1) Create Company record
  const company = await Company.create({
    name,
    email: email.toLowerCase(),
    address: address || '',
    slug,
    status: 'active',
  });

  // 2) Create User login account (role: company)
  try {
    await User.create({
      firstName: name,
      email: email.toLowerCase(),
      password: tempPassword,
      role: 'company',
      authType: 'email',
      companyId: company._id,
      status: 'active',
      isOtpVerified: true,
    });
  } catch (userError: any) {
    // Rollback: delete the Company we just created
    await Company.findByIdAndDelete(company._id);
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create company login account: ${userError?.message || userError}`,
    );
  }

  // 3) Send credentials email
  try {
    const html = getEmailTemplate({
      userName: name,
      title: 'Your Company Account is Ready!',
      body: `Your company account has been created. Use the credentials below to log in.\n\nPlease change your password after first login for security.`,
      otpCode: tempPassword,
    });
    await sendEmail({
      to: email,
      subject: 'Your ActInc Company Login Credentials',
      html,
    });
    console.log('✅ Company credentials sent to:', email);
  } catch (emailError: any) {
    console.error('❌ Failed to send company credentials email:', emailError?.message || emailError);
    // Don't fail the whole operation — company is created, email failure is logged
  }

  return {
    company,
    tempPassword, // returned so admin can see it (not sent in response to client)
  };
};

const getAllCompaniesFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(Company.find(), query);
  queryBuilder.search(['name', 'slug']).filter().sort().paginate();
  const result = await queryBuilder.modelQuery;
  const meta = await queryBuilder.countTotal();
  return { meta, result };
};

const getSingleCompanyFromDB = async (id: string) => {
  const result = await Company.findById(id);
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }
  return result;
};

const updateCompanyInDB = async (id: string, payload: Partial<TCompany>) => {
  if (payload.slug) {
    const existing = await Company.findOne({ slug: payload.slug, _id: { $ne: id } });
    if (existing) {
      throw new AppError(httpStatus.CONFLICT, 'A company with this slug already exists');
    }
  }
  const result = await Company.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }
  return result;
};

const updateBrandingInDB = async (id: string, payload: Record<string, any>) => {
  // Build $set for nested branding fields
  const setFields: Record<string, any> = {};
  const allowedFields = [
    'primaryColor', 'secondaryColor', 'videoTitle',
    'videoDescription', 'presenterName', 'presenterDesignation', 'videoUrl',
  ];
  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      setFields[`branding.${field}`] = payload[field];
    }
  }

  const result = await Company.findByIdAndUpdate(
    id,
    { $set: setFields },
    { new: true, runValidators: true },
  );
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }
  return result;
};

const softDeleteCompanyFromDB = async (id: string) => {
  const result = await Company.findByIdAndUpdate(
    id,
    { status: 'inactive' },
    { new: true },
  );
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }
  return result;
};

export const CompanyServices = {
  createCompanyIntoDB,
  getAllCompaniesFromDB,
  getSingleCompanyFromDB,
  updateCompanyInDB,
  updateBrandingInDB,
  softDeleteCompanyFromDB,
};
