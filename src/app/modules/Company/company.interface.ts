import { Model, Types } from 'mongoose';

export type TCompanyStatus = 'active' | 'inactive' | 'suspended';

export interface TCompanyBranding {
  primaryColor: string;
  secondaryColor: string;
  videoTitle: string;
  videoDescription: string;
  presenterName: string;
  presenterDesignation: string;
  videoUrl: string;
}

export interface TCompany {
  name: string;
  email: string;
  address: string;
  logo: string;
  slug: string;
  status: TCompanyStatus;
  isDeleted: boolean;
  branding: TCompanyBranding;
}

export interface CompanyModel extends Model<TCompany> {
  isCompanyExistsBySlug(slug: string): Promise<TCompany>;
}
