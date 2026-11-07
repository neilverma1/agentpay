import * as agent from './agent';
import * as auth from './auth';
import * as chat from './chat';
import * as commerce from './commerce';
import * as relations from './relations';
import * as validation from './validation';

export const schema = {
  ...auth,
  ...agent,
  ...commerce,
  ...chat,
  ...relations,
  ...validation,
};

export * from './agent';
export * from './auth';
export * from './chat';
export * from './commerce';
export * from './relations';
export * from './validation';
