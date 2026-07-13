import { z } from 'zod';

const locationSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  zipCode: z.string().optional(),
});

const socialLinksSchema = z.object({
  instagram: z.string().url().optional().or(z.literal('')),
  facebook: z.string().url().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
});


const availabilitySchema = z.array(
  z.object({
    day: z.string(),
    isOpen: z.boolean(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  })
).optional();


export const updateUserValidationSchema = z.object({


    data: z.string().transform((str) => JSON.parse(str)).pipe(
      z.object({

        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        phone: z.string().optional(),
        lat: z.number().optional(),
        long: z.number().optional(),
        
   
        vendor: z.object({
          businessName: z.string().optional(),
          ownerName: z.string().optional(),
          whatsappNumber: z.string().optional(),
          location: locationSchema.optional(),
          lat: z.number().optional(),
          long: z.number().optional(),
          googleMapLink: z.string().url().optional().or(z.literal('')),
          businessDetails: z.string().optional(),
          experienceYears: z.number().min(0).optional(),
          teamSize: z.number().min(1).optional(),
          categories: z.array(z.string()).optional(),
          serviceArea: z.array(z.string()).optional(),
          socialLinks: socialLinksSchema.optional(),
          availability: availabilitySchema,
          documents: z.array(z.string()).optional(),
          portfolio: z.array(z.string()).optional(),
        }).optional(),
      })
    ),

});


export const updatePortfolioValidationSchema = z.object({
  body: z.object({

    portfolio: z.array(z.string()).optional(),
  }),
});

export const vendorDocumentValidationSchema = z.object({
  body: z.object({

    documents: z.array(z.string()).optional(),
  }),
});

export const UserValidations = {
  updateUserValidationSchema,
  updatePortfolioValidationSchema,
  vendorDocumentValidationSchema,
};