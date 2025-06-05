import bcrypt from 'bcrypt';
import User from '../models/User.js';
import ApiResponse from '../utils/ApiResponse.js';
import generateToken from '../utils/generateToken.js';
import { registerSchema, loginSchema } from '../validations/authValidation.js';

const authController = {
  register: async (req, res) => {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(e => e.message).join('; ');
      return ApiResponse.error(res, 'errors.VALIDATION_ERROR', 400);
    }

    const { username, email, password, role } = value;

    try {
      // Check if email already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return ApiResponse.error(res, 'errors.EMAIL_EXISTS', 400);
        }
        if (existingUser.username === username) {
          return ApiResponse.error(res, 'errors.USERNAME_EXISTS', 400);
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role,
      });

      await user.save();

      // Prepare user data to return (exclude password)
      const { _id, username: userName, email: userEmail, role: userRole } = user;
      const resUser = {
        id: _id,
        username: userName,
        email: userEmail,
        role: userRole,
      };

      // Generate JWT token
      const token = generateToken(user);

      return ApiResponse.success(
        res,
        { user: resUser, token },
        'User registered successfully',
        201
      );
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },

  login: async (req, res) => {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map(e => e.message).join('; ');
      return ApiResponse.error(res, errors, 400);
    }

    const { email, password } = value;

    try {
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return ApiResponse.error(res, 'Invalid credentials', 401);
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return ApiResponse.error(res, 'Invalid credentials', 401);
      }

      // Prepare user data to return (exclude password)
      const { _id, username, email: userEmail, role } = user;
      const resUser = {
        id: _id,
        username,
        email: userEmail,
        role,
      };

      // Generate JWT token
      const token = generateToken(user);

      return ApiResponse.success(res, { user: resUser, token }, 'Login successful');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  },
};

export default authController;
