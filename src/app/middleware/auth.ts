// import { NextFunction, Request, Response } from 'express';
// import httpStatus from 'http-status';
// import { JwtPayload, Secret } from 'jsonwebtoken';
// import config from '../config'; 

// import catchAsync from '../utils/catchAsync';
// import AppError from '../errors/AppError';
// import { verifyToken } from '../modules/Auth/auth.utils';
// import { TUserRole } from '../modules/User/user.interface';
// import { User } from '../modules/User/user.model';
// import { Admin } from '../modules/Admin/admin.model';




// const auth = (...requiredRoles: TUserRole[]) => {
//   return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
//     const authHeader = req.headers.authorization;
//     const token = authHeader && authHeader.split(' ')[1];
// // console.log("checking token -------------->",token); 
//     // checking if the token is missingg

//     if (!token) {
//       // console.log("token null");
//       throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
//     }

//     // checking if the given token is valid
// const decodedUser = verifyToken(token, config.jwt_access_secret as string) as JwtPayload & { userId: string; role: TUserRole };
//     const { role, userId, iat } = decodedUser;
//     // console.log("checking decoded User -------------->",role);
    
//     // checking if the user is exist
//     const user = await User.isUserExistsById(userId);

//     if (!user) {
//       throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
//     }
// if (user) {
//   await User.findByIdAndUpdate((user as any)._id, { lastActiveAt: new Date() });
// }
//     if (requiredRoles && !requiredRoles.includes(role)) {
//       throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized !');
//     }

//     if (
//       user.passwordChangedAt &&
//       User.isJWTIssuedBeforePasswordChanged(
//         user.passwordChangedAt,
//         iat as number,
//       )
//     ) {
//       throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized !');
//     }

//     req.user = decodedUser as JwtPayload & { role: string };
//     next();
//   });
// };

// export default auth;
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { JwtPayload, Secret } from 'jsonwebtoken';
import config from '../config';
import AppError from '../errors/AppError';
import catchAsync from '../utils/catchAsync';
import { verifyToken } from '../modules/Auth/auth.utils';
import { User } from '../modules/User/user.model';
import { Admin } from '../modules/Admin/admin.model'; 

const auth = (...requiredRoles: string[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

   
    const decoded = verifyToken(token, config.jwt_access_secret as Secret) as JwtPayload;
    const { role, userId, iat } = decoded;

    let user = null;


    if (role === 'admin' || role === 'superAdmin') {
      user = await Admin.findById(userId); 
    } else {
      user = await User.isUserExistsById(userId);
    }

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'This user is not found !');
    }


    if (user.status === 'blocked') {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked !');
    }


    if (
        role !== 'admin' && role !== 'superAdmin' &&
        (user as any).passwordChangedAt &&
        User.isJWTIssuedBeforePasswordChanged((user as any).passwordChangedAt, iat as number)
    ) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized !');
    }

    if (requiredRoles.length && !requiredRoles.includes(role)) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized !');
    }

    req.user = decoded;
    next();
  });
};

export default auth;