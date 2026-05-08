import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Minlish API',
      version: '1.0.0',
      description: `
## Minlish — English Learning Platform API

Tài liệu API tự động. Nhấn **Authorize** để nhập Access Token trước khi test các route được bảo vệ.

### Cách sử dụng:
1. Gọi \`POST /api/auth/login\` để lấy \`accessToken\`
2. Nhấn nút **Authorize** (🔒) ở góc trên phải
3. Nhập: \`Bearer <accessToken>\`
4. Giờ bạn có thể gọi tất cả các API protected
      `,
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập Access Token (không cần thêm chữ "Bearer", Swagger tự thêm)',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  // Quét tất cả file route và controller để lấy JSDoc comments
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Giao diện Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Minlish API Docs',
      swaggerOptions: {
        persistAuthorization: true, // Giữ token sau khi refresh trang
      },
    })
  );

  // Endpoint trả raw JSON spec (để import vào Postman nếu cần)
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(`📖 Swagger UI: http://localhost:${process.env.PORT || 3000}/api-docs`);
};
