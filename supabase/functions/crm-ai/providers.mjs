export const PROVIDERS=Object.freeze({openai:'OpenAI',anthropic:'Anthropic Claude',gemini:'Google Gemini'});
export function validateConfig(input,previous={}){
 const provider=String(input.provider||''),model=String(input.model||'').trim(),max_tokens=Number(input.max_tokens??1200),system_prompt=String(input.system_prompt||'').trim();
 if(!PROVIDERS[provider])throw Error('Select a supported AI provider');
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(model))throw Error('Enter a valid model ID');
 if(!Number.isInteger(max_tokens)||max_tokens<128||max_tokens>4096)throw Error('Output token limit must be 128–4096');
 if(system_prompt.length>4000)throw Error('System instruction is too long');
 const api_key=String(input.api_key||'').trim()||(provider===previous.provider?previous.api_key:'');
 if(!api_key||api_key.length<10||api_key.length>4096||/[\r\n\s]/.test(api_key))throw Error('Provide the provider API key');
 const changed=provider!==previous.provider||model!==previous.model||api_key!==previous.api_key||system_prompt!==previous.system_prompt||max_tokens!==previous.max_tokens;
 return {provider,model,max_tokens,system_prompt,api_key,enabled:input.enabled===true&&!changed&&!!previous.verified_at,verified_at:changed?null:previous.verified_at||null,last_error:changed?null:previous.last_error||null};
}
export function publicConfig(config){if(!config)return {configured:false,enabled:false,has_api_key:false};const {provider,model,max_tokens,system_prompt,enabled,verified_at,last_error,revision,updated_at}=config;return {configured:true,provider,model,max_tokens,system_prompt,enabled,verified_at,last_error,revision,updated_at,has_api_key:!!config.api_key};}
export async function callProvider(config,prompt,{system='',maxTokens,fetcher=fetch}={}){
 const limit=Math.min(config.max_tokens,Number.isInteger(maxTokens)&&maxTokens>=128?maxTokens:config.max_tokens);
 const instructions=[config.system_prompt,system].filter(Boolean).join('\n\n');let url,body,headers={'Content-Type':'application/json'};
 if(config.provider==='openai'){url='https://api.openai.com/v1/responses';headers.Authorization='Bearer '+config.api_key;body={model:config.model,input:prompt,instructions:instructions||undefined,max_output_tokens:limit,store:false};}
 else if(config.provider==='anthropic'){url='https://api.anthropic.com/v1/messages';headers['x-api-key']=config.api_key;headers['anthropic-version']='2023-06-01';body={model:config.model,messages:[{role:'user',content:prompt}],system:instructions||undefined,max_tokens:limit};}
 else if(config.provider==='gemini'){url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(config.model)+':generateContent';headers['x-goog-api-key']=config.api_key;body={contents:[{role:'user',parts:[{text:prompt}]}],systemInstruction:instructions?{parts:[{text:instructions}]}:undefined,generationConfig:{maxOutputTokens:limit}};}
 else throw Error('Unsupported provider');
 let response;try{response=await fetcher(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(45000),redirect:'error'});}catch{throw Error('AI provider could not be reached or timed out. Try again.');}
 if(!response.ok){const message=response.status===401||response.status===403?'API key or model access was rejected':response.status===429?'Provider quota or rate limit reached':response.status===404?'Model not found for this API':response.status===400?'Provider rejected model or request settings':'Provider is unavailable';throw Error(`${message} (HTTP ${response.status})`);}
 const data=await response.json().catch(()=>{throw Error('Provider returned an invalid response');});const text=config.provider==='openai'?(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n'):config.provider==='anthropic'?(data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n'):(data.candidates?.[0]?.content?.parts||[]).filter(x=>!x.thought).map(x=>x.text||'').join('\n');
 if(!text.trim())throw Error('The provider returned no text. Check model, token limit or safety settings.');return text;
}
