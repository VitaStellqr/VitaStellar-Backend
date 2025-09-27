/* eslint-disable prettier/prettier */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return res.status(403).json({ message: 'User not authenticated' });
    }

    const hasRole = req.user.roles.some(r => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ message: 'Insufficient role' });
    }

    next();
  };
}

export default requireRoles;
