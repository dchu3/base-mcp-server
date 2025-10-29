import { z } from 'zod';

import type { BlockscoutClient } from '../blockscout.js';
import type { RouterMap } from '../routers.js';

export interface ToolContext {
  client: BlockscoutClient;
  routers: RouterMap;
}

export interface ToolDefinition<TInput extends z.ZodTypeAny, TResult extends z.ZodTypeAny> {
  name: string;
  description: string;
  input: TInput;
  output: TResult;
  execute: (args: z.infer<TInput>, context: ToolContext) => Promise<z.infer<TResult>>;
}
