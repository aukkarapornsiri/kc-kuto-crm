import {handleExperience} from './handler.mjs';
Deno.serve((request: Request)=>handleExperience(request,(name: string)=>Deno.env.get(name)||''));
