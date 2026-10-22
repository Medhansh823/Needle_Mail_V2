import type {ActionProposal,ActionType} from "../domain/types.ts";

const requiredArgs:Partial<Record<ActionType,string[]>>={
  label:["label"], remove_label:["label"], move:["destination"], create_task:["title"], create_reminder:["title"],
  create_draft:["to","subject","body"], send_reply:["body"], send_forward:["to"], bulk_action:["operations"]
};
const forbiddenKeys=new Set(["command","shell","exec","eval","url","oauth_token","access_token","refresh_token"]);
export function validateActionProposal(p:ActionProposal):void{
  if(!p.id||!p.action)throw new Error("Malformed action proposal");
  if(!Number.isFinite(p.confidence)||p.confidence<0||p.confidence>1)throw new Error("Invalid confidence");
  if(!p.args||typeof p.args!=="object")throw new Error("Invalid action arguments");
  for(const k of Object.keys(p.args))if(forbiddenKeys.has(k.toLowerCase()))throw new Error("Forbidden action argument");
  for(const key of requiredArgs[p.action]??[])if(!(key in p.args))throw new Error("Missing required argument: "+key);
}
export function sanitizeUntrustedEmailText(text:string,max=50000){
  // Normalize Unicode to prevent homograph attacks
  let sanitized = text.normalize("NFKC");
  
  // Remove/escape potential HTML/script tags to prevent XSS
  sanitized = sanitized
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&/g, '&')  // Escape HTML entities
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Limit length to prevent DoS
  return sanitized.slice(0, max);
}
