import { getAppointments, getAppointmentsForTomorrow } from '../model/appointmentModel';
import RecordModel from '../models/Record';
import UserModel from '../models/User';

export const resolvers = {
  Query: {
    record: async (_: any, { id }: { id: string }, { user }) => {
      if (user.role !== 'doctor') throw new Error('Unauthorized');
      return await RecordModel.findById(id);
    },
    appointments: async (_: any, __: any, { user }) => {
      if (!['doctor', 'admin'].includes(user.role)) throw new Error('Unauthorized');
      return getAppointmentsForTomorrow();
    },
    me: async (_: any, __: any, { user }) => {
      return await UserModel.findById(user.id);
    },
  },
};