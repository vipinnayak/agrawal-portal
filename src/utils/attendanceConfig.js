// src/utils/attendanceConfig.js

export const EMPLOYEE_MASTER_API =
  "https://script.google.com/macros/s/AKfycbzp9jjuDv3H_T85SNi75ZJlLjKDlMB2NFlMaxZTVCG-C5VRDuM6OWd_KLwRatBWlmPzRA/exec";

// Default shift policies with punch-in cutoffs and grace periods
export const DEFAULT_SHIFT_POLICIES = {
  PLANT_AUDIT: {
    key: "PLANT_AUDIT",
    categoryKey: "PLANT_AUDIT",
    label: "Plant Audit Staff",
    shortLabel: "Plant Audit",
    icon: "🏭",
    cutoff: "10:30",      // Official cutoff time (10:30 AM)
    grace: "10:35",       // Grace period until (10:35 AM)
    shiftStart: "10:35",
    color: "#f97316",     // Orange
    badgeClass: "badge-plant",
  },
  ARTICLE: {
    key: "ARTICLE",
    categoryKey: "ARTICLE",
    label: "Article Staff",
    shortLabel: "Articles",
    icon: "📚",
    cutoff: "11:00",      // Official cutoff time (11:00 AM)
    grace: "11:05",       // Grace period until (11:05 AM)
    shiftStart: "11:05",
    color: "#10b981",     // Green
    badgeClass: "badge-article",
  },
  BACK_OFFICE: {
    key: "BACK_OFFICE",
    categoryKey: "BACK_OFFICE",
    label: "Back Office Staff",
    shortLabel: "Back Office",
    icon: "🏢",
    cutoff: "10:00",      // Official cutoff time (10:00 AM)
    grace: "10:05",       // Grace period until (10:05 AM)
    shiftStart: "10:05",
    color: "#2563eb",     // Blue
    badgeClass: "badge-office",
  },
  SENIOR: {
    key: "SENIOR",
    categoryKey: "SENIOR",
    label: "Seniors",
    shortLabel: "Seniors",
    icon: "👔",
    cutoff: "10:00",      // Official cutoff time (10:00 AM)
    grace: "10:05",       // Grace period until (10:05 AM)
    shiftStart: "10:05",
    color: "#0f766e",     // Teal
    badgeClass: "badge-senior",
  },
  PARTNER: {
    key: "PARTNER",
    categoryKey: "PARTNER",
    label: "Partners",
    shortLabel: "Partners",
    icon: "🤝",
    cutoff: "10:00",      // Official cutoff time (10:00 AM)
    grace: "10:05",       // Grace period until (10:05 AM)
    shiftStart: "10:05",
    color: "#7c3aed",     // Purple
    badgeClass: "badge-partner",
  },
  MD: {
    key: "MD",
    categoryKey: "MD",
    label: "Managing Director (MD)",
    shortLabel: "MD",
    icon: "👑",
    cutoff: "10:00",      // Official cutoff time (10:00 AM)
    grace: "10:05",       // Grace period until (10:05 AM)
    shiftStart: "10:05",
    color: "#dc2626",     // Red / Crimson
    badgeClass: "badge-md",
  },
};

// Seed mapping of known staff in AJC ERP
export const KNOWN_EMPLOYEES_MAP = {
  // Plant Staff / Plant Audit
  "dayalu dewangan": "PLANT_AUDIT",
  "dayalu": "PLANT_AUDIT",
  "gauri sharma": "PLANT_AUDIT",
  "gauri": "PLANT_AUDIT",
  "gaurishankar sharma": "PLANT_AUDIT",
  "gauri shankar sharma": "PLANT_AUDIT",
  "gaurishankar": "PLANT_AUDIT",
  "gauri shankar": "PLANT_AUDIT",
  "sr-gaurishankar sharma": "PLANT_AUDIT",
  "sr gaurishankar sharma": "PLANT_AUDIT",
  "sr-gauri sharma": "PLANT_AUDIT",
  "sr gauri sharma": "PLANT_AUDIT",
  "Gaurishankar Sharma": "PLANT_AUDIT",
  "Gauri Shankar Sharma": "PLANT_AUDIT",
  "Gauri Sharma": "PLANT_AUDIT",
  "Sr-Gaurishankar Sharma": "PLANT_AUDIT",
  "jitu tati": "PLANT_AUDIT",
  "jitu": "PLANT_AUDIT",
  "khemlal sahu": "PLANT_AUDIT",
  "khemlal": "PLANT_AUDIT",
  "kundan yadav": "PLANT_AUDIT",
  "kundan": "PLANT_AUDIT",
  "lakhan lal": "PLANT_AUDIT",
  "lakhan": "PLANT_AUDIT",
  "nitish shende": "PLANT_AUDIT",
  "nitish sindhe": "PLANT_AUDIT",
  "nitish": "PLANT_AUDIT",
  "tr dewangan": "PLANT_AUDIT",
  "t r dewangan": "PLANT_AUDIT",
  "sr tr dewangan": "PLANT_AUDIT",
  "sr-tr dewangan": "PLANT_AUDIT",
  "tr": "PLANT_AUDIT",
  "TR Dewangan": "PLANT_AUDIT",
  "Sr-TR Dewangan": "PLANT_AUDIT",
  "akash yadav": "PLANT_AUDIT",
  "rohit vibhar": "PLANT_AUDIT",
  "vikas singh": "PLANT_AUDIT",

  // Articles (Verified 31 Articles)
  "aditya raj singh": "ARTICLE",
  "aditya raj": "ARTICLE",
  "akshita agrawal": "ARTICLE",
  "akshita agrwal": "ARTICLE",
  "anirudh agrawal": "ARTICLE",
  "ankit singh": "ARTICLE",
  "aryaman dhar badgaiyan": "ARTICLE",
  "aryaman dhar": "ARTICLE",
  "palak dodani": "ARTICLE",
  "pihu agrawal": "ARTICLE",
  "piyush verma": "ARTICLE",
  "poorva sharma": "ARTICLE",
  "sania dalwani": "ARTICLE",
  "sanidhya nahar": "ARTICLE",
  "sarthak jain": "ARTICLE",
  "shubham verma": "ARTICLE",
  "simran patnaik": "ARTICLE",
  "vikas sonwani": "ARTICLE",
  "yogesh sonkar": "ARTICLE",
  "deevya verma": "ARTICLE",
  "mahak jain": "ARTICLE",
  "mahak khatri": "ARTICLE",
  "mukti pathak": "ARTICLE",
  "naresh prajapati": "ARTICLE",
  "nikhil dawani": "ARTICLE",
  "harsh kumar gupta": "ARTICLE",
  "radhika singh bhatia": "ARTICLE",
  "radhika singh": "ARTICLE",
  "manvi roy": "ARTICLE",
  "mohit agrawal": "ARTICLE",
  "moksh jain": "ARTICLE",
  "sonal meghani": "ARTICLE",
  "sonal meghali": "ARTICLE",
  "sushant tiwari": "ARTICLE",

  // MD (Managing Director)
  "rajesh agrawal": "MD",
  "md sir": "MD",
  "md rajesh agrawal": "MD",

  // Partners (Rupesh Vaid, CA Ankit Kumar Garg, Mukul C / Mukul Jain)
  "rupesh vaid": "PARTNER",
  "ca rupesh vaid": "PARTNER",
  "ca ankit kumar garg": "PARTNER",
  "ankit kumar garg": "PARTNER",
  "ankit garg": "PARTNER",
  "ca ankit garg": "PARTNER",
  "mukul jain": "PARTNER",
  "ca mukul jain": "PARTNER",
  "mukul c": "PARTNER",
  "ca mukul c": "PARTNER",

  // Seniors (10 Verified Seniors / CAs / CMAs)
  "harsh mittal": "SENIOR",
  "ca harsh mittal": "SENIOR",
  "harsh mittal sir": "SENIOR",
  "kanha kedia": "SENIOR",
  "ca kanha kedia": "SENIOR",
  "ca kanha": "SENIOR",
  "chandan singh": "SENIOR",
  "ca chandan singh": "SENIOR",
  "drishti chandnani": "SENIOR",
  "ca drishti chandnani": "SENIOR",
  "harsh sharma": "SENIOR",
  "ca harsh sharma": "SENIOR",
  "harsh sharma sir": "SENIOR",
  "pankaj agrawal": "SENIOR",
  "ca pankaj agrawal": "SENIOR",
  "pratibha agrawal": "SENIOR",
  "cma pratibha agrawal": "SENIOR",
  "priya dani": "SENIOR",
  "cma priya dani": "SENIOR",
  "vedant khandelwal": "SENIOR",
  "ca vedant khandelwal": "SENIOR",
  "vikas goyal": "SENIOR",
  "ca vikas goyal": "SENIOR",
  "vikas goyal sir": "SENIOR",

  // Back Office (Explicit mappings to prevent single-name collisions)
  "priya yadav": "BACK_OFFICE",
  "rahul singh banjara": "BACK_OFFICE",
  "vikas sarthi": "BACK_OFFICE",
  "babita": "BACK_OFFICE",
  "babita hr": "BACK_OFFICE",
  "meenu patel": "BACK_OFFICE",
  "vansh agrawal": "BACK_OFFICE",
  "amit chandrakar": "BACK_OFFICE",
  "ashu gupta": "BACK_OFFICE",
  "bhavika namdev": "BACK_OFFICE",
  "khushali sahu": "BACK_OFFICE",
  "supriya kurrey": "BACK_OFFICE",
  "tushar": "BACK_OFFICE",
  "vaishali kalra": "BACK_OFFICE",
  "vaishali karla": "BACK_OFFICE",
  "vicky": "BACK_OFFICE",
  "yogita": "BACK_OFFICE",
  "sarika": "BACK_OFFICE",
  "rajni": "BACK_OFFICE",
  "vimal": "BACK_OFFICE",
  "chandrabhusan": "BACK_OFFICE",
};

// Fallback single-name map ONLY for 1-word inputs (e.g. "Rupesh", "Vedant", "Babita")
export const SINGLE_NAME_FALLBACK = {
  rupesh: "PARTNER",
  mukul: "PARTNER",
  vedant: "SENIOR",
  drishti: "SENIOR",
  chandan: "SENIOR",
  pankaj: "SENIOR",
  pratibha: "SENIOR",
  babita: "BACK_OFFICE",
  meenu: "BACK_OFFICE",
  vansh: "BACK_OFFICE",
  amit: "BACK_OFFICE",
  ashu: "BACK_OFFICE",
  bhavika: "BACK_OFFICE",
  supriya: "BACK_OFFICE",
  tushar: "BACK_OFFICE",
  vaishali: "BACK_OFFICE",
  vicky: "BACK_OFFICE",
  yogita: "BACK_OFFICE",
  sarika: "BACK_OFFICE",
  rajni: "BACK_OFFICE",
  vimal: "BACK_OFFICE",
  tr: "PLANT_AUDIT",
  gauri: "PLANT_AUDIT",
  gaurishankar: "PLANT_AUDIT",
};

// CAs / Seniors / Partners / MD

// Normalize clean name for lookup
export const normalizeName = (str = "") =>
  (str || "")
    .toLowerCase()
    .replace(/^(ca|cma|cs|adv|mr|mrs|ms|dr|sr)\b[\s-]*/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Special Individual Employee Shift Overrides (e.g. CMA Pratibha Agrawal 10:30 AM to 7:00 PM)
export const INDIVIDUAL_EMPLOYEE_SHIFTS = {
  pratibha: {
    names: ["pratibha", "cma pratibha", "pratibha agrawal", "cma pratibha agrawal"],
    displayName: "CMA Pratibha Agrawal",
    key: "SPECIAL_PRATIBHA",
    categoryKey: "SENIOR",
    label: "Seniors (Special Shift: 10:30 AM - 7:00 PM)",
    shortLabel: "Special (10:30-7:00)",
    icon: "⭐",
    cutoff: "10:30",      // Official cut-off time (10:30 AM)
    grace: "10:35",       // Grace period until (10:35 AM)
    shiftStart: "10:30",
    shiftEnd: "19:00",    // 7:00 PM
    color: "#8b5cf6",     // Purple
    badgeClass: "badge-special",
    customNote: "10:30 AM to 07:00 PM",
  },
  supriya: {
    names: ["supriya", "supriya kurrey",],
    displayName: "Supriya Kurrey",
    key: "SPECIAL_SUPRIYA",
    categoryKey: "BACK_OFFICE",
    label: "Back Office (Special Shift: 10:30 AM - 7:00 PM)",
    shortLabel: "Special (10:30-7:00)",
    icon: "⭐",
    cutoff: "10:15",      // Official cut-off time (10:30 AM)
    grace: "10:20",       // Grace period until (10:35 AM)
    shiftStart: "10:15",
    shiftEnd: "19:00",    // 7:00 PM
    color: "#8b5cf6",     // Purple
    badgeClass: "badge-special",
    customNote: "10:15 AM to 07:00 PM",
  },
  yash: {
    names: ["yash jairaj", "yash", "jairaj"],
    displayName: "Yash Jairaj",
    key: "SPECIAL_YASH",
    categoryKey: "BACK_OFFICE",
    label: "Back Office (Special Shift: 10:30 AM - 6:30 PM)",
    shortLabel: "Special (10:30-6:30)",
    icon: "⭐",
    cutoff: "10:30",      // Official cut-off time (10:30 AM)
    grace: "10:35",       // Grace period until (10:35 AM)
    shiftStart: "10:30",
    shiftEnd: "18:30",    // 6:30 PM
    color: "#8b5cf6",     // Purple
    badgeClass: "badge-special",
    customNote: "10:30 AM to 06:30 PM",
  },
  akshita: {
    names: ["akshita"],
    displayName: "Akshita",
    key: "SPECIAL_AKSHITA",
    categoryKey: "BACK_OFFICE",
    label: "Back Office (Special Shift: 10:00 AM - 6:30 PM)",
    shortLabel: "Special (10:00-6:30)",
    icon: "⭐",
    cutoff: "10:00",      // Official cut-off time (10:00 AM)
    grace: "10:05",       // Grace period until (10:05 AM)
    shiftStart: "10:00",
    shiftEnd: "18:30",    // 6:30 PM
    color: "#8b5cf6",     // Purple
    badgeClass: "badge-special",
    customNote: "10:00 AM to 06:30 PM",
  },
  vaishali: {
    names: ["vaishali karla", "vaishali", "vaishali kalra"],
    displayName: "Vaishali Karla",
    key: "SPECIAL_VAISHALI",
    categoryKey: "BACK_OFFICE",
    label: "Back Office (Special Shift: 11:00 AM - 7:00 PM)",
    shortLabel: "Special (11:00-7:00)",
    icon: "⭐",
    cutoff: "11:00",      // Official cut-off time (11:00 AM)
    grace: "11:05",       // Grace period until (11:05 AM)
    shiftStart: "11:00",
    shiftEnd: "19:00",    // 7:00 PM
    color: "#8b5cf6",     // Purple
    badgeClass: "badge-special",
    customNote: "11:00 AM to 07:00 PM",
  },
};

/**
 * Categorize an employee based on:
 * 0. Individual Shift Overrides (Highest Priority, e.g. CMA Pratibha Agrawal)
 * 1. Explicit Category or Department in attendance row
 * 2. Dynamic map loaded from EmployeeMaster API
 * 3. Seed lookup dictionary
 * 4. Heuristics (e.g. CA prefix, client site keywords like 'plant' / 'factory')
 */
export function getEmployeeCategoryInfo(
  employeeName = "",
  row = {},
  dynamicMap = new Map(),
  customPolicies = DEFAULT_SHIFT_POLICIES
) {
  const policies =
    customPolicies && Object.keys(customPolicies).length > 0
      ? customPolicies
      : DEFAULT_SHIFT_POLICIES;
  const isEmpNameObj = typeof employeeName === "object" && employeeName !== null;
  const rowObj = typeof row === "string" ? { Department: row } : isEmpNameObj ? employeeName : (row || {});
  const strEmpName = typeof employeeName === "string" ? employeeName : "";
  const rawName = (
    strEmpName ||
    rowObj.Employee ||
    rowObj.employeeName ||
    rowObj.doerName ||
    ""
  ).trim();
  const clean = normalizeName(rawName);

  // 0. Individual Employee Shift Overrides (Highest Priority)
  for (const [, shift] of Object.entries(INDIVIDUAL_EMPLOYEE_SHIFTS)) {
    const isMatch = shift.names.some((n) => {
      const cleanTarget = normalizeName(n);
      // Exact match
      if (clean === cleanTarget) return true;
      // Multi-word target (e.g. "cma pratibha agrawal", "vaishali karla")
      if (cleanTarget.includes(" ")) {
        return clean === cleanTarget || clean.includes(cleanTarget);
      }
      // Single-word target (e.g. "akshita"):
      if (!cleanTarget.includes(" ")) {
        const words = clean.split(" ");
        if (words.length === 1 && words[0] === cleanTarget) return true;
        // Differentiate "Akshita" from "Akshita Agrawal":
        if (words.includes(cleanTarget)) {
          if (cleanTarget === "akshita" && (clean.includes("agrawal") || clean.includes("agrwal"))) {
            return false;
          }
          return true;
        }
      }
      return false;
    });
    if (isMatch) {
      return {
        ...shift,
        categoryKey: shift.categoryKey || "BACK_OFFICE",
        cutoff: customPolicies?.[shift.key]?.cutoff || shift.cutoff,
        grace: customPolicies?.[shift.key]?.grace || shift.grace,
      };
    }
  }

  const resolvePolicy = (p) => {
    const item = p || policies.BACK_OFFICE || DEFAULT_SHIFT_POLICIES.BACK_OFFICE;
    return {
      ...item,
      categoryKey: item.categoryKey || item.key || "BACK_OFFICE",
    };
  };

  // Explicit overrides for Key Roles:
  // - Rajesh Agrawal is the sole Managing Director (MD)
  // - Meenu Patel is Back Office (department in master is "MDO" / MD Office)
  // - TR Dewangan (Sr-TR Dewangan) is Plant Staff / Plant Audit
  if (clean === "rajesh agrawal" || clean.includes("rajesh agrawal")) {
    return resolvePolicy(policies.MD);
  }
  if (clean === "meenu patel" || clean.includes("meenu patel") || clean === "meenu") {
    return resolvePolicy(policies.BACK_OFFICE);
  }
  if (
    clean === "tr dewangan" ||
    clean === "t r dewangan" ||
    clean.includes("tr dewangan") ||
    clean.includes("t r dewangan") ||
    rawName.toLowerCase().includes("tr dewangan") ||
    rawName.toLowerCase().includes("sr-tr dewangan") ||
    rawName.toLowerCase().includes("sr tr dewangan")
  ) {
    return resolvePolicy(policies.PLANT_AUDIT);
  }
  if (
    clean === "gauri sharma" ||
    clean === "gauri shankar sharma" ||
    clean === "gaurishankar sharma" ||
    clean === "gaurishankar" ||
    clean === "gauri" ||
    clean.includes("gaurishankar") ||
    clean.includes("gauri shankar") ||
    clean.includes("gauri sharma") ||
    rawName.toLowerCase().includes("gaurishankar") ||
    rawName.toLowerCase().includes("gauri shankar") ||
    rawName.toLowerCase().includes("gauri sharma")
  ) {
    return resolvePolicy(policies.PLANT_AUDIT);
  }

  // 1. Direct row department/category
  const rowDept = ((rowObj.Department || rowObj.Category || rowObj.department || "") + "").toLowerCase().trim();
  if (rowDept === "mdo" || rowDept.includes("mdo") || rowDept.includes("md office")) return resolvePolicy(policies.BACK_OFFICE);
  if (rowDept.includes("plant")) return resolvePolicy(policies.PLANT_AUDIT);
  if (rowDept.includes("article")) return resolvePolicy(policies.ARTICLE);
  if ((/\bmd\b/.test(rowDept) || rowDept.includes("managing director")) && (clean.includes("rajesh") || clean.includes("agrawal"))) return resolvePolicy(policies.MD);
  if (rowDept.includes("partner")) return resolvePolicy(policies.PARTNER);
  if (rowDept.includes("senior") || rowDept.includes("ca")) return resolvePolicy(policies.SENIOR);
  if (rowDept.includes("back office")) return resolvePolicy(policies.BACK_OFFICE);

  // 2. Dynamic map from EmployeeMaster API
  if (dynamicMap && dynamicMap.size > 0) {
    const fromDynamic = dynamicMap.get(clean) || dynamicMap.get(rawName.toLowerCase());
    if (fromDynamic) {
      const lower = fromDynamic.toLowerCase().trim();
      if (lower === "mdo" || lower.includes("mdo") || lower.includes("md office")) return resolvePolicy(policies.BACK_OFFICE);
      if (lower.includes("plant")) return resolvePolicy(policies.PLANT_AUDIT);
      if (lower.includes("article")) return resolvePolicy(policies.ARTICLE);
      if ((/\bmd\b/.test(lower) || lower.includes("managing director")) && (clean.includes("rajesh") || clean.includes("agrawal"))) return resolvePolicy(policies.MD);
      if (lower.includes("partner")) return resolvePolicy(policies.PARTNER);
      if (lower.includes("senior") || lower.includes("ca")) return resolvePolicy(policies.SENIOR);
      if (lower.includes("back office")) return resolvePolicy(policies.BACK_OFFICE);
    }
  }

  // 3. Seed dictionary exact or partial
  if (KNOWN_EMPLOYEES_MAP[clean]) {
    const key = KNOWN_EMPLOYEES_MAP[clean];
    return resolvePolicy(policies[key] || policies.BACK_OFFICE);
  }

  // Multi-word matches (check longest entries first to prevent prefix collisions)
  const multiKeys = Object.keys(KNOWN_EMPLOYEES_MAP)
    .filter((k) => k.includes(" "))
    .sort((a, b) => b.length - a.length);

  for (const k of multiKeys) {
    const cleanK = k.toLowerCase().trim();
    if (clean === cleanK || clean.includes(cleanK) || cleanK.includes(clean)) {
      return resolvePolicy(policies[KNOWN_EMPLOYEES_MAP[k]] || policies.BACK_OFFICE);
    }
  }

  // Single-word input fallback ONLY if input has 1 word (e.g. "Rupesh", "Vedant")
  const cleanWords = clean.split(" ");
  if (cleanWords.length === 1) {
    const single = cleanWords[0];
    if (SINGLE_NAME_FALLBACK[single]) {
      return resolvePolicy(policies[SINGLE_NAME_FALLBACK[single]] || policies.BACK_OFFICE);
    }
    if (KNOWN_EMPLOYEES_MAP[single]) {
      return resolvePolicy(policies[KNOWN_EMPLOYEES_MAP[single]] || policies.BACK_OFFICE);
    }
  }

  // 4. Heuristics
  if (/\bmanaging director\b/i.test(rawName) || (/\bmd\b/i.test(rawName) && /rajesh|agrawal/i.test(rawName))) {
    return resolvePolicy(policies.MD);
  }
  if (/\b(partner)\b/i.test(rawName)) {
    return resolvePolicy(policies.PARTNER);
  }
  if (/^ca\b|^cma\b/i.test(rawName) || /\b(senior)\b/i.test(rawName)) {
    return resolvePolicy(policies.SENIOR);
  }

  // If Client Place or Location mentions Plant or Factory
  const place = ((row.ClientPlace || "") + " " + (row.Location || "")).toLowerCase();
  if (
    place.includes("plant") ||
    place.includes("factory") ||
    place.includes("steel") ||
    place.includes("power") ||
    place.includes("unit")
  ) {
    return resolvePolicy(policies.PLANT_AUDIT);
  }

  // Default fallback
  return resolvePolicy(policies.BACK_OFFICE);
}

/**
 * Format lateness duration in minutes into a clean human-readable string.
 * If 60 minutes or more, converts to hours and minutes (e.g. "1 hr 15 mins", "2 hrs").
 * If under 60 minutes, returns "X mins" (or "1 min").
 *
 * @param {number|string} minutes - Late minutes counted after grace time
 * @param {object} options
 * @param {boolean} options.short - If true, returns compact format like "1h 15m"
 * @returns {string} Human-friendly formatted duration
 */
export function formatLateDuration(minutes, { short = false } = {}) {
  const m = Number(minutes);
  if (!m || isNaN(m) || m <= 0) return short ? "0m" : "0 mins";

  if (m < 60) {
    if (short) return `${m}m`;
    return m === 1 ? "1 min" : `${m} mins`;
  }

  const hours = Math.floor(m / 60);
  const remainingMins = m % 60;

  if (short) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }

  const hoursLabel = hours === 1 ? "1 hr" : `${hours} hrs`;
  if (remainingMins === 0) {
    return hoursLabel;
  }
  const minsLabel = remainingMins === 1 ? "1 min" : `${remainingMins} mins`;
  return `${hoursLabel} ${minsLabel}`;
}

/**
 * Format total working duration in minutes into hours and minutes (e.g. "8 hrs 30 mins", "7 hrs", "45 mins").
 *
 * @param {number|string} minutes - Total worked minutes
 * @returns {string} Formatted working hours string
 */
export function formatWorkingHours(minutes) {
  const m = Number(minutes);
  if (!m || isNaN(m) || m <= 0) return "0 hrs";

  const hours = Math.floor(m / 60);
  const remainingMins = m % 60;

  if (hours === 0) {
    return remainingMins === 1 ? "1 min" : `${remainingMins} mins`;
  }

  const hoursLabel = hours === 1 ? "1 hr" : `${hours} hrs`;
  if (remainingMins === 0) {
    return hoursLabel;
  }
  const minsLabel = remainingMins === 1 ? "1 min" : `${remainingMins} mins`;
  return `${hoursLabel} ${minsLabel}`;
}

/**
 * Verified Partners Master List
 */
export const PARTNERS_LIST = [
  { key: "rupesh_vaid", name: "CA Rupesh Vaid", role: "Partner", icon: "🤝" },
  { key: "ankit_garg", name: "CA Ankit Kumar Garg", role: "Partner", icon: "🤝" },
  { key: "mukul_jain", name: "CA Mukul Jain", role: "Partner", icon: "🤝" },
];

/**
 * Verified Seniors Master List
 */
export const SENIORS_LIST = [
  { key: "harsh_mittal", name: "CA Harsh Mittal", role: "Senior", icon: "👔" },
  { key: "kanha_kedia", name: "CA Kanha Kedia", role: "Senior", icon: "👔" },
  { key: "chandan_singh", name: "CA Chandan Singh", role: "Senior", icon: "👔" },
  { key: "drishti_chandnani", name: "CA Drishti Chandnani", role: "Senior", icon: "👔" },
  { key: "harsh_sharma", name: "CA Harsh Sharma", role: "Senior", icon: "👔" },
  { key: "pankaj_agrawal", name: "CA Pankaj Agrawal", role: "Senior", icon: "👔" },
  { key: "pratibha_agrawal", name: "CMA Pratibha Agrawal", role: "Senior", icon: "⭐" },
  { key: "priya_dani", name: "CMA Priya Dani", role: "Senior", icon: "👔" },
  { key: "vedant_khandelwal", name: "CA Vedant Khandelwal", role: "Senior", icon: "👔" },
  { key: "vikas_goyal", name: "CA Vikas Goyal", role: "Senior", icon: "👔" },
];

/**
 * Helper to check if an employee/row belongs to Partners or Seniors
 */
export function isPartnerOrSenior(employeeName = "", row = {}, dynamicMap = null) {
  const cat = getEmployeeCategoryInfo(employeeName, row, dynamicMap);
  const key = cat?.categoryKey || cat?.key;
  return key === "PARTNER" || key === "SENIOR";
}

/**
 * Helper to check if an employee/row is a Partner
 */
export function isPartner(employeeName = "", row = {}, dynamicMap = null) {
  const cat = getEmployeeCategoryInfo(employeeName, row, dynamicMap);
  const key = cat?.categoryKey || cat?.key;
  return key === "PARTNER";
}

/**
 * Helper to check if an employee/row is a Senior
 */
export function isSenior(employeeName = "", row = {}, dynamicMap = null) {
  const cat = getEmployeeCategoryInfo(employeeName, row, dynamicMap);
  const key = cat?.categoryKey || cat?.key;
  return key === "SENIOR";
}

/**
 * Verified Articles Master List (31 Articles)
 */
export const ARTICLES_LIST = [
  { key: "aditya_raj_singh", name: "Aditya Raj Singh", role: "Article", icon: "📚" },
  { key: "akshita_agrawal", name: "Akshita Agrawal", role: "Article", icon: "📚" },
  { key: "anirudh_agrawal", name: "Anirudh Agrawal", role: "Article", icon: "📚" },
  { key: "ankit_singh", name: "Ankit Singh", role: "Article", icon: "📚" },
  { key: "aryaman_badgaiyan", name: "Aryaman Dhar Badgaiyan", role: "Article", icon: "📚" },
  { key: "deevya_verma", name: "Deevya Verma", role: "Article", icon: "📚" },
  { key: "harsh_kumar_gupta", name: "Harsh Kumar Gupta", role: "Article", icon: "📚" },
  { key: "mahak_jain", name: "Mahak Jain", role: "Article", icon: "📚" },
  { key: "mahak_khatri", name: "Mahak Khatri", role: "Article", icon: "📚" },
  { key: "manvi_roy", name: "Manvi Roy", role: "Article", icon: "📚" },
  { key: "mohit_agrawal", name: "Mohit Agrawal", role: "Article", icon: "📚" },
  { key: "moksh_jain", name: "Moksh Jain", role: "Article", icon: "📚" },
  { key: "mukti_pathak", name: "Mukti Pathak", role: "Article", icon: "📚" },
  { key: "naresh_prajapati", name: "Naresh Prajapati", role: "Article", icon: "📚" },
  { key: "nikhil_dawani", name: "Nikhil Dawani", role: "Article", icon: "📚" },
  { key: "palak_dodani", name: "Palak Dodani", role: "Article", icon: "📚" },
  { key: "pihu_agrawal", name: "Pihu Agrawal", role: "Article", icon: "📚" },
  { key: "piyush_verma", name: "Piyush Verma", role: "Article", icon: "📚" },
  { key: "poorva_sharma", name: "Poorva Sharma", role: "Article", icon: "📚" },
  { key: "radhika_singh", name: "Radhika Singh Bhatia", role: "Article", icon: "📚" },
  { key: "sania_dalwani", name: "Sania Dalwani", role: "Article", icon: "📚" },
  { key: "sanidhya_nahar", name: "Sanidhya Nahar", role: "Article", icon: "📚" },
  { key: "sarthak_jain", name: "Sarthak Jain", role: "Article", icon: "📚" },
  { key: "shubham_verma", name: "Shubham Verma", role: "Article", icon: "📚" },
  { key: "simran_patnaik", name: "Simran Patnaik", role: "Article", icon: "📚" },
  { key: "sonal_meghani", name: "Sonal Meghani", role: "Article", icon: "📚" },
  { key: "sushant_tiwari", name: "Sushant Tiwari", role: "Article", icon: "📚" },
  { key: "vikas_sonwani", name: "Vikas Sonwani", role: "Article", icon: "📚" },
  { key: "yogesh_sonkar", name: "Yogesh Sonkar", role: "Article", icon: "📚" },
];

/**
 * Helper to check if an employee/row is an Article
 */
export function isArticle(employeeName = "", row = {}, dynamicMap = null) {
  const cat = getEmployeeCategoryInfo(employeeName, row, dynamicMap);
  const key = cat?.categoryKey || cat?.key;
  return key === "ARTICLE";
}

/**
 * Helper to check if an employee/row belongs to Partners, Seniors, or Articles
 */
export function isPartnerSeniorOrArticle(employeeName = "", row = {}, dynamicMap = null) {
  const cat = getEmployeeCategoryInfo(employeeName, row, dynamicMap);
  const key = cat?.categoryKey || cat?.key;
  return key === "PARTNER" || key === "SENIOR" || key === "ARTICLE";
}

/**
 * Helper to check if an employee/row belongs to Plant Audit Staff
 */
export function isPlantStaff(employeeName = "", row = {}, dynamicMap = null) {
  const cat = getEmployeeCategoryInfo(employeeName, row, dynamicMap);
  const key = cat?.categoryKey || cat?.key;
  return key === "PLANT_AUDIT";
}



