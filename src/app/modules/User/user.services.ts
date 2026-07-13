import { Types } from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import { User } from './user.model';
import httpStatus from 'http-status'
import AppError from '../../errors/AppError';
import { Admin } from '../Admin/admin.model';
import { sendNotification, sendNotificationToAdmins } from '../../utils/sendNotification';
import { VendorService } from '../VendorService/vendorService.model';
import { ServicePackage } from '../ServicePackage/package.model';
import { VendorQuote } from '../VendorQuote/vendorQuote.model';
import { VendorPromotion } from '../Promotion/promotion.model';
import {
  VISIBILITY_POINTS,
  VISIBILITY_TASKS,
  MAX_VISIBILITY_SCORE,
  VisibilityTaskKey,
} from '../../constants/visibility';

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ isDeleted: false }), query)
    .search(['firstName', 'lastName', 'email', 'phone'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  return { meta, result };
};

const updateProfileInDB = async (userId: string, payload: any) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');
  delete payload.role;
  delete payload.password;
  delete payload.email;
  delete payload.isOtpVerified;

  // ── Security: Strip restricted fields that users must not set ──
  delete payload.isSponsored;
  delete payload.isFeatured;
  delete payload.isDeleted;
  if (payload.vendor) {
    delete payload.vendor.isVerifiedBadge;
    delete payload.vendor.isProfileCompleted;
    delete payload.vendor.profileScore;
    delete payload.vendor.passwordChangedAt;
  }

  if (user.role === 'vendor') {
    // Update lastActiveAt
    payload.lastActiveAt = new Date();

    // Delegate visibility score to the centralized system (fire-and-forget)
    const previousScore = user.vendor?.profileScore ?? 0;
    calculateAndUpdateVisibilityScore(userId).then((newScore) => {
      if (newScore !== undefined && previousScore !== newScore) {
        _triggerProfileScoreChanged(userId, previousScore, newScore);
      }
    });
  }

  return await User.findByIdAndUpdate(userId, payload, { new: true, runValidators: true });
};

const manageAvailabilityInDB = async (userId: string, availability: any) => {
  return await User.findByIdAndUpdate(userId, { 'vendor.availability': availability }, { new: true });
};

const applyToBecomeVendor = async (userId: string, vendorData: any) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found');
  if (user.role === 'vendor') throw new AppError(400, 'You are already a vendor');

  const result = await User.findByIdAndUpdate(
    userId,
    {
      status: 'pending',
      vendor: {
        ...vendorData,
        profileScore: 40,
      }
    },
    { new: true, runValidators: true }
  );

  // Fire-and-forget: notify admins + applicant
  sendNotificationToAdmins(
    'New Vendor Application',
    `${user.firstName} ${user.lastName} (${user.email}) has applied to become a vendor.`,
    'vendor_application',
    { userId, action: 'vendor_application' }
  );
  sendNotification(
    userId,
    'Application Received',
    'Your vendor application has been submitted. You will be notified once reviewed.',
    'vendor_application',
    { action: 'vendor_application' }
  );

  return result;
};

const getMeFromDB = async (userId: string, role: string) => {
  let result = null;
  if (role === 'admin' || role === 'superAdmin') {
    result = await Admin.findById(userId);
  } else {
    result = await User.findById(userId);
  }
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User profile not found!');
  }
  return result;
};

const updateVendorAvailabilityInDB = async (
  userId: string,
  payload: { date: string; status: string }
) => {
  const { date, status } = payload;
  const user = await User.findById(userId);
  if (!user || user.role !== 'vendor') {
    throw new AppError(404, 'Vendor not found');
  }

  let updateQuery;
  const currentStatus = status.toLowerCase();

  if (currentStatus === 'booked') {
    updateQuery = { $addToSet: { 'vendor.bookedDates': date } };
  } else if (currentStatus === 'available') {
    updateQuery = { $pull: { 'vendor.bookedDates': date } };
  } else {
    throw new AppError(400, 'Invalid status. Use "booked" or "available"');
  }

  const result = await User.findByIdAndUpdate(userId, updateQuery, { new: true, runValidators: true });

  sendNotification(
    userId,
    'Availability Updated',
    `Your date ${date} has been marked as ${currentStatus}.`,
    'availability_update',
    { date, status: currentStatus, action: 'availability_update' }
  );

  return result;
};

// ──────────────────────────────────────────────────────────────
// Fire-and-Forget Notification Triggers (exported)
// ──────────────────────────────────────────────────────────────

const _triggerProfileScoreChanged = async (userId: string, oldScore: number, newScore: number) => {
  const direction = newScore > oldScore ? 'increased' : 'decreased';
  sendNotification(
    userId,
    'Profile Score Updated',
    `Your vendor profile score has ${direction} from ${oldScore} to ${newScore}.`,
    'profile_score_changed',
    { oldScore: String(oldScore), newScore: String(newScore), action: 'profile_score_changed' }
  );
};

const triggerNewReviewNotification = async (vendorId: string, reviewerName: string, rating: number) => {
  sendNotification(
    vendorId,
    'New Review Received',
    `${reviewerName} left you a ${rating}-star review.`,
    'new_review',
    { reviewerName, rating: String(rating), action: 'new_review' }
  );
};

const triggerVendorApprovalNotification = async (vendorId: string, approved: boolean, reason?: string) => {
  if (approved) {
    sendNotification(
      vendorId,
      'Vendor Application Approved! 🎉',
      'Congratulations! Your vendor application has been approved. Your profile is now active.',
      'vendor_approved',
      { action: 'vendor_approved' }
    );
  } else {
    sendNotification(
      vendorId,
      'Vendor Application Update',
      `Your vendor application was not approved.${reason ? ` Reason: ${reason}` : ' Please contact support for details.'}`,
      'vendor_rejected',
      { action: 'vendor_rejected', reason: reason || '' }
    );
  }
};

const triggerVendorVerificationNotification = async (vendorId: string) => {
  sendNotification(
    vendorId,
    'Profile Verified ✓',
    'Your business documents have been verified. A verification badge has been added to your profile.',
    'vendor_verification',
    { action: 'vendor_verification' }
  );
};

const triggerBookingNotification = async (vendorId: string, date: string, customerName: string) => {
  sendNotification(
    vendorId,
    'New Booking',
    `${customerName} has booked your services for ${date}.`,
    'booking_update',
    { date, customerName, action: 'booking_update' }
  );
};

// ══════════════════════════════════════════════
//  PUBLIC: GET SINGLE VENDOR PROFILE
// ══════════════════════════════════════════════

const getVendorProfileFromDB = async (vendorId: string) => {
  const vendor = await User.findOne({
    _id: new Types.ObjectId(vendorId),
    role: 'vendor',
    isDeleted: false,
    status: 'active',
  }).select(
    'firstName lastName fullName image lat long role vendor.businessName vendor.ownerName vendor.whatsappNumber vendor.location vendor.businessDetails vendor.experienceYears vendor.teamSize vendor.socialLinks vendor.googleMapLink vendor.categories vendor.serviceArea vendor.portfolio vendor.profileScore vendor.isVerifiedBadge vendor.isProfileCompleted createdAt',
  );

  if (!vendor) {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found');
  }

  return vendor;
};

// ══════════════════════════════════════════════
//  PROFILE VISIBILITY NUDGE (Cron + Manual)
// ══════════════════════════════════════════════

/**
 * Sends profile-visibility push nudges to vendors missing key sections.
 * Designed to be called from a weekly cron job.
 */
const sendProfileNudgeNotifications = async () => {
  try {
    console.log('⏰ [CRON] Running profile visibility nudges...');

    // 1. Missing Verification
    const unverifiedVendors = await User.find({
      role: 'vendor',
      status: 'active',
      isDeleted: false,
      'vendor.isVerifiedBadge': { $ne: true },
    }).select('_id');
    if (unverifiedVendors.length > 0) {
      const promises = unverifiedVendors.map((v) =>
        sendNotification(
          v._id.toString(),
          '🛡️ Boost Your Visibility by 25%!',
          'Complete your Business Verification now.',
          'profile_score_nudge',
          { action: 'verification_nudge' },
        ),
      );
      await Promise.all(promises);
      console.log(`✅ Verification nudges sent to ${unverifiedVendors.length} vendors.`);
    }

    // 2. Low Service Variety (fewer than 3 services)
    const allVendors = await User.find({
      role: 'vendor',
      status: 'active',
      isDeleted: false,
    }).select('_id');
    for (const vendor of allVendors) {
      const serviceCount = await VendorService.countDocuments({
        vendor: vendor._id,
        isDraft: { $ne: true },
      });
      if (serviceCount < 3) {
        sendNotification(
          vendor._id.toString(),
          '🛠️ Add More Services!',
          'Gain +20% visibility score.',
          'profile_score_nudge',
          { action: 'service_variety_nudge' },
        );
      }
    }

    // 3. No Packages
    for (const vendor of allVendors) {
      const packageCount = await ServicePackage.countDocuments({ vendor: vendor._id });
      if (packageCount === 0) {
        sendNotification(
          vendor._id.toString(),
          '📦 Missing Packages?',
          'Clients prefer vendors with clear pricing.',
          'profile_score_nudge',
          { action: 'packages_nudge' },
        );
      }
    }

    console.log('✅ [CRON] Profile visibility nudges completed.');
  } catch (error) {
    console.error('❌ [CRON] Profile visibility nudges error:', error);
  }
};

// ══════════════════════════════════════════════════════════
//  VISIBILITY SCORE SYSTEM
// ══════════════════════════════════════════════════════════

/**
 * Fire-and-forget notification for visibility task changes.
 */
const _notifyVisibilityTask = async (
  vendorId: string,
  taskKey: VisibilityTaskKey,
  completed: boolean,
) => {
  const task = VISIBILITY_TASKS.find((t) => t.key === taskKey);
  if (!task) return;

  if (completed) {
    sendNotification(
      vendorId,
      `🎯 Visibility Score +${task.points}%!`,
      `${task.icon} ${task.label} completed! (+${task.points}% Score)`,
      'profile_score_changed',
      { task: taskKey, points: String(task.points), action: 'visibility_task_completed' },
    );
  } else {
    sendNotification(
      vendorId,
      `📉 Visibility Score -${task.points}%`,
      `${task.icon} ${task.label} no longer active. (${task.points}% Score deducted)`,
      'profile_score_changed',
      { task: taskKey, points: String(task.points), action: 'visibility_task_reverted' },
    );
  }
};

/**
 * Core visibility score calculator.
 * Audits all 6 tasks, computes score (capped at 100), detects changes,
 * sends notifications, and updates the vendor record.
 */
const calculateAndUpdateVisibilityScore = async (vendorId: string): Promise<number | undefined> => {
  const vendor = await User.findById(vendorId);
  if (!vendor || vendor.role !== 'vendor') return undefined;

  const previouslyCompleted = new Set<string>(vendor.vendor?.completedTasks ?? []);
  const newlyCompleted = new Set<string>();

  let score = 0;

  // ── Task 1: Business Verification (+25%) ──
  if (vendor.vendor?.isVerifiedBadge) {
    score += VISIBILITY_POINTS.BUSINESS_VERIFICATION;
    newlyCompleted.add('BUSINESS_VERIFICATION');
  }

  // ── Task 2: Services Variety (+20%) ──
  const distinctCategories = await VendorService.distinct('category', {
    vendor: new Types.ObjectId(vendorId),
    isDraft: { $ne: true },
  });
  if (distinctCategories.length >= 3) {
    score += VISIBILITY_POINTS.SERVICES_VARIETY;
    newlyCompleted.add('SERVICES_VARIETY');
  }

  // ── Task 3: Packages & Pricing (+20%) ──
  const activePackageCount = await ServicePackage.countDocuments({
    vendor: new Types.ObjectId(vendorId),
    isActive: true,
  });
  if (activePackageCount >= 1) {
    score += VISIBILITY_POINTS.PACKAGES_PRICING;
    newlyCompleted.add('PACKAGES_PRICING');
  }

  // ── Task 4: Activity & Engagement (+15%) ──
  const now = new Date();
  const vendorDoc = vendor as any; // access Mongoose virtual timestamps
  const lastActive = vendor.lastActiveAt || vendorDoc.updatedAt;
  const activeWithin24h =
    lastActive && now.getTime() - new Date(lastActive).getTime() < 24 * 60 * 60 * 1000;

  // Check portfolio update within 30 days
  const portfolioUpdatedRecently =
    vendorDoc.updatedAt &&
    now.getTime() - new Date(vendorDoc.updatedAt).getTime() < 30 * 24 * 60 * 60 * 1000;

  if (activeWithin24h || portfolioUpdatedRecently) {
    score += VISIBILITY_POINTS.ACTIVITY_ENGAGEMENT;
    newlyCompleted.add('ACTIVITY_ENGAGEMENT');
  }

  // ── Task 5: Quick Quote Submissions (+10%) ──
  let quickQuotesGranted = false;

  const latestQuote = await VendorQuote.findOne({
    vendor: new Types.ObjectId(vendorId),
    isDeleted: false,
    'offers.1': { $exists: true }, // at least 2 offers = vendor has responded
  })
    .sort({ createdAt: -1 })
    .lean();

  if (latestQuote) {
    const quoteCreated = new Date((latestQuote as any).createdAt).getTime();
    const vendorOffer = latestQuote.offers.find(
      (o) => o.sender?.toString() === vendorId,
    );
    if (vendorOffer) {
      const responseTime = new Date(vendorOffer.createdAt).getTime() - quoteCreated;
      if (responseTime < 24 * 60 * 60 * 1000) {
        quickQuotesGranted = true;
      }
    }
  }

  // Fallback: check overall response rate (≥ 50%)
  if (!quickQuotesGranted) {
    const totalQuotes = await VendorQuote.countDocuments({
      vendor: new Types.ObjectId(vendorId),
      isDeleted: false,
    });
    const respondedQuotes = await VendorQuote.countDocuments({
      vendor: new Types.ObjectId(vendorId),
      isDeleted: false,
      'offers.1': { $exists: true },
    });
    if (totalQuotes > 0 && respondedQuotes / totalQuotes >= 0.5) {
      quickQuotesGranted = true;
    }
  }

  if (quickQuotesGranted) {
    score += VISIBILITY_POINTS.QUICK_QUOTES;
    newlyCompleted.add('QUICK_QUOTES');
  }

  // ── Task 6: Ads & Promotion (+10%) ──
  const activePromotion = await VendorPromotion.findOne({
    vendor: new Types.ObjectId(vendorId),
    isActive: true,
    status: 'active',
    endDate: { $gte: now },
  });
  if (activePromotion) {
    score += VISIBILITY_POINTS.ADS_PROMOTION;
    newlyCompleted.add('ADS_PROMOTION');
  }

  // Cap at 100 — no extra points
  score = Math.min(score, MAX_VISIBILITY_SCORE);

  const completedTasksArray = Array.from(newlyCompleted);

  // ── Detect newly completed tasks → send positive notifications ──
  for (const taskKey of completedTasksArray) {
    if (!previouslyCompleted.has(taskKey)) {
      void _notifyVisibilityTask(vendorId, taskKey as VisibilityTaskKey, true);
    }
  }

  // ── Detect reverted tasks → send negative notifications (dynamic reversion) ──
  for (const taskKey of previouslyCompleted) {
    if (!newlyCompleted.has(taskKey)) {
      void _notifyVisibilityTask(vendorId, taskKey as VisibilityTaskKey, false);
    }
  }

  // Persist score, completed tasks, and update lastActiveAt
  await User.findByIdAndUpdate(vendorId, {
    'vendor.profileScore': score,
    'vendor.completedTasks': completedTasksArray,
    lastActiveAt: now,
  });

  return score;
};

/**
 * GET /user/me/visibility-tasks
 * Returns the 6 tasks, their completion status, and current score
 */
const getMyVisibilityTasksFromDB = async (vendorId: string) => {
  const vendor = await User.findById(vendorId).select(
    'vendor.completedTasks vendor.profileScore vendor.isVerifiedBadge lastActiveAt role',
  );
  if (!vendor || vendor.role !== 'vendor') {
    throw new AppError(httpStatus.NOT_FOUND, 'Vendor not found');
  }

  const completedTasks = new Set(vendor.vendor?.completedTasks ?? []);

  const tasks = VISIBILITY_TASKS.map((task) => ({
    key: task.key,
    label: task.label,
    description: task.description,
    points: task.points,
    icon: task.icon,
    isCompleted: completedTasks.has(task.key),
  }));

  return {
    profileScore: vendor.vendor?.profileScore ?? 0,
    completedTasks: Array.from(completedTasks),
    tasks,
  };
};

export const UserServices = {
  getAllUsersFromDB,
  updateProfileInDB,
  manageAvailabilityInDB,
  applyToBecomeVendor,
  getMeFromDB,
  updateVendorAvailabilityInDB,
  getVendorProfileFromDB,
  triggerNewReviewNotification,
  triggerVendorApprovalNotification,
  triggerVendorVerificationNotification,
  triggerBookingNotification,
  sendProfileNudgeNotifications,
  calculateAndUpdateVisibilityScore,
  getMyVisibilityTasksFromDB,
};