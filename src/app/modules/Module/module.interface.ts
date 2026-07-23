import { Model, Types } from 'mongoose';

// ── Question Type Enums ──
export type TQuestionType =
  | 'MCQ'
  | 'Swipe'
  | 'Ordering'
  | 'Chat Scenario'
  | 'Video'
  | 'Free Input'
  | 'Rating';

export type TModuleStatus = 'draft' | 'published';

// ── Base Question Fields ──
interface IQuestionBase {
  id: string;
  type: TQuestionType;
  content: string;
  image?: string;
  explanation?: string;
  isScored: boolean;
}

// ── Type-Specific Question Variants ──
export interface IMCQQuestion extends IQuestionBase {
  type: 'MCQ';
  options: string[];
  correctAnswer: string;
}

export interface ISwipeQuestion extends IQuestionBase {
  type: 'Swipe';
  leftLabel: string;
  rightLabel: string;
  correctDirection: 'left' | 'right';
}

export interface IOrderingQuestion extends IQuestionBase {
  type: 'Ordering';
  items: string[];
}

export interface IChatScenarioQuestion extends IQuestionBase {
  type: 'Chat Scenario';
  messages: { sender: string; text: string }[];
}

export interface IVideoQuestion extends IQuestionBase {
  type: 'Video';
  videoUrl: string;
}

export interface IRatingQuestion extends IQuestionBase {
  type: 'Rating';
  scale: number;
}

export interface IFreeInputQuestion extends IQuestionBase {
  type: 'Free Input';
}

// ── Union of all question types ──
export type TQuestion =
  | IMCQQuestion
  | ISwipeQuestion
  | IOrderingQuestion
  | IChatScenarioQuestion
  | IVideoQuestion
  | IRatingQuestion
  | IFreeInputQuestion;

// ── Module Document ──
export interface IModule {
  title: string;
  description: string;
  thumbnailImage?: string;
  questions: TQuestion[];
  status: TModuleStatus;
  createdBy: Types.ObjectId;
  teamId?: Types.ObjectId;
  companyId?: Types.ObjectId;
  isDeleted: boolean;
}

export type TModuleModel = Model<IModule>;
