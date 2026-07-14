import { Model, Types } from 'mongoose';

export type TCompanyStatus = 'active' | 'inactive' | 'suspended';

export interface TCompany {
  name: string;
  logo?: string;
  brandColor?: string;
  slug: string;
  status: TCompanyStatus;
}

export interface CompanyModel extends Model<TCompany> {
  isCompanyExistsBySlug(slug: string): Promise<TCompany>;
}
