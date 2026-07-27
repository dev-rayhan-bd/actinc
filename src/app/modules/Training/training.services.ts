import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Training, Topic } from './training.model';
import { Module } from '../Module/module.model';
import { UserProgress } from '../UserProgress/userProgress.model';

// ── Create Training ──
const createTrainingInDB = async (payload: any, userId: string) => {
  payload.createdBy = userId;
  const result = await Training.create(payload);
  return result;
};

// ── Get All Trainings (admin) ──
const getAllTrainingsFromDB = async (query: Record<string, unknown>) => {
  const trainingQuery = new QueryBuilder(
    Training.find({ isDeleted: false })
      .populate('createdBy', 'firstName lastName email')
      .populate('companyId', 'firstName email slug'),
    query,
  )
    .search(['title', 'description'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await trainingQuery.modelQuery;
  const meta = await trainingQuery.countTotal();

  // Attach topic count for each training
  const trainingsWithTopics = await Promise.all(
    result.map(async (training: any) => {
      const topicCount = await Topic.countDocuments({
        trainingId: training._id,
        isDeleted: false,
      });
      const trainingObj = training.toObject ? training.toObject() : { ...training };
      return { ...trainingObj, topicCount };
    }),
  );

  return { result: trainingsWithTopics, meta };
};

// ── Get Single Training (full nested: training → topics → modules) ──
const getSingleTrainingFromDB = async (id: string) => {
  const training = await Training.findOne({ _id: id, isDeleted: false })
    .populate('createdBy', 'firstName lastName email')
    .populate('companyId', 'firstName email slug image branding');

  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  // Get all topics for this training, sorted by order
  const topics = await Topic.find({ trainingId: id, isDeleted: false })
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
        modules: topicObj.moduleIds, // rename for clarity
        moduleIds: undefined,
        moduleCount: Array.isArray(topicObj.moduleIds) ? topicObj.moduleIds.length : 0,
      };
    }),
  };
};

// ── Update Training ──
const updateTrainingInDB = async (id: string, payload: any) => {
  const training = await Training.findOne({ _id: id, isDeleted: false });
  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  const result = await Training.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).populate('createdBy', 'firstName lastName email');

  return result;
};

// ── Delete Training (soft delete) ──
const deleteTrainingFromDB = async (id: string) => {
  const training = await Training.findOne({ _id: id, isDeleted: false });
  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  await Training.findByIdAndUpdate(id, { isDeleted: true });
  // Also soft-delete all topics under this training
  await Topic.updateMany({ trainingId: id }, { isDeleted: true });

  return null;
};

// ── Duplicate Training (Deep Copy) ──
const duplicateTrainingInDB = async (trainingId: string, newTitle: string, userId: string) => {
  const original = await Training.findOne({ _id: trainingId, isDeleted: false }).lean();
  if (!original) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  // 1. Create new Training
  const duplicatedTraining = await Training.create({
    title: newTitle,
    description: original.description,
    thumbnailImage: original.thumbnailImage,
    status: 'draft',
    createdBy: userId,
  });

  // 2. Fetch Topics
  const topics = await Topic.find({ trainingId, isDeleted: false }).sort({ order: 1 }).lean();

  // 3. Deep Copy Topics and Modules
  for (const topic of topics) {
    const duplicatedModuleIds = [];
    const modules = await Module.find({ _id: { $in: topic.moduleIds }, isDeleted: false }).lean();

    for (const mod of modules) {
      // Deep copy module
      const newModule = await Module.create({
        title: mod.title,
        description: mod.description,
        thumbnailImage: mod.thumbnailImage,
        questions: mod.questions.map((q: any) => {
          const { _id, ...rest } = q;
          return {
            ...rest,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          };
        }),
        status: 'draft',
        createdBy: userId,
        // Will set topicId after creating topic
      });
      duplicatedModuleIds.push(newModule._id);
    }

    // Create new Topic
    const newTopic = await Topic.create({
      title: topic.title,
      description: topic.description,
      trainingId: duplicatedTraining._id,
      moduleIds: duplicatedModuleIds,
      order: topic.order,
    });

    // Update the duplicated modules with the new topicId
    await Module.updateMany(
      { _id: { $in: duplicatedModuleIds } },
      { topicId: newTopic._id }
    );
  }

  return duplicatedTraining;
};

// ── Assign Training to Company/Team ──
const assignTrainingInDB = async (
  id: string,
  payload: { companyId: string; teamId?: string },
) => {
  const training = await Training.findOne({ _id: id, isDeleted: false });
  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  const updateData: any = {
    companyId: payload.companyId,
    status: 'published', // Automatically publish when assigned
  };
  if (payload.teamId) {
    updateData.teamId = payload.teamId;
  }

  const result = await Training.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('createdBy', 'firstName lastName email')
    .populate('companyId', 'firstName email slug');

  // Find all topics to get module IDs
  const topics = await Topic.find({ trainingId: id, isDeleted: false });
  const allModuleIds = topics.reduce((acc: any[], topic) => {
    return acc.concat(topic.moduleIds || []);
  }, []);

  if (allModuleIds.length > 0) {
    // Publish and assign all child modules
    await Module.updateMany(
      { _id: { $in: allModuleIds } },
      {
        status: 'published',
        companyId: payload.companyId,
        ...(payload.teamId && { teamId: payload.teamId })
      }
    );
  }

  return result;
};

// ── Add Topic to Training ──
const addTopicToTrainingInDB = async (trainingId: string, payload: any) => {
  const training = await Training.findOne({ _id: trainingId, isDeleted: false });
  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  // Auto-assign order if not provided
  if (payload.order === undefined) {
    const lastTopic = await Topic.findOne({ trainingId, isDeleted: false }).sort({
      order: -1,
    });
    payload.order = lastTopic ? lastTopic.order + 1 : 0;
  }

  payload.trainingId = trainingId;
  const topic = await Topic.create(payload);
  return topic;
};

// ── Update Topic ──
const updateTopicInDB = async (trainingId: string, topicId: string, payload: any) => {
  const topic = await Topic.findOne({
    _id: topicId,
    trainingId,
    isDeleted: false,
  });
  if (!topic) {
    throw new AppError(httpStatus.NOT_FOUND, 'Topic not found in this training');
  }

  const result = await Topic.findByIdAndUpdate(topicId, payload, {
    new: true,
    runValidators: true,
  });
  return result;
};

// ── Delete Topic from Training ──
const deleteTopicFromTrainingInDB = async (trainingId: string, topicId: string) => {
  const topic = await Topic.findOne({
    _id: topicId,
    trainingId,
    isDeleted: false,
  });
  if (!topic) {
    throw new AppError(httpStatus.NOT_FOUND, 'Topic not found in this training');
  }

  await Topic.findByIdAndUpdate(topicId, { isDeleted: true });
  return null;
};

// ── Add Module to Topic ──
const addModuleToTopicInDB = async (
  trainingId: string,
  topicId: string,
  moduleId: string,
) => {
  const topic = await Topic.findOne({
    _id: topicId,
    trainingId,
    isDeleted: false,
  });
  if (!topic) {
    throw new AppError(httpStatus.NOT_FOUND, 'Topic not found in this training');
  }

  const module = await Module.findOne({ _id: moduleId, isDeleted: false });
  if (!module) {
    throw new AppError(httpStatus.NOT_FOUND, 'Module not found');
  }

  // Avoid duplicate
  if (topic.moduleIds.some((id) => id.toString() === moduleId)) {
    throw new AppError(httpStatus.CONFLICT, 'Module is already in this topic');
  }

  topic.moduleIds.push(module._id);
  await topic.save();

  // Update module with topicId reference
  await Module.findByIdAndUpdate(moduleId, { topicId });

  return topic.populate('moduleIds', 'title description thumbnailImage status');
};

// ── Remove Module from Topic ──
const removeModuleFromTopicInDB = async (
  trainingId: string,
  topicId: string,
  moduleId: string,
) => {
  const topic = await Topic.findOne({
    _id: topicId,
    trainingId,
    isDeleted: false,
  });
  if (!topic) {
    throw new AppError(httpStatus.NOT_FOUND, 'Topic not found');
  }

  topic.moduleIds = topic.moduleIds.filter((id) => id.toString() !== moduleId);
  await topic.save();

  // Clear topicId from the module
  await Module.findByIdAndUpdate(moduleId, { $unset: { topicId: 1 } });

  return topic;
};

// ── Reorder Topics ──
const reorderTopicsInDB = async (trainingId: string, topicIds: string[]) => {
  const training = await Training.findOne({ _id: trainingId, isDeleted: false });
  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found');
  }

  await Promise.all(
    topicIds.map((topicId, index) =>
      Topic.findByIdAndUpdate(topicId, { order: index }),
    ),
  );

  const topics = await Topic.find({ trainingId, isDeleted: false }).sort({ order: 1 });
  return topics;
};

// ── Get Trainings by Company (company sees their assigned trainings) ──
const getTrainingsByCompanyFromDB = async (companyId: string) => {
  const trainings = await Training.find({
    companyId,
    isDeleted: false,
    status: 'published',
  })
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 });

  // Attach topic + module counts
  const result = await Promise.all(
    trainings.map(async (training: any) => {
      const topics = await Topic.find({
        trainingId: training._id,
        isDeleted: false,
      })
        .sort({ order: 1 })
        .select('title moduleIds order');

      const trainingObj = training.toObject();
      return {
        ...trainingObj,
        topicCount: topics.length,
        totalModules: topics.reduce((sum, t) => sum + t.moduleIds.length, 0),
      };
    }),
  );

  return result;
};

// ── Get Training for User (public / with progress) ──
const getTrainingForUserFromDB = async (trainingId: string, userId?: string) => {
  const training = await Training.findOne({
    _id: trainingId,
    isDeleted: false,
    status: 'published',
  }).populate('companyId', 'firstName email slug image branding');

  if (!training) {
    throw new AppError(httpStatus.NOT_FOUND, 'Training not found or not published');
  }

  const topics = await Topic.find({ trainingId, isDeleted: false })
    .sort({ order: 1 })
    .populate({
      path: 'moduleIds',
      select: 'title description thumbnailImage questions status',
      match: { isDeleted: false },
    });

  // Get user progress for each module if userId exists
  const topicsWithProgress = await Promise.all(
    topics.map(async (topic) => {
      const topicObj = topic.toObject();
      const modules = Array.isArray(topicObj.moduleIds) ? topicObj.moduleIds : [];

      const modulesWithProgress = await Promise.all(
        modules.map(async (mod: any) => {
          let userProgress: any = null;
          if (userId) {
            userProgress = await UserProgress.findOne({
              userId,
              moduleId: mod._id,
            }).select('status progressPercentage score completedQuestions totalQuestions');
          }

          return {
            _id: mod._id,
            title: mod.title,
            description: mod.description,
            thumbnailImage: mod.thumbnailImage,
            totalQuestions: mod.questions ? mod.questions.length : 0,
            status: mod.status,
            userProgress: userProgress
              ? {
                status: userProgress.status,
                progressPercentage: userProgress.progressPercentage,
                score: userProgress.score,
                completedQuestions: userProgress.completedQuestions,
                totalQuestions: userProgress.totalQuestions,
              }
              : {
                status: 'not_started',
                progressPercentage: 0,
                score: 0,
                completedQuestions: 0,
                totalQuestions: mod.questions ? mod.questions.length : 0,
              },
          };
        }),
      );

      return {
        _id: topicObj._id,
        title: topicObj.title,
        description: topicObj.description,
        order: topicObj.order,
        modules: modulesWithProgress,
        moduleCount: modulesWithProgress.length,
      };
    }),
  );

  const trainingObj = training.toObject();

  return {
    ...trainingObj,
    topics: topicsWithProgress,
  };
};

export const TrainingServices = {
  createTrainingInDB,
  getAllTrainingsFromDB,
  getSingleTrainingFromDB,
  updateTrainingInDB,
  deleteTrainingFromDB,
  duplicateTrainingInDB,
  assignTrainingInDB,
  addTopicToTrainingInDB,
  updateTopicInDB,
  deleteTopicFromTrainingInDB,
  addModuleToTopicInDB,
  removeModuleFromTopicInDB,
  reorderTopicsInDB,
  getTrainingsByCompanyFromDB,
  getTrainingForUserFromDB,
};
