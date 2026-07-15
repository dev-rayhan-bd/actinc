import { Schema, model } from 'mongoose';
import { TCompany, TCompanyBranding, CompanyModel } from './company.interface';

const brandingSubSchema = new Schema<TCompanyBranding>(
  {
    primaryColor: { type: String, default: '#8ACDDE' },
    secondaryColor: { type: String, default: '#E9308F' },
    videoTitle: { type: String, default: '' },
    videoDescription: { type: String, default: '' },
    presenterName: { type: String, default: '' },
    presenterDesignation: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
  },
  { _id: false },
);

const companySchema = new Schema<TCompany, CompanyModel>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    address: { type: String, default: '' },
    logo: { type: String, default: '' },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    branding: { type: brandingSubSchema, default: () => ({}) },
  },
  { timestamps: true },
);

companySchema.statics.isCompanyExistsBySlug = async function (slug: string) {
  return await this.findOne({ slug });
};

export const Company = model<TCompany, CompanyModel>('Company', companySchema);
