import type { Email, EmailCategory, Priority, NeedleAnalysis, ResponsePlan } from "../domain/types.ts";

export class NeedleMockTransport {
  async generate(input: string, tools: unknown[]): Promise<unknown> {
    const parsed = JSON.parse(input);
    if (parsed.task === "analyze_email") {
      return this.mockAnalyzeEmail(parsed.email);
    }
    if (parsed.task === "plan_contextual_response") {
      return this.mockPlanResponse(parsed.email, parsed.threadContext);
    }
    throw Error(`Unknown task: ${parsed.task}`);
  }

  private mockAnalyzeEmail(email: Email): NeedleAnalysis {
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.body.toLowerCase();

    // Determine category based on keywords
    let category: EmailCategory = "other";
    if (subjectLower.includes("invoice") || bodyLower.includes("invoice") || subjectLower.includes("bill") || bodyLower.includes("payment")) category = "invoice";
    else if (subjectLower.includes("meeting") || bodyLower.includes("calendar") || subjectLower.includes("call")) category = "meeting";
    else if (subjectLower.includes("support") || bodyLower.includes("help") || bodyLower.includes("issue")) category = "support";
    else if (subjectLower.includes("sales") || bodyLower.includes("prospect") || bodyLower.includes("quote")) category = "sales";
    else if (subjectLower.includes("shipping") || bodyLower.includes("delivery") || bodyLower.includes("tracking")) category = "shipping";
    else if (subjectLower.includes("hr") || bodyLower.includes("employee") || bodyLower.includes("staff")) category = "hr";
    else if (subjectLower.includes("legal") || bodyLower.includes("contract")) category = "legal";
    else if (subjectLower.includes("social") || bodyLower.includes("newsletter")) category = "newsletter";

    // Determine priority
    let priority: Priority = "normal";
    if (subjectLower.includes("urgent") || bodyLower.includes("urgent") || email.priority === "urgent") priority = "urgent";
    else if (subjectLower.includes("high priority") || bodyLower.includes("high priority")) priority = "high";

    // Determine if action is required
    const actionKeywords = ["action", "approve", "review", "decide", "respond", "reply", "confirm", "confirmation"];
    const actionRequired = actionKeywords.some(k => subjectLower.includes(k) || bodyLower.includes(k));

    // Determine requested action
    let requestedAction: string | undefined;
    if (email.body.toLowerCase().includes("approve")) requestedAction = "approve";
    else if (email.body.toLowerCase().includes("review")) requestedAction = "review";
    else if (email.body.toLowerCase().includes("reply")) requestedAction = "send_reply";
    else if (email.body.toLowerCase().includes("forward")) requestedAction = "send_forward";

    // Extract people (simple pattern: names after "from", "send to", "john", "jane")
    const people: string[] = [];
    const nameMentions = email.body.match(/\b(john|jane|mike|sarah|dave|linda)\b/gi) || [];
    people.push(...nameMentions);

    // Extract companies
    const companies: string[] = [];
    const companyMentions = email.body.match(/\b(google|microsoft|apple|amazon|meta|twitter)\b/gi) || [];
    companies.push(...companyMentions);

    const confidence = 0.85;

    return {
      category,
      priority,
      priorityReasons: [`Mock analysis of: ${email.subject.substring(0, 50)}`],
      actionRequired: actionRequired,
      requestedAction: requestedAction,
      deadline: email.subject.includes("by") ? email.body.match(/by [A-Za-z]+ \d+/)?.[0] : undefined,
      people: Array.from(new Set(people)).slice(0, 5),
      companies: Array.from(new Set(companies)).slice(0, 3),
      confidence,
      responseRequired: actionRequired,
      responsePlan: {
        intent: "mock_response",
        tone: "professional",
        purpose: ["Process mock email for testing"],
        factsToInclude: [],
        questionsToAnswer: [],
        templateType: "standard",
        confidence
      }
    } as NeedleAnalysis;
  }

  private mockPlanResponse(email: Email, threadContext?: Email[]): ResponsePlan {
    return {
      intent: "mock_response",
      tone: "professional",
      purpose: ["Process mock email for testing"],
      factsToInclude: [],
      questionsToAnswer: [],
      requestedAction: undefined,
      templateType: "standard",
      confidence: 0.85
    } as ResponsePlan;
  }
}
