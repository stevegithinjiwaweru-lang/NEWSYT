import { Express } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Easybox Logistics API",
      version: "0.1.0",
      description: "API documentation for Easybox Logistics backend",
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:4000/api",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts"],
};

const specs = swaggerJsdoc(options);

export default function registerSwagger(app: Express): void {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
}