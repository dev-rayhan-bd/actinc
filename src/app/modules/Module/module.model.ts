import { Schema, model } from 'mongoose';
import { IModule, TModuleModel } from './module.interface';

// ── Question Sub-document Schema (flexible for dynamic types) ──
const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'MCQ',
        'Swipe',
        'Ordering',
        'Chat Scenario',
        'Video',
        'Free Input',
        'Rating',
      ],
      required: true,
    },
    content: { type: String, required: true },
    image: { type: String },
    explanation: { type: String },
    isScored: { type: Boolean, default: true },

    // MCQ
    options: [{ type: String }],
    correctAnswer: { type: String },

    // Swipe
    leftLabel: { type: String },
    rightLabel: { type: String },
    correctDirection: { type: String, enum: ['left', 'right'] },

    // Ordering
    items: [{ type: String }],

    // Chat Scenario
    messages: [
      {
        sender: { type: String },
        text: { type: String },
      },
    ],

    // Video
    videoUrl: { type: String },

    // Rating
    scale: { type: Number },
  },
  { _id: false },
);

// ── Module Schema ──
const moduleSchema = new Schema<IModule, TModuleModel>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    thumbnailImage: { type: String, default: '' },
    questions: { type: [questionSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ── Indexes for performance ──
moduleSchema.index({ title: 'text', description: 'text' });
moduleSchema.index({ status: 1 });
moduleSchema.index({ createdBy: 1 });
moduleSchema.index({ isDeleted: 1 });

export const Module = model<IModule, TModuleModel>('Module', moduleSchema);
