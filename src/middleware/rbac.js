import roles from '../config/roles.js';

const hasPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user || !user.role) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userPermissions = roles[user.role] || [];

    const isAuthorized = requiredPermissions.some(permission =>
      userPermissions.includes(permission)
    );

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

export default hasPermission;
