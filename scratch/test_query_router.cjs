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
  "individual", "want", "like", "need", "i", "namy", "days", "day", "too", "also", "their", "his", "her", "see", "info", "information", "regarding",
  // Hinglish & Hindi common terms
  "aaj", "aajka", "aajki", "kal", "kalka", "parso", "abhi",
  "kaun", "koun", "kisko", "kiska", "kiski", "kitne", "kitna", "kitni", "kya", "kab", "kaha", "kyu", "kyun", "kaise",
  "batao", "bataiye", "dikhao", "dikhaye", "dikhiye", "bhejo", "do", "dijiye", "karo", "kariye", "hai", "hain", "tha", "the", "thi", "hoga", "honge",
  "aaya", "aaye", "aayi", "aana", "pahucha", "pahuchi", "pahuche", "log", "logo", "sab", "sabka", "sabhi", "saara", "poora",
  "chutti", "anupasthit", "upasthit", "der", "samay", "waqt", "kaisa", "kaisi", "kaise", "ai", "bot"
]);

const cleanString = (str) =>
  (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function isGeneralAttendanceQuery(q) {
  const cleanQ = cleanString(q);
  return (
    cleanQ === "attendance" ||
    cleanQ === "data" ||
    cleanQ === "attendance data" ||
    cleanQ === "show attendance" ||
    cleanQ === "give me attendance data" ||
    cleanQ === "give me data" ||
    cleanQ === "aaj ki attendance" ||
    cleanQ === "attendance report" ||
    /\b(attendance|attendance data|summary|report|overview|daily|today|aaj|all attendance|all staff|everyone|status|insight|register|log|logs|punch|punches|attendance report|details)\b/i.test(q)
  );
}

console.log("give me attendance data ->", isGeneralAttendanceQuery("give me attendance data"));
console.log("show attendance ->", isGeneralAttendanceQuery("show attendance"));
console.log("aaj ki attendance ->", isGeneralAttendanceQuery("aaj ki attendance"));
console.log("attendance ->", isGeneralAttendanceQuery("attendance"));
console.log("data ->", isGeneralAttendanceQuery("data"));
console.log("who is late today ->", isGeneralAttendanceQuery("who is late today"));

