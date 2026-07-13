import express, { NextFunction, Request, Response } from 'express';
import { AuthControllers } from './auth.controller';
import { USER_ROLE } from './auth.constant';
import { AuthValidation } from './authValidation';
import validateRequest from '../../middleware/validateRequest';
import auth from '../../middleware/auth';
import { upload } from '../../middleware/multer';

const router = express.Router();

router.post('/register', upload.single('image') as any, (req: Request, res: Response, next: NextFunction) => {
    if (req.body.body) req.body = JSON.parse(req.body.body);
    next();
  }, AuthControllers.registerUser
);

router.post('/resendOtp', AuthControllers.resendOtp);
router.post('/login', validateRequest(AuthValidation.loginSchema), AuthControllers.userLogin);
router.post('/admin/login', validateRequest(AuthValidation.loginSchema), AuthControllers.AdminLogin);
router.post('/changePassword', auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.admin, USER_ROLE.superAdmin), validateRequest(AuthValidation.changePasswordSchema), AuthControllers.changePassword);


router.post('/refresh-token', AuthControllers.refreshToken);
router.post('/forgotPass', AuthControllers.forgotPassword);
router.post('/resetPass', AuthControllers.resetPassword);

router.post('/regOtpVerify', validateRequest(AuthValidation.verifyOtpSchema), AuthControllers.VerifyOtpForRegistration);
router.post('/logout', auth(USER_ROLE.user, USER_ROLE.vendor, USER_ROLE.admin), AuthControllers.logout);



export const AuthRoutes = router;