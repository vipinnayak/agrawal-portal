// Test what findMatchingEmployees produces for common queries
const STOP_WORDS = new Set([
  "today", "todays", "yesterday", "tomorrow", "now",
  "is", "was", "are", "were", "am", "be", "been", "being",
  "did", "does", "do", "has", "have", "had", "can", "could", "will", "would", "should",
  "the", "a", "an", "this", "that", "these", "those",
  "employee", "employees", "staff", "person", "persons", "people", "member", "members", "team",
  "late", "lateness", "absent", "absence", "absentees", "present", "presence", "attendance",
  "early", "earlier", "earliest", "login", "logins", "logged", "hour", "hours", "duration",
  "status", "report", "summary", "overview", "insight", "insights", "analytics", "record", "records", "sheet", "data", "datas",
  "or", "and", "not", "no", "yes", "both", "wrong", "fix", "fixed", "correct", "chatbot", "weekly", "monthly",
  "who", "whom", "whose", "which", "what", "where", "when", "why", "how",
  "many", "much", "all", "any", "total", "count", "number", "numbers",
  "full", "complete", "entire", "overall", "general", "list", "details", "detail",
  "punch", "punched", "in", "out", "check", "checked", "checking",
  "come", "came", "coming", "arrive", "arrived", "arriving",
  "work", "working", "works", "worked",
  "client", "clients", "office", "site", "sites", "place", "places", "location", "locations",
  "at", "to", "for", "from", "of", "with", "by", "on", "about", "into", "onto",
  "tell", "show", "give", "find", "get", "view", "display", "provide", "share",
  "me", "please", "sir", "madam", "mam", "hello", "hi", "hey", "good", "morning", "afternoon", "evening",
  "time", "cutoff", "cut", "off", "grace", "period",
  "plant", "audit", "article", "articles", "back", "backoffice",
  "senior", "seniors", "partner", "partners", "md", "director", "management",
  "individual", "want", "like", "need", "i", "namy", "days", "day", "too", "also", "their", "his", "her", "see", "info", "information", "regarding"
]);

const cleanString = (str) =>
  (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function testTargeted(query) {
  const cleanQ = cleanString(query);
  const qWords = cleanQ.split(" ").filter(Boolean);
  const contentWords = Array.from(new Set(qWords.filter((w) => !STOP_WORDS.has(w) && w !== "not")));

  const isTargetedSyntax =
    /^(is|was|did|has|check|where\s+is|tell\s+me\s+about|show|report|status\s+of|details\s+of|attendance\s+of)\s+/i.test(query.trim()) ||
    /\b(late or absent|absent or late|late and absent|status|attendance|report)\b/i.test(query);

  const isGeneralQuestion =
    /\b(how many|who is late|who is absent|who is present|who is at|summary|overview|all late|all absent|plant|article|articles|back office|seniors|partners|early login|working hours|work hours|hours worked|working hour)\b/i.test(query);

  const isQueryTargeted = contentWords.length > 0 && isTargetedSyntax && !isGeneralQuestion;

  return { contentWords, isQueryTargeted, isTargetedSyntax, isGeneralQuestion };
}

const testQueries = [
  "give me attendance data",
  "show attendance",
  "attendance data",
  "aaj kaun absent hai",
  "aaj ki attendance",
  "attendance status of today",
  "attendance of seniors",
  "who is absent today",
  "who is late today",
  "Show monthly attendance summary",
  "attendance of harsh mittal",
  "check harsh mittal status",
];

testQueries.forEach(q => {
  console.log(`Q: "${q}" ->`, testTargeted(q));
});

