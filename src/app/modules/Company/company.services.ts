import httpStatus from 'http-status';
import crypto from 'crypto';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Company } from './company.model';
import { User } from '../User/user.model';
import { Module } from '../Module/module.model';
import { Team } from '../Team/team.model';
import { UserProgress } from '../UserProgress/userProgress.model';
import { BehavioralAssessment } from '../BehavioralAssessment/behavioralAssessment.model';
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
      body: `Your company account has been created. Use the temporary password below to log in. Please change your password after first login for security.`,
      otpCode: tempPassword,
      codeLabel: 'Your Temporary Password',
      codeExpiry: 'Please change this password after your first login.',
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
  const queryBuilder = new QueryBuilder(Company.find({ isDeleted: false }), query);
  queryBuilder.search(['name', 'slug']).filter().sort().paginate();
  const result = await queryBuilder.modelQuery;
  const meta = await queryBuilder.countTotal();
  return { meta, result };
};

const getSingleCompanyFromDB = async (id: string) => {
  const result = await Company.findOne({ _id: id, isDeleted: false });
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

const updateCompanyStatusInDB = async (id: string, status: string) => {
  const company = await Company.findByIdAndUpdate(
    id,
    { status },
    { new: true },
  );
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  // Sync related User accounts status
  // Users with companyId matching this company get the same status mapping
  const userStatus = status === 'active' ? 'active' : 'blocked';
  const userUpdateResult = await User.updateMany(
    { companyId: company._id },
    { status: userStatus },
  );

  console.log('[updateCompanyStatus] company:', id, '→ status:', status, '| userStatus:', userStatus, '| matched:', userUpdateResult.matchedCount, '| modified:', userUpdateResult.modifiedCount);

  return company;
};

const getDropdownCompaniesFromDB = async () => {
  return Company.find({ isDeleted: false }).select('_id name').lean();
};

const deleteCompanyFromDB = async (id: string) => {
  const company = await Company.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true },
    { new: true },
  );
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  // Soft-delete all related User accounts
  await User.updateMany(
    { companyId: company._id },
    { isDeleted: true, status: 'blocked' },
  );

  return company;
};

// ── Company Details API (Dashboard Data) ──
interface CompanyDetailsData {
  company: {
    name: string;
    industry: string;
    employeeCount: number;
    memberSince: Date;
  };
  stats: {
    activeParticipants: number;
    completionRate: number;
    organizationGrade: number;
  };
  behavioralChange: {
    baseline: Record<string, number>;
    followUp: Record<string, number>;
    metrics: string[];
  };
  teamPerformance: {
    teamId: string;
    teamName: string;
    activeCount: number;
    progressPercentage: number;
    averageScore: number;
  }[];
  moduleCompliance: {
    moduleId: string;
    moduleName: string;
    teamId: string | null;
    teamName: string;
    completionPercentage: number;
    completedCount: number;
    totalAssigned: number;
  }[];
}

const getCompanyDetailsFromDB = async (companyId: string): Promise<CompanyDetailsData> => {
  // 1. Get company basic info
  const company = await Company.findOne({ _id: companyId, isDeleted: false });
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  // 2. Get all active users for this company
  const users = await User.find({ companyId, isDeleted: false, status: 'active' })
    .select('_id teamId')
    .lean();
  const userIds = users.map((u) => u._id);
  const activeParticipants = userIds.length;

  // 3. Get teams for this company
  const teams = await Team.find({ companyId }).select('_id name').lean();
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t.name]));

  // 4. Get all modules assigned to this company's teams
  const teamIds = teams.map((t) => t._id);
  const modules = await Module.find({ teamId: { $in: teamIds }, isDeleted: false, status: 'published' })
    .select('_id title teamId')
    .lean();
  const moduleIds = modules.map((m) => m._id);

  // 5. Get UserProgress for all users in this company
  const userProgress = await UserProgress.find({ companyId, moduleId: { $in: moduleIds } })
    .select('userId moduleId status progressPercentage score completedQuestions totalQuestions')
    .lean();

  // 6. Calculate completion rate
  const totalAssignments = userIds.length * moduleIds.length;
  const completedAssignments = userProgress.filter((p) => p.status === 'completed').length;
  const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  // 7. Calculate organization grade (average of all scores)
  const scoredProgress = userProgress.filter((p) => p.score !== undefined && p.score !== null);
  const avgScore = scoredProgress.length > 0
    ? scoredProgress.reduce((sum, p) => sum + (p.score || 0), 0) / scoredProgress.length
    : 0;
  const organizationGrade = Math.round(avgScore * 10) / 10; // 0-10 scale

  // 8. Get behavioral assessments
  const [baselineMetrics, followUpMetrics, baselineOverall, followUpOverall] = await Promise.all([
    BehavioralAssessment.getCompanyMetricAverages(companyId, 'baseline'),
    BehavioralAssessment.getCompanyMetricAverages(companyId, 'follow_up'),
    BehavioralAssessment.getCompanyOverallAverage(companyId, 'baseline'),
    BehavioralAssessment.getCompanyOverallAverage(companyId, 'follow_up'),
  ]);

  // Standard metrics order for consistent display
  const standardMetrics = [
    'Social Safety',
    'Workplace Respect',
    'Inclusion & Equity',
    'Well-being',
    'Team Collaboration',
    'Conflict Resolution',
    'Leadership Skills',
  ];

  const behavioralChange = {
    baseline: standardMetrics.reduce((acc, m) => ({ ...acc, [m]: baselineMetrics[m] || 0 }), {}),
    followUp: standardMetrics.reduce((acc, m) => ({ ...acc, [m]: followUpMetrics[m] || 0 }), {}),
    metrics: standardMetrics,
  };

  // 9. Team performance
  const teamPerformance = await Promise.all(
    teams.map(async (team) => {
      const teamUserIds = users.filter((u) => u.teamId?.toString() === team._id.toString()).map((u) => u._id);
      const teamProgress = userProgress.filter((p) => teamUserIds.some((id) => id.equals(p.userId)));

      const teamCompleted = teamProgress.filter((p) => p.status === 'completed').length;
      const teamTotal = teamUserIds.length * moduleIds.length;
      const teamProgressPct = teamTotal > 0 ? Math.round((teamCompleted / teamTotal) * 100) : 0;

      const teamScored = teamProgress.filter((p) => p.score !== undefined && p.score !== null);
      const teamAvgScore = teamScored.length > 0
        ? teamScored.reduce((sum, p) => sum + (p.score || 0), 0) / teamScored.length
        : 0;

      return {
        teamId: team._id.toString(),
        teamName: team.name,
        activeCount: teamUserIds.length,
        progressPercentage: teamProgressPct,
        averageScore: Math.round(teamAvgScore * 10) / 10,
      };
    })
  );

  // 10. Module compliance (per module, showing which team it belongs to)
  const moduleCompliance = await Promise.all(
    modules.map(async (module) => {
      const moduleProgress = userProgress.filter((p) => p.moduleId.equals(module._id));
      const completed = moduleProgress.filter((p) => p.status === 'completed').length;
      const total = userIds.length;
      const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const assignedTeam = teams.find((t) => t._id.toString() === (module as any).teamId?.toString());

      return {
        moduleId: module._id.toString(),
        moduleName: module.title,
        teamId: (module as any).teamId?.toString() || null,
        teamName: assignedTeam?.name || 'Unassigned',
        completionPercentage: completionPct,
        completedCount: completed,
        totalAssigned: total,
      };
    })
  );

  return {
    company: {
      name: company.name,
      industry: company.address || 'Not specified', // Using address as industry placeholder
      employeeCount: activeParticipants,
      memberSince: company.createdAt as Date,
    },
    stats: {
      activeParticipants,
      completionRate,
      organizationGrade,
    },
    behavioralChange,
    teamPerformance,
    moduleCompliance,
  };
};

export const CompanyServices = {
  createCompanyIntoDB,
  getAllCompaniesFromDB,
  getSingleCompanyFromDB,
  updateCompanyInDB,
  updateCompanyStatusInDB,
  updateBrandingInDB,
  deleteCompanyFromDB,
  getDropdownCompaniesFromDB,
  getCompanyDetailsFromDB,
};
