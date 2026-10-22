const patterns = [
  /ignore (all|any|the )?previous (instructions|prompts|directions|commands)/i,
  /system (prompt|message)/i,
  /developer (message|prompt|mode)/i,
  /reveal (your|the) (prompt|instructions|system|key|secret|token|password)/i,
  /disable (security|permissions|approval|safety|filter|guard)/i,
  /send (an )?(email|message|mail|sms|text)/i,
  /delete (all|these|my|every) (email|emails|messages|mails?)/i,
  /you are now (in|a) (developer|debug|admin|root|sudo) mode/i,
  /forget (?:everything|all|any)?(?: (above|before|prior))?(?: (instructions|context|data))?/i,
  /override (security|safety|ethical|moral) (guidelines|constraints|limitations)/i,
  /<script[^>]*>.*<\/script>/i, // Basic XSS attempt
  /javascript:/i, // JS protocol
  /data:text\/html/i, // Data URI XSS
  /eval\s*\(/i, // Code execution attempt
  /(alert|confirm|prompt)\s*\(/i, // Browser dialogs
];

export interface InjectionSignal {
  detected: boolean;
  matches: string[];
}

export function detectPromptInjection(text: string): InjectionSignal {
  const matches = patterns.filter((p) => p.test(text)).map(String);
  return { detected: matches.length > 0, matches };
}
