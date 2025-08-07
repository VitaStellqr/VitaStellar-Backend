
import express from 'express';
const app = express();
app.use(express.json());

// Register recommendation routes
const recommendationRoutes = require('../routes/recommendationRoutes');
app.use('/api/recommendations', recommendationRoutes);

await setupGraphQL(app);

import { Express } from 'express';

export async function setupGraphQL(app: Express) {
  
}

app.listen(4000, () => console.log('Server running at http://localhost:4000/graphql'));