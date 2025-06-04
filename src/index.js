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
import stellarRoutes from './routes/stellar.js';
import { setupGraphQL } from './graphql/index.js'; // ✅ Import GraphQL setup
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
app.use('/appointments', appointmentsRouter);
app.use('/stellar', stellarRoutes);

// GraphQL Setup
await setupGraphQL(app); // ✅ Add this line

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`API Documentation available at http://localhost:${port}/docs`);
  console.log(`GraphQL Playground available at http://localhost:${port}/graphql`);
});

export default app;