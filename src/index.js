import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/database.js';
import errorHandler from './middleware/errorHandler.js';
import routes from './routes/index.js';
import appointmentsRouter from './controllers/appointments.controller.js'; 
import specs from './config/swagger.js';
import './cron/reminderJob.js'; 

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Swagger Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Uzima API Documentation"
}));

// Routes
app.use('/api', routes);
app.use('/appointments', appointmentsRouter); // Appointment routes

// Error handling
app.use(errorHandler);

// Stellar anchoring routes with logging middleware attached inside routes file
app.use('/stellar', stellarRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`API Documentation available at http://localhost:${port}/docs`);
});

export default app;
