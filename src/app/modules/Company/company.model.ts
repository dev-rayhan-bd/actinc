import { Schema, model } from 'mongoose';
import { TCompany, CompanyModel } from './company.interface';

const companySchema = new Schema<TCompany, CompanyModel>(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    brandColor: { type: String, default: '#3B82F6' },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
  },
  { timestamps: true },
);

companySchema.statics.isCompanyExistsBySlug = async function (slug: string) {
  return await this.findOne({ slug });
};

export const Company = model<TCompany, CompanyModel>('Company', companySchema);
