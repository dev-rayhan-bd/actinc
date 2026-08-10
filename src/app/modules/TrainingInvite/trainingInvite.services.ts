import crypto from 'crypto';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { Training, Topic } from '../Training/training.model';
import { TrainingInvite } from './trainingInvite.model';
import sendEmail from '../../utils/sendEmail';
import { getEmailTemplate } from '../../utils/emailTemplate';
import config from '../../config';

// ── Generate Share Link ──
const generateShareLinkInDB = async (
  trainingId: string,
  creatorId: string,
  email?: string,
  expiresInDays: number = 30,
) => {
  const training = await Training.findOne({ _id: trainingId, isDeleted: false });
  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const invite = await TrainingInvite.create({
    token,
    trainingId,
    companyId: training.companyId,
    email: email || undefined,
    expiresAt,
    createdBy: creatorId,
  });

  const baseUrl = config.frontend_url || config.server_url || 'http://localhost:3000';
  const shareLink = `${baseUrl}/training/${trainingId}/join/${token}?authType=${training.authType}`;

  return {
    token: invite.token,
    shareLink,
    expiresAt: invite.expiresAt,
    trainingTitle: training.title,
  };
};

// ── Send Invite by Email ──
const sendTrainingInviteByEmail = async (
  trainingId: string,
  email: string,
  creatorId: string,
) => {
  const linkData = await generateShareLinkInDB(trainingId, creatorId, email);

  const html = getEmailTemplate({
    userName: email,
    title: 'You\'re Invited to a Training!',
    body: `You've been invited to experience the training: <strong>${linkData.trainingTitle}</strong>. Click the link below to get started.`,
    buttonText: 'Join Training',
    buttonLink: linkData.shareLink,
    codeExpiry: `This link expires on ${linkData.expiresAt.toLocaleDateString()}.`,
  });

  await sendEmail({
    to: email,
    subject: `Training Invitation: ${linkData.trainingTitle}`,
    html,
  });

  return linkData;
};

// ── Get Training by Token (public — no auth) ──
const getTrainingByTokenFromDB = async (token: string) => {
  const invite = await TrainingInvite.findOne({ token });
  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invalid or expired invite link');
  }

  if (invite.expiresAt < new Date()) {
    throw new AppError(httpStatus.GONE, 'This invite link has expired');
  }

  const training = await Training.findOne({
    _id: invite.trainingId,
    isDeleted: false,
  }).populate('companyId', 'firstName email slug image branding');

  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  // Get full nested data
  const topics = await Topic.find({
    trainingId: training._id,
    isDeleted: false,
  })
    .sort({ order: 1 })
    .populate({
      path: 'moduleIds',
      select: 'title description thumbnailImage questions status',
      match: { isDeleted: false },
    });

  const trainingObj = training.toObject();

  return {
    ...trainingObj,
    topics: topics.map((topic) => {
      const topicObj = topic.toObject();
      return {
        ...topicObj,
        modules: topicObj.moduleIds,
        moduleIds: undefined,
        moduleCount: Array.isArray(topicObj.moduleIds)
          ? topicObj.moduleIds.length
          : 0,
      };
    }),
    invite: {
      token: invite.token,
      expiresAt: invite.expiresAt,
    },
  };
};

// ── Get All Invitations for a Training ──
const getInvitationsByTrainingFromDB = async (trainingId: string, companyId?: string, role?: string) => {
  const query: any = { trainingId, email: { $exists: true, $ne: null } };
  
  if (role !== 'superAdmin' && role !== 'admin' && companyId) {
    query.companyId = companyId;
  }

  const invites = await TrainingInvite.find(query).sort({ createdAt: -1 });
  return invites;
};

// ── Resend Invite by Email ──
const resendTrainingInviteByEmail = async (inviteId: string) => {
  const invite = await TrainingInvite.findById(inviteId).populate('trainingId');
  if (!invite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invitation not found');
  }
  if (!invite.email) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This invitation has no associated email');
  }

  const training = invite.trainingId as any;

  // Check if expired, if so, generate a new token
  if (invite.expiresAt < new Date()) {
    invite.token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // extend by 30 days
    invite.expiresAt = expiresAt;
    await invite.save();
  }

  const baseUrl = config.frontend_url || config.server_url || 'http://localhost:3000';
  const shareLink = `${baseUrl}/training/${training._id}/join/${invite.token}?authType=${training.authType}`;

  const html = getEmailTemplate({
    userName: invite.email,
    title: 'Reminder: You\'re Invited to a Training!',
    body: `This is a reminder that you've been invited to experience the training: <strong>${training.title}</strong>. Click the link below to get started.`,
    buttonText: 'Join Training',
    buttonLink: shareLink,
    codeExpiry: `This link expires on ${invite.expiresAt.toLocaleDateString()}.`,
  });

  await sendEmail({
    to: invite.email,
    subject: `Reminder: Training Invitation for ${training.title}`,
    html,
  });

  return invite;
};

export const TrainingInviteServices = {
  generateShareLinkInDB,
  sendTrainingInviteByEmail,
  getTrainingByTokenFromDB,
  getInvitationsByTrainingFromDB,
  resendTrainingInviteByEmail,
};
