import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';

const userController = {
  // Get all users
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find();
      return ApiResponse.success(res, users, 'Users retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },

  // Get single user
  getUserById: async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return ApiResponse.error(res, 'User not found', 404);
      }
      return ApiResponse.success(res, user, 'User retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },
};

export default userController;
