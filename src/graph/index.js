import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import bodyParser from 'body-parser';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { auth, getUserContext } from '../middleware/authMiddleware.js';

export async function setupGraphQL(app) {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use(
    '/graphql',
    auth,
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const user = await getUserContext(req);
        return { user };
      },
    })
  );
}
