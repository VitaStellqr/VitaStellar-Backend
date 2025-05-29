import Joi from 'joi';

export const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).trim().required().messages({
    'string.alphanum': 'Username can only contain alphanumeric characters',
    'string.empty': 'Username is required',
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username must be at most 30 characters long',
  }),

  email: Joi.string().email().trim().required().messages({
    'string.email': 'Invalid email format',
    'string.empty': 'Email is required',
  }),

  password: Joi.string()
    .min(8)
    .max(64)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])'))
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must be at most 64 characters long',
      'string.empty': 'Password is required',
    }),

  role: Joi.string().valid('patient', 'doctor', 'educator', 'admin').required().messages({
    'any.only': 'Invalid role specified',
    'string.empty': 'Role is required',
  }),
}).custom((value, helpers) => {
  if (value.password.toLowerCase().includes(value.username.toLowerCase())) {
    return helpers.message('Password cannot contain the username');
  }
  if (value.password.toLowerCase().includes(value.email.toLowerCase())) {
    return helpers.message('Password cannot contain the email');
  }
  return value;
});

export const loginSchema = Joi.object({
  email: Joi.string().email().trim().required().messages({
    'string.email': 'Invalid email format',
    'string.empty': 'Email is required',
  }),

  password: Joi.string().min(8).max(64).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must be at most 64 characters long',
    'string.empty': 'Password is required',
  }),
});
