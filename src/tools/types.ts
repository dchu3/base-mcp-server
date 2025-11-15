import type { ZodTypeAny } from 'zod';

import type { BlockscoutClient } from '../blockscout.js';
import type { RouterMap } from '../routers.js';

export interface ToolContext {
  client: BlockscoutClient;
  routers: RouterMap;
}

type Infer<TSchema extends ZodTypeAny> = TSchema['_type'];

export interface ToolDefinition<TInput extends ZodTypeAny, TResult extends ZodTypeAny> {
  name: string;
  description: string;
  input: TInput;
  output: TResult;
  execute: (args: Infer<TInput>, context: ToolContext) => Promise<Infer<TResult>>;
}
