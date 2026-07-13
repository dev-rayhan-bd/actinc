import { z } from 'zod';

export const createEventRequestSchema = z.object({
  body: z.object({
    eventType: z.string().min(1, 'Event type is required'),
    eventDate: z.string().min(1, 'Event date is required'),
    guestCount: z.number().min(1, 'Guest count must be at least 1'),
    budgetMin: z.number().min(0, 'Minimum budget must be >= 0'),
    budgetMax: z.number().min(0, 'Maximum budget must be >= 0'),
    area: z.string().min(1, 'Area/Location is required'),
    serviceCategory: z.string().min(1, 'Service category is required'),
    additionalDetails: z.string().optional(),
    referenceImages: z.array(z.string()).optional(),
  }),
});

export const updateEventRequestStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'closed', 'cancelled'], {
      required_error: 'Status is required',
    }),
  }),
});
