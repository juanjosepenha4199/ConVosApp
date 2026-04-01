import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientInitializationError,
} from '@prisma/client/runtime/library';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof PrismaClientInitializationError) {
      this.logger.error(`Prisma init: ${exception.message}`);
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message:
          'No hay conexión con la base de datos. Levanta PostgreSQL (por ejemplo npm run db:up desde la raíz del repo), revisa DATABASE_URL en apps/api/.env y ejecuta npm run db:migrate.',
        code: 'DATABASE_UNAVAILABLE',
      });
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target =
          (exception.meta?.target as string[] | undefined)?.join(', ') ??
          'campo';
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: target.includes('email')
            ? 'EMAIL_ALREADY_IN_USE'
            : 'DUPLICATE_ENTRY',
          code: exception.code,
        });
      }
      if (exception.code === 'P2021' || exception.code === 'P1003') {
        this.logger.warn(`Prisma ${exception.code}: ${exception.message}`);
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message:
            'Faltan tablas o la base no existe. Ejecuta migraciones desde la raíz: npm run db:migrate (con Docker y Postgres en marcha).',
          code: exception.code,
        });
      }
      this.logger.warn(`Prisma ${exception.code}: ${exception.message}`);
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: `Error de base de datos (${exception.code}). ¿Ejecutaste las migraciones? (npm run db:migrate)`,
        code: exception.code,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return res.status(status).json({ statusCode: status, message: body });
      }
      return res.status(status).json(body);
    }

    const err =
      exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(err.stack ?? err.message);

    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: isDev ? err.message : 'Error interno del servidor',
      code: 'INTERNAL_ERROR',
    });
  }
}
