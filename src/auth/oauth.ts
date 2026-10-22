import{randomBytes,createHash,timingSafeEqual}from"node:crypto";
export interface OAuthState{state:string;codeVerifier:string;codeChallenge:string;createdAt:number;userId:string}
export function createPkceState(userId:string):OAuthState{const codeVerifier=randomBytes(32).toString("base64url");const codeChallenge=createHash("sha256").update(codeVerifier).digest("base64url");return{state:randomBytes(32).toString("base64url"),codeVerifier,codeChallenge,createdAt:Date.now(),userId}}
export function verifyState(expected:string,received:string){if(!expected||!received)return false;const a=Buffer.from(expected);const b=Buffer.from(received);return a.length===b.length&&timingSafeEqual(a,b)}
export function isFresh(createdAt:number,maxAgeMs=10*60*1000){return Number.isFinite(createdAt)&&Date.now()-createdAt>=0&&Date.now()-createdAt<=maxAgeMs}
export function gmailScopes(){return["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/gmail.modify","https://www.googleapis.com/auth/gmail.send"]}
