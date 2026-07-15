import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Team } from './team.model';
import { TTeam } from './team.interface';

const createTeamIntoDB = async (payload: TTeam) => {
  const result = await Team.create(payload);
  return result;
};

const getAllTeamsFromDB = async (
  query: Record<string, unknown>,
  userRole: string,
  companyId?: string,
) => {
  const filterQuery: Record<string, unknown> = {};

  // If logged in as company, only show their teams
  if (userRole === 'company' && companyId) {
    filterQuery.companyId = companyId;
  }

  const mergedQuery = { ...query, ...filterQuery };

  const queryBuilder = new QueryBuilder(Team.find(), mergedQuery);
  queryBuilder.search(['name']).filter().sort().paginate();
  const result = await queryBuilder.modelQuery;
  const meta = await queryBuilder.countTotal();
  return { meta, result };
};

const updateTeamInDB = async (
  id: string,
  payload: Partial<TTeam>,
  userRole: string,
  companyId?: string,
) => {
  // Company can only update their own teams
  if (userRole === 'company' && companyId) {
    const team = await Team.findById(id);
    if (!team) throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
    if (team.companyId.toString() !== companyId) {
      throw new AppError(httpStatus.FORBIDDEN, 'You can only update your own teams');
    }
  }
  const result = await Team.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }
  return result;
};

const deleteTeamFromDB = async (
  id: string,
  userRole: string,
  companyId?: string,
) => {
  // Company can only delete their own teams
  if (userRole === 'company' && companyId) {
    const team = await Team.findById(id);
    if (!team) throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
    if (team.companyId.toString() !== companyId) {
      throw new AppError(httpStatus.FORBIDDEN, 'You can only delete your own teams');
    }
  }
  const result = await Team.findByIdAndDelete(id);
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Team not found');
  }
  return result;
};

export const TeamServices = {
  createTeamIntoDB,
  getAllTeamsFromDB,
  updateTeamInDB,
  deleteTeamFromDB,
};
