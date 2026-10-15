import { ZodObject, ZodRawShape } from 'zod';
import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';



const validateRequest = (schema: ZodObject<ZodRawShape>) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const verifiedData = await schema.parseAsync({
      body: req.body,
    });
    req.body = verifiedData.body;
    next();
  });
};

export default validateRequest;
