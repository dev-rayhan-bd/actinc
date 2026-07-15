import { z } from 'zod';

const hexColor = z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/, 'Invalid hex color');

const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Company name is required'),
    email: z.string().email('Valid email is required'),
    address: z.string().optional(),
  }),
});

const updateCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    slug: z.string().min(1).toLowerCase().optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  }),
});

const updateBrandingSchema = z.object({
  body: z.object({
    data: z.string().optional(), // JSON string from multipart/form-data
    primaryColor: hexColor.optional(),
    secondaryColor: hexColor.optional(),
    videoTitle: z.string().optional(),
    videoDescription: z.string().optional(),
    presenterName: z.string().optional(),
    presenterDesignation: z.string().optional(),
  }),
});

export const CompanyValidation = {
  createCompanySchema,
  updateCompanySchema,
  updateBrandingSchema,
};
