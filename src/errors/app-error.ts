export interface FieldError {
  path: string;
  message: string;
}

interface AppErrorOptions extends ErrorOptions {
  errors?: FieldError[];
}

export class AppError extends Error {
  readonly status: number;
  readonly errors: FieldError[] | undefined;

  constructor(status: number, message: string, options: AppErrorOptions = {}) {
    super(message, options);
    this.name = new.target.name;
    this.status = status;
    this.errors = options.errors;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(503, message, options);
  }
}
