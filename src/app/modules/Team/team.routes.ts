import express from 'express';
import validateRequest from '../../middleware/validateRequest';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../Auth/auth.constant';
import { TeamControllers } from './team.controller';
import { TeamValidation } from './team.validation';

const router = express.Router();

// ── superAdmin or company ──
router.post(
  '/create-team',
  auth(USER_ROLE.superAdmin, USER_ROLE.company),
  validateRequest(TeamValidation.createTeamSchema),
  TeamControllers.createTeam,
);

router.get(
  '/',
  auth(USER_ROLE.superAdmin, USER_ROLE.company),
  TeamControllers.getAllTeams,
);

router.patch(
  '/:id',
  auth(USER_ROLE.superAdmin, USER_ROLE.company),
  validateRequest(TeamValidation.updateTeamSchema),
  TeamControllers.updateTeam,
);

router.delete(
  '/:id',
  auth(USER_ROLE.superAdmin, USER_ROLE.company),
  TeamControllers.deleteTeam,
);

export const TeamRoutes = router;
