import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { UserProgress } from './userProgress.model';
import { Module } from '../Module/module.model';
import { User } from '../User/user.model';
import { Team } from '../Team/team.model';

// ── Get My Learning Path (User Dashboard & Assigned Modules) ──
const getMyLearningPathFromDB = async (userId: string, queryStatus?: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Determine status filter: default to 'published' for end users, or allow 'all' / 'draft'
  const statusFilter =
    queryStatus === 'all'
      ? { $in: ['published', 'draft'] }
      : queryStatus || 'published';

  // Find modules assigned to user's team or company
  const filterQuery: any = { status: statusFilter, isDeleted: false };
  const orConditions: any[] = [];

  if (user.teamId) {
    orConditions.push({ teamId: user.teamId });
  }
  if (user.companyId) {
    orConditions.push({ companyId: user.companyId });
  }

  if (orConditions.length > 0) {
    filterQuery.$or = orConditions;
  } else {
    // If user has no company or team, return empty learning path
    return {
      overallStats: {
        totalModules: 0,
        completedModules: 0,
        inProgressModules: 0,
        notStartedModules: 0,
        overallProgressPercentage: 0,
        averageScore: 0,
      },
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        companyId: user.companyId,
        teamId: user.teamId,
      },
      modules: [],
    };
  }

  const assignedModules = await Module.find(filterQuery).sort({ createdAt: -1 });

  // Get or initialize UserProgress for each module
  let completedCount = 0;
  let inProgressCount = 0;
  let totalScoreSum = 0;
  let scoredModulesCount = 0;
  let totalProgressSum = 0;

  const modulesWithProgress = await Promise.all(
    assignedModules.map(async (module) => {
      let progress = await UserProgress.findOne({ userId, moduleId: module._id });

      if (!progress) {
        progress = await UserProgress.create({
          userId,
          companyId: user.companyId || module.companyId,
          teamId: user.teamId || module.teamId,
          moduleId: module._id,
          status: 'not_started',
          progressPercentage: 0,
          totalQuestions: module.questions ? module.questions.length : 0,
          completedQuestions: 0,
          answers: [],
        });
      }

      if (progress.status === 'completed') {
        completedCount++;
      } else if (progress.status === 'in_progress') {
        inProgressCount++;
      }

      totalProgressSum += progress.progressPercentage || 0;

      if (progress.score !== undefined && progress.score !== null) {
        totalScoreSum += progress.score;
        scoredModulesCount++;
      }

      return {
        _id: module._id,
        title: module.title,
        description: module.description,
        thumbnailImage: module.thumbnailImage,
        totalQuestions: module.questions ? module.questions.length : 0,
        status: module.status,
        userProgress: {
          status: progress.status,
          progressPercentage: progress.progressPercentage,
          completedQuestions: progress.completedQuestions,
          score: progress.score,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
        },
      };
    }),
  );

  const totalModules = assignedModules.length;
  const overallProgressPercentage =
    totalModules > 0 ? Math.round(totalProgressSum / totalModules) : 0;
  const averageScore =
    scoredModulesCount > 0 ? Math.round(totalScoreSum / scoredModulesCount) : 0;

  return {
    overallStats: {
      totalModules,
      completedModules: completedCount,
      inProgressModules: inProgressCount,
      notStartedModules: totalModules - (completedCount + inProgressCount),
      overallProgressPercentage,
      averageScore,
    },
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      companyId: user.companyId,
      teamId: user.teamId,
    },
    modules: modulesWithProgress,
  };
};

// ── Get Single Module for User ──
const getModuleForUserFromDB = async (userId: string, moduleId: string) => {
  const module = await Module.findOne({ _id: moduleId, status: 'published', isDeleted: false });
  if (!module) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found or not published');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  let progress = await UserProgress.findOne({ userId, moduleId });
  if (!progress) {
    progress = await UserProgress.create({
      userId,
      companyId: user.companyId || module.companyId,
      teamId: user.teamId || module.teamId,
      moduleId: module._id,
      status: 'not_started',
      progressPercentage: 0,
      totalQuestions: module.questions ? module.questions.length : 0,
      completedQuestions: 0,
      answers: [],
    });
  }

  return {
    module,
    userProgress: progress,
  };
};

// ── Submit Answer for a Question ──
const submitAnswerInDB = async (
  userId: string,
  payload: { moduleId: string; questionId: string; answer: any },
) => {
  const { moduleId, questionId, answer } = payload;

  const module = await Module.findOne({ _id: moduleId, isDeleted: false });
  if (!module) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found');
  }

  const question: any = module.questions.find((q: any) => q.id === questionId);
  if (!question) {
    throw new AppError(httpStatus.NOT_FOUND, 'Question not found in module');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check correctness & marking
  let isCorrect = false;
  let qScore = 0;

  if (question.type === 'MCQ') {
    if (
      question.correctAnswer &&
      String(answer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase()
    ) {
      isCorrect = true;
      qScore = 100;
    }
  } else if (question.type === 'Swipe') {
    if (
      question.correctDirection &&
      String(answer).trim().toLowerCase() === String(question.correctDirection).trim().toLowerCase()
    ) {
      isCorrect = true;
      qScore = 100;
    }
  } else if (question.type === 'Ordering') {
    if (
      Array.isArray(answer) &&
      Array.isArray(question.items) &&
      JSON.stringify(answer) === JSON.stringify(question.items)
    ) {
      isCorrect = true;
      qScore = 100;
    }
  } else {
    // Chat Scenario, Rating, Video, Free Input
    isCorrect = true;
    qScore = 100;
  }

  // Find or create UserProgress
  let progress = await UserProgress.findOne({ userId, moduleId });
  if (!progress) {
    progress = new UserProgress({
      userId,
      companyId: user.companyId || module.companyId,
      teamId: user.teamId || module.teamId,
      moduleId,
      status: 'in_progress',
      startedAt: new Date(),
      answers: [],
    });
  }

  if (!progress.answers) {
    progress.answers = [];
  }

  if (progress.status === 'not_started') {
    progress.status = 'in_progress';
    progress.startedAt = progress.startedAt || new Date();
  }
  progress.lastAttemptAt = new Date();

  // Update or push answer
  const existingAnswerIndex = progress.answers.findIndex((a) => a.questionId === questionId);
  const answerObj = {
    questionId,
    answer,
    isCorrect,
    score: qScore,
    answeredAt: new Date(),
  };

  if (existingAnswerIndex > -1) {
    progress.answers[existingAnswerIndex] = answerObj;
  } else {
    progress.answers.push(answerObj);
  }

  // Recalculate progress stats
  const totalQuestions = module.questions.length;
  const completedQuestions = progress.answers.length;
  const progressPercentage =
    totalQuestions > 0 ? Math.min(100, Math.round((completedQuestions / totalQuestions) * 100)) : 100;

  // Calculate score for scored questions
  const scoredAnswers = progress.answers.filter((a) => {
    const q: any = module.questions.find((qItem: any) => qItem.id === a.questionId);
    return q ? q.isScored !== false : true;
  });

  const avgScore =
    scoredAnswers.length > 0
      ? Math.round(
          scoredAnswers.reduce((sum, a) => sum + (a.score || 0), 0) / scoredAnswers.length,
        )
      : 100;

  progress.totalQuestions = totalQuestions;
  progress.completedQuestions = completedQuestions;
  progress.progressPercentage = progressPercentage;
  progress.score = avgScore;

  if (completedQuestions >= totalQuestions) {
    progress.status = 'completed';
    progress.completedAt = new Date();
  }

  await progress.save();

  return {
    questionId,
    isCorrect,
    score: qScore,
    correctAnswer: question.correctAnswer || question.correctDirection,
    explanation: question.explanation || '',
    completedQuestions,
    totalQuestions,
    progressPercentage,
    moduleScore: avgScore,
    moduleStatus: progress.status,
  };
};

// ── Complete Module ──
const completeModuleInDB = async (userId: string, moduleId: string) => {
  const module = await Module.findOne({ _id: moduleId, isDeleted: false });
  if (!module) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  let progress = await UserProgress.findOne({ userId, moduleId });
  if (!progress) {
    progress = new UserProgress({
      userId,
      companyId: user.companyId || module.companyId,
      teamId: user.teamId || module.teamId,
      moduleId,
      answers: [],
    });
  }

  progress.status = 'completed';
  progress.progressPercentage = 100;
  progress.completedQuestions = module.questions.length;
  progress.totalQuestions = module.questions.length;
  progress.completedAt = new Date();
  if (!progress.score) progress.score = 100;

  await progress.save();

  return progress;
};

// ── Team Performance Stats ──
const getTeamPerformanceFromDB = async (teamId: string) => {
  const team = await Team.findById(teamId);
  if (!team) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }

  const teamUsers = await User.find({ teamId, role: 'user', isDeleted: false }).select(
    'firstName lastName email image',
  );

  const teamUserIds = teamUsers.map((u) => u._id);
  const assignedModules = await Module.find({ teamId, isDeleted: false });

  const progressRecords = await UserProgress.find({
    userId: { $in: teamUserIds },
    teamId,
  });

  const totalMembers = teamUsers.length;
  const totalAssignedModules = assignedModules.length;

  let totalCompletedCount = 0;
  let totalScoreSum = 0;
  let scoredCount = 0;
  let totalProgressSum = 0;

  const memberBreakdown = teamUsers.map((user) => {
    const userProgresses = progressRecords.filter((p) => p.userId.equals(user._id));
    const userCompleted = userProgresses.filter((p) => p.status === 'completed').length;
    const userAvgProgress =
      totalAssignedModules > 0
        ? Math.round(
            userProgresses.reduce((sum, p) => sum + p.progressPercentage, 0) /
              totalAssignedModules,
          )
        : 0;

    const scored = userProgresses.filter((p) => p.score !== undefined && p.score !== null);
    const userAvgScore =
      scored.length > 0 ? Math.round(scored.reduce((sum, p) => sum + (p.score || 0), 0) / scored.length) : 0;

    totalCompletedCount += userCompleted;
    totalProgressSum += userAvgProgress;
    if (scored.length > 0) {
      totalScoreSum += userAvgScore;
      scoredCount++;
    }

    return {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        image: user.image,
      },
      completedModules: userCompleted,
      totalModules: totalAssignedModules,
      progressPercentage: userAvgProgress,
      averageScore: userAvgScore,
    };
  });

  const overallTeamProgress =
    totalMembers > 0 ? Math.round(totalProgressSum / totalMembers) : 0;
  const overallTeamScore = scoredCount > 0 ? Math.round(totalScoreSum / scoredCount) : 0;

  return {
    team: {
      _id: team._id,
      name: team.name,
      companyId: team.companyId,
    },
    stats: {
      totalMembers,
      totalAssignedModules,
      overallTeamProgressPercentage: overallTeamProgress,
      overallTeamAverageScore: overallTeamScore,
    },
    memberBreakdown,
  };
};

// ── Company Performance Stats ──
const getCompanyPerformanceFromDB = async (companyId: string) => {
  const company = await User.findOne({ _id: companyId, role: 'company' });
  if (!company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
  }

  const teams = await Team.find({ companyId });
  const companyUsers = await User.find({ companyId, role: 'user', isDeleted: false });
  const companyUserIds = companyUsers.map((u) => u._id);

  const teamIds = teams.map((t) => t._id);
  const assignedModules = await Module.find({
    $or: [{ companyId }, { teamId: { $in: teamIds } }],
    isDeleted: false,
  });

  const progressRecords = await UserProgress.find({
    userId: { $in: companyUserIds },
    companyId,
  });

  let totalScoreSum = 0;
  let scoredCount = 0;
  let totalProgressSum = 0;

  const teamBreakdown = await Promise.all(
    teams.map(async (t) => {
      const tUsers = companyUsers.filter((u) => u.teamId && u.teamId.equals(t._id));
      const tUserIds = tUsers.map((u) => u._id);
      const tModules = assignedModules.filter((m) => m.teamId && m.teamId.equals(t._id));

      const tProgressRecords = progressRecords.filter((p) =>
        tUserIds.some((id) => id.equals(p.userId)),
      );

      const tCompleted = tProgressRecords.filter((p) => p.status === 'completed').length;
      const tTotalAssignments = tUsers.length * tModules.length;

      const tAvgProgress =
        tTotalAssignments > 0
          ? Math.round(
              (tProgressRecords.reduce((sum, p) => sum + p.progressPercentage, 0) /
                tTotalAssignments),
            )
          : 0;

      const scored = tProgressRecords.filter((p) => p.score !== undefined && p.score !== null);
      const tAvgScore =
        scored.length > 0 ? Math.round(scored.reduce((sum, p) => sum + (p.score || 0), 0) / scored.length) : 0;

      totalProgressSum += tAvgProgress;
      if (scored.length > 0) {
        totalScoreSum += tAvgScore;
        scoredCount++;
      }

      return {
        team: {
          _id: t._id,
          name: t.name,
        },
        totalMembers: tUsers.length,
        totalModules: tModules.length,
        completedAssignments: tCompleted,
        progressPercentage: tAvgProgress,
        averageScore: tAvgScore,
      };
    }),
  );

  const overallCompanyProgress =
    teams.length > 0 ? Math.round(totalProgressSum / teams.length) : 0;
  const overallCompanyScore = scoredCount > 0 ? Math.round(totalScoreSum / scoredCount) : 0;

  return {
    company: {
      _id: company._id,
      name: company.firstName || company.email,
    },
    stats: {
      totalTeams: teams.length,
      totalEmployees: companyUsers.length,
      totalAssignedModules: assignedModules.length,
      overallCompanyProgressPercentage: overallCompanyProgress,
      overallCompanyAverageScore: overallCompanyScore,
    },
    teamBreakdown,
  };
};

export const UserProgressServices = {
  getMyLearningPathFromDB,
  getModuleForUserFromDB,
  submitAnswerInDB,
  completeModuleInDB,
  getTeamPerformanceFromDB,
  getCompanyPerformanceFromDB,
};
