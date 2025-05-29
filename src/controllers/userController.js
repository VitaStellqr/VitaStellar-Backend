import User from '../models/User.js';
import ApiResponse from '../utils/ApiResponse.js';

const userController = {
  // Get all users
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find();
      if (!users || users.length === 0) {
        return ApiResponse.error(res, 'No users found', 404);
      }
      // Map and return cleaned user data
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
      const user = await User.findById(req.params.id);
      if (!user) {
        return ApiResponse.error(res, 'User not found', 404);
      }
      // Map and return cleaned user data
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
};

export default userController;
