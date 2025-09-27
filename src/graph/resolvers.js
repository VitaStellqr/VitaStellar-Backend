import { getAppointments, getAppointmentsForTomorrow } from '../model/appointmentModel.js';
import RecordModel from '../models/Record.js';
import UserModel from '../models/User.js';

export const resolvers = {
  Query: {
    record: async (_, { id }, { user }) => {
      if (user.role !== 'doctor') throw new Error('Unauthorized');
      return await RecordModel.findById(id);
    },
    appointments: async (_, __, { user }) => {
      if (!['doctor', 'admin'].includes(user.role)) throw new Error('Unauthorized');
      return getAppointmentsForTomorrow();
    },
    me: async (_, __, { user }) => {
      return await UserModel.findById(user.id);
    },
  },
};
