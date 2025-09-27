const cron = require('node-cron');
import { schedulePurgeJob } from './purgeJob.js';
const { getAppointmentsForTomorrow } = require('../models/appointment.model');
const { sendMail } = require('../services/email.service');
const reminderEmail = require('../templates/reminderEmail');

cron.schedule('0 0 * * *', async () => {
  const appointments = getAppointmentsForTomorrow();

  for (const appt of appointments) {
    await sendMail(appt.patient.email, 'Appointment Reminder', reminderEmail(appt.patient.name, appt.date));
    await sendMail(appt.doctor.email, 'Appointment Reminder', reminderEmail(appt.doctor.name, appt.date));
  }

  console.log(`[${new Date().toISOString()}] Reminder emails sent.`);
});

// Schedule purge job
schedulePurgeJob(cron);
