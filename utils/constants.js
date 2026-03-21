/**
 * Global constants for the Seetha Dental Lounge system
 */

const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  PATIENT: 'patient'
};

const TOKEN_STATUS = {
  WAITING: 'waiting',
  CALLED: 'called',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled'
};

const SESSIONS = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon'
};

module.exports = {
  ROLES,
  TOKEN_STATUS,
  SESSIONS
};
