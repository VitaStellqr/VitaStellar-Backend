import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Uzima API Documentation',
      version: '1.0.0',
      description: 'API documentation for Uzima Healthcare Platform',
      contact: {
        name: 'Uzima Support',
        url: 'https://github.com/Stellar-Uzima/Uzima-Backend',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

export default specs; 