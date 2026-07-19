import { z } from 'zod';

// ── Question Schemas by Type ──

const mcqQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('MCQ'),
  content: z.string().min(1, 'Question content is required'),
  image: z.string().optional(),
  explanation: z.string().optional(),
  isScored: z.boolean(),
  options: z.array(z.string()).min(2, 'MCQ must have at least 2 options'),
  correctAnswer: z.string().min(1, 'correctAnswer is required'),
});

const swipeQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('Swipe'),
  content: z.string().min(1, 'Question content is required'),
  image: z.string().optional(),
  explanation: z.string().optional(),
  isScored: z.boolean(),
  leftLabel: z.string().min(1, 'leftLabel is required'),
  rightLabel: z.string().min(1, 'rightLabel is required'),
  correctDirection: z.enum(['left', 'right']),
});

const orderingQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('Ordering'),
  content: z.string().min(1, 'Question content is required'),
  image: z.string().optional(),
  explanation: z.string().optional(),
  isScored: z.boolean(),
  items: z.array(z.string()).min(2, 'Ordering must have at least 2 items'),
});

const chatScenarioQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('Chat Scenario'),
  content: z.string().min(1, 'Question content is required'),
  image: z.string().optional(),
  explanation: z.string().optional(),
  isScored: z.boolean(),
  messages: z
    .array(
      z.object({
        sender: z.string().min(1, 'sender is required'),
        text: z.string().min(1, 'text is required'),
      }),
    )
    .min(1, 'Chat Scenario must have at least 1 message'),
});

const videoQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('Video'),
  content: z.string().min(1, 'Question content is required'),
  image: z.string().optional(),
  explanation: z.string().optional(),
  isScored: z.boolean(),
  videoUrl: z.string().url('videoUrl must be a valid URL'),
});

const ratingQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('Rating'),
  content: z.string().min(1, 'Question content is required'),
  image: z.string().optional(),
  explanation: z.string().optional(),
  isScored: z.boolean(),
  scale: z.number().int().min(2).max(10, 'Scale must be between 2 and 10'),
});

const freeInputQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('Free Input'),
  content: z.string().min(1, 'Question content is required'),
  image: z.string().optional(),
  explanation: z.string().optional(),
  isScored: z.boolean(),
});

// ── Discriminated Union for all question types ──
const questionSchema = z.discriminatedUnion('type', [
  mcqQuestionSchema,
  swipeQuestionSchema,
  orderingQuestionSchema,
  chatScenarioQuestionSchema,
  videoQuestionSchema,
  ratingQuestionSchema,
  freeInputQuestionSchema,
]);

// ── Create Module ──
const createModuleSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Module title is required'),
    description: z.string().min(1, 'Module description is required'),
    status: z.enum(['draft', 'published']).optional().default('draft'),
    questions: z
      .array(questionSchema)
      .optional()
      .default([]),
  }),
});

// ── Update Module ──
const updateModuleSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    status: z.enum(['draft', 'published']).optional(),
    questions: z.array(questionSchema).optional(),
  }),
});

// ── Duplicate Module ──
const duplicateModuleSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'New title is required for the duplicated module'),
  }),
});

export const ModuleValidation = {
  createModuleSchema,
  updateModuleSchema,
  duplicateModuleSchema,
};
