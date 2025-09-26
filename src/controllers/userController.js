
import User from '../models/User.js';
import ApiResponse from '../utils/ApiResponse.js';
import transactionLog from '../models/transactionLog.js';

const userController = {
  // Get all users (with optional soft-deleted)
  getAllUsers: async (req, res) => {
    const { includeDeleted, page = 1, limit = 20 } = req.query;
    try {
      const query = includeDeleted === 'true' ? {} : { deletedAt: null };
      const users = await User.find(query)
        .skip((page - 1) * limit)
        .limit(Number(limit));
      if (!users || users.length === 0) {
        return ApiResponse.error(res, 'No users found', 404);
      }
      const resUsers = users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      }));
      return ApiResponse.success(res, resUsers, 'Users retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },

  // Get single user
  getUserById: async (req, res) => {
    try {
      const user = await User.findOne({ _id: req.params.id, deletedAt: null });
      if (!user) {
        return ApiResponse.error(res, 'User not found', 404);
      }
      const { _id, username, email, role } = user;
      const resUser = {
        id: _id,
        username,
        email,
        role,
      };
      return ApiResponse.success(res, resUser, 'User retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },

  // Restore soft-deleted user
  restoreUser: async (req, res) => {
    try {
      const user = await User.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
      if (!user) {
        return ApiResponse.error(res, 'User not found or not deleted', 404);
      }
      user.deletedAt = null;
      user.deletedBy = null;
      await user.save();
      await transactionLog.create({
        action: 'restore',
        resource: 'User',
        resourceId: user._id,
        performedBy: req.user?._id || 'admin',
        timestamp: new Date(),
        details: 'User restored by admin.'
      });
      return ApiResponse.success(res, null, 'User restored successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },

  // Permanently purge user
  purgeUser: async (req, res) => {
    try {
      const user = await User.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
      if (!user) {
        return ApiResponse.error(res, 'User not found or not deleted', 404);
      }
      await user.deleteOne();
      await transactionLog.create({
        action: 'purge',
        resource: 'User',
        resourceId: user._id,
        performedBy: req.user?._id || 'admin',
        timestamp: new Date(),
        details: 'User permanently purged by admin.'
      });
      return ApiResponse.success(res, null, 'User permanently purged');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },
};

export default userController;
