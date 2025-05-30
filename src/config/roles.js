const roles = {
  admin: ['create_record', 'view_records', 'manage_users', 'view_users'],
  doctor: ['create_record', 'view_records'],
  patient: ['view_own_record'],
  educator: ['view_own_record'],
};

export default roles;
