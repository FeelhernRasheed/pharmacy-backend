import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  EnvValidationError,
  isSwaggerEnabled,
  resolveCorsOptions,
  validateEnv,
} from './config/env.validation';

async function bootstrap() {
  // Pre-flight validation so configuration errors are reported
  // before NestJS boots, without an internal stack trace.
  validateEnv(process.env);

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const nodeEnv = config.get<string>(
    'NODE_ENV',
    'development',
  );

  app.enableShutdownHooks();

  app.enableCors(
    resolveCorsOptions(nodeEnv, config.get<string>('CORS_ORIGIN')),
  );

  if (
    isSwaggerEnabled(nodeEnv, config.get<string>('SWAGGER_ENABLED'))
  ) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Pharmacy Management System API')
      .setDescription(
        'Backend API documentation for the Pharmacy Management System.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'bearer',
      )
      .build();

    const document = SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );

    SwaggerModule.setup('api-docs', app, document);
  }

  const port = config.get<number>('PORT', 3000);
  const host = config.get<string>('HOST', '0.0.0.0');

  await app.listen(port, host);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }

  const detail =
    error instanceof Error
      ? (error.stack ?? error.message)
      : String(error);
  process.stderr.write(`Fatal startup error: ${detail}\n`);
  process.exit(1);
});
