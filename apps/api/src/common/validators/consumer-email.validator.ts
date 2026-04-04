import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const CONSUMER_EMAIL_RE =
  /^[^\s@]+@(gmail\.com|outlook\.com|yahoo\.com)$/i;

export function IsConsumerEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isConsumerEmail',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return CONSUMER_EMAIL_RE.test(value.trim());
        },
        defaultMessage(_args: ValidationArguments) {
          return 'INVALID_EMAIL_PROVIDER';
        },
      },
    });
  };
}
