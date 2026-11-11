// src/utils/hrLabourLawKnowledge.js

/**
 * Comprehensive Labour Law & HR Policy Knowledge Base
 * Covering:
 * 1. Working Hours, Shifts, Rest Intervals & Overtime
 * 2. Leave Entitlements (EL/PL, CL, SL, Maternity, Paternity & National Holidays)
 * 3. Statutory Benefits & Deductions (EPF, ESIC, Gratuity, Bonus)
 * 4. Workplace Governance (POSH Act 2013, Code of Conduct, NDA & Moonlighting)
 * 5. Probation, Notice Period, PIP & Separation Guidelines
 * 6. The 4 New Labour Codes (Code on Wages, Social Security, OSHWC, Industrial Relations)
 */

export const HR_POLICY_SUGGESTION_CHIPS = [
  { label: "📜 Leave Rules (CL/SL/PL)", query: "What is the leave policy (Earned, Casual & Sick leaves)?" },
  { label: "🤰 Maternity Benefit", query: "What is the Maternity Leave benefit and rules?" },
  { label: "💰 Gratuity Formula", query: "How is Gratuity calculated and what is the 5-year rule?" },
  { label: "🛡️ POSH Policy", query: "What is the POSH policy and Internal Committee setup?" },
  { label: "⏰ Working Hours & OT", query: "What are statutory working hours and overtime calculation rules?" },
  { label: "🏦 EPF & ESIC Rules", query: "What are the EPF and ESIC contribution rates and thresholds?" },
  { label: "⏳ Notice Period & PIP", query: "What is the notice period, probation and PIP policy?" },
  { label: "⚖️ 4 New Labour Codes", query: "Explain the New Labour Codes and the 50% Basic wage rule" },
];

/**
 * System prompt context snippet for LLMs (OpenAI GPT)
 */
export const HR_LABOUR_LAW_SYSTEM_PROMPT = `
HR POLICIES & STATUTORY LABOUR LAWS (INDIA / PROFESSIONAL FIRM):
1. WORKING HOURS & OVERTIME (Factories Act / Shops & Establishments Act):
   - Standard: Max 9 hours/day, 48 hours/week (6 days Mon-Sat, Sunday Weekly Off).
   - Rest Interval: Minimum 30 minutes rest after 5 continuous hours of work.
   - Overtime: Compensated at twice (2x) the ordinary rate of wages for hours beyond 9 hrs/day or 48 hrs/week.
   - Female Staff: Night shifts require written consent, secured transport, and well-lit premises.

2. LEAVES & HOLIDAYS:
   - Earned / Privilege Leave (EL/PL): 1 day for every 20 days worked (~15-18 days/yr). Accumulation up to 30-45 days, encashable upon separation.
   - Casual Leave (CL): 7-12 days/year for unexpected personal needs. Lapses at year-end; cannot be combined with EL.
   - Sick Leave (SL): 7-12 days/year. Medical certificate required if > 2 consecutive days.
   - Mandatory National Holidays: 26th Jan (Republic Day), 15th Aug (Independence Day), 2nd Oct (Gandhi Jayanti) + 5-7 state festival holidays.
   - Maternity Benefit Act, 1961: 26 weeks (182 days) fully paid leave for up to 2 surviving children. Mandatory crèche facility for 50+ staff.
   - Paternity Leave: Customary 5 to 15 days paid leave.

3. STATUTORY SOCIAL SECURITY & BENEFITS:
   - EPF (Employees' Provident Fund Act, 1952): Mandatory for basic wage <= ₹15,000/mo (voluntary above). Employee: 12%, Employer: 12% (3.67% EPF, 8.33% EPS capped at ₹1,250, + 0.5% EDLI + 0.5% admin).
   - ESIC (Employees' State Insurance Act, 1948): Gross wage <= ₹21,000/mo. Employee: 0.75%, Employer: 3.25%.
   - Payment of Gratuity Act, 1972: Payable after 5 years continuous service. Formula: (15 × Last Drawn Basic × Completed Years) / 26. Tax exemption limit ₹20 Lakhs.
   - Payment of Bonus Act, 1965: Minimum 8.33% of basic wage (max 20%) for employees earning <= ₹21,000/mo who worked at least 30 days in the FY.

4. WORKPLACE GOVERNANCE & POSH (Prevention of Sexual Harassment Act, 2013):
   - Mandatory Internal Committee (IC) for establishments with 10+ employees.
   - IC composition: Presiding Officer (Senior woman employee) + at least 2 employee members + 1 external member (NGO/lawyer). At least 50% must be women.
   - Timeline: Complaint within 3 months; inquiry completed within 90 days; report within 10 days. Strict identity confidentiality.
   - Code of Conduct: Zero tolerance for data breach, strict client confidentiality (ICAI ethical standards for CA/audit firm), strict ban on moonlighting.

5. PROBATION, SEPARATION & NOTICE PERIOD:
   - Probation: Standard 3 to 6 months; formal review before confirmation.
   - Notice Period: 15-30 days during probation; 30-90 days post-confirmation (or salary in lieu).
   - Full & Final Settlement (F&F): Statutory settlement within 30-45 days of last working day.
   - Performance Improvement Plan (PIP): 30-60 days with objective KPIs and bi-weekly reviews before any adverse action.

6. THE 4 NEW LABOUR CODES (2020 Reforms):
   - Code on Wages: 50% Rule (Basic + DA must be >= 50% of total CTC; allowances capped at 50%, elevating PF/gratuity contributions).
   - Code on Social Security: Gratuity pro-rata for fixed-term staff (even < 5 years), social security for gig workers.
   - Industrial Relations Code & OSHWC Code: Streamlined standing orders, safety norms, and single license framework.
`;

/**
 * Deterministic Natural Language Engine for HR & Labour Law queries
 */
export const getHRLabourLawAnswer = (rawQuery) => {
  if (!rawQuery || typeof rawQuery !== "string") return null;
  const q = rawQuery.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  // 1. Working Hours, Shifts & Overtime
  if (
    q.includes("overtime") ||
    q.includes("ot calculation") ||
    q.includes("ot rate") ||
    (q.includes("working hour") && !q.includes("employee")) ||
    (q.includes("hours") && (q.includes("statutory") || q.includes("legal") || q.includes("standard") || q.includes("maximum") || q.includes("law") || q.includes("rule"))) ||
    q.includes("rest interval") ||
    q.includes("lunch break rule")
  ) {
    return `⏰ **Statutory Working Hours & Overtime Policy** (Under Factories Act & State Shops & Establishments Act):\n\n` +
      `• 🕒 **Daily & Weekly Working Hours**:\n` +
      `  - Standard Daily Hours: **Maximum 9 hours per day** (inclusive of rest interval).\n` +
      `  - Standard Weekly Hours: **Maximum 48 hours per week** (typically 8 hours/day over 6 working days: Mon - Sat).\n` +
      `  - Weekly Off: Mandatory at least **1 full day of rest** in every period of 7 days (usually Sunday).\n\n` +
      `• 🥪 **Mandatory Rest Interval**:\n` +
      `  - No employee can be required to work for more than **5 continuous hours** without an interval for rest of at least **30 minutes**.\n` +
      `  - Spread-over (total period of work + rest intervals) cannot exceed **10.5 to 12 hours** in a day.\n\n` +
      `• ⚡ **Overtime (OT) Compensation & Rules**:\n` +
      `  - Any work done in excess of 9 hours/day or 48 hours/week is classified as **Overtime**.\n` +
      `  - Statutory Compensation Rate: **Twice (2x) the ordinary rate of wages** (Basic + DA).\n` +
      `  - Total overtime hours across any quarter are typically capped at **50 to 125 hours** depending on state amendments.\n\n` +
      `• 👩 **Night Shifts for Women Staff**:\n` +
      `  - Permissible with prior written consent, provided the employer ensures **safe door-to-door transportation**, security personnel, and well-lit premises.\n\n` +
      `💡 *Tip: Ask "What is the leave policy?" or "Explain the Gratuity formula".*`;
  }

  // 2. Maternity Benefit & Paternity
  if (
    q.includes("maternity") ||
    q.includes("pregnant") ||
    q.includes("pregnancy") ||
    q.includes("creche") ||
    q.includes("paternity")
  ) {
    return `🤰 **Maternity Benefit & Paternity Policies** (Maternity Benefit Act, 1961 as amended):\n\n` +
      `• 👶 **Maternity Leave Duration**:\n` +
      `  - **26 weeks (182 calendar days)** of fully paid leave for female employees for up to **two surviving children**.\n` +
      `  - Up to **8 weeks** can be taken preceding the expected date of delivery, and the remaining post-delivery.\n` +
      `  - For third child onwards: **12 weeks** of paid maternity leave (max 6 weeks pre-delivery).\n` +
      `  - Adoptive / Commissioning Mothers (adopting child under 3 months): **12 weeks** paid leave from adoption date.\n\n` +
      `• 💼 **Eligibility & Protections**:\n` +
      `  - Must have worked at least **80 days** in the establishment in the 12 months preceding delivery.\n` +
      `  - **Zero Dismissal**: Termination or adverse change in service conditions during maternity leave is illegal.\n` +
      `  - Medical Bonus: Statutory medical bonus (min ₹3,500) if no prenatal/postnatal care is provided by employer.\n` +
      `  - Work-From-Home (WFH): Post 26 weeks, mutually agreed remote work options where nature of work permits.\n\n` +
      `• 🧸 **Mandatory Crèche Facility**:\n` +
      `  - Establishments with **50 or more employees** are legally mandated to provide a crèche facility within prescribed distance, permitting 4 visits/day.\n\n` +
      `• 👨 **Paternity Leave**:\n` +
      `  - Customary policy in private/professional firms of **5 to 15 working days** paid leave within 6 months of childbirth.\n\n` +
      `💡 *Tip: Ask "What are the EPF and ESIC rules?" or "Explain POSH policy".*`;
  }

  // 3. Leaves & Holidays (EL/PL, CL, SL, National Holidays)
  if (
    q.includes("leave policy") ||
    q.includes("leaves policy") ||
    q.includes("privilege leave") ||
    q.includes("earned leave") ||
    q.includes("casual leave") ||
    q.includes("sick leave") ||
    q.includes("national holiday") ||
    q.includes("national holidays") ||
    q.includes("festival holiday") ||
    (q.includes("leave") && (q.includes("type") || q.includes("types") || q.includes("rule") || q.includes("rules") || q.includes("how many") || q.includes("carry forward") || q.includes("encashment")))
  ) {
    return `🏖️ **Comprehensive Leave & Holiday Policy** (State Shops & Establishments Acts):\n\n` +
      `• 🌟 **1. Earned Leave / Privilege Leave (EL/PL)**:\n` +
      `  - **Accrual**: 1 day for every 20 worked days (~**15 to 18 days per year**).\n` +
      `  - **Carry Forward**: Can accumulate up to **30 to 45 days** (surplus is encashed or lapses based on company policy).\n` +
      `  - **Encashment**: Payable at retirement, resignation, or termination calculated on Last Drawn Basic Pay.\n` +
      `  - **Notice**: Must be applied at least 7 to 15 days in advance, subject to manager/partner approval.\n\n` +
      `• 🗓️ **2. Casual Leave (CL)**:\n` +
      `  - **Entitlement**: **7 to 12 days per calendar year** (pro-rated for new joiners).\n` +
      `  - **Purpose**: For sudden, unforeseen personal matters or urgent work.\n` +
      `  - **Rules**: Cannot be clubbed with Earned Leave; lapses at the end of the year (non-accumulative, non-encashable).\n\n` +
      `• 🩺 **3. Sick Leave / Medical Leave (SL)**:\n` +
      `  - **Entitlement**: **7 to 12 days per year**.\n` +
      `  - **Requirement**: A registered medical practitioner's certificate is required if sickness exceeds **2 consecutive working days**.\n\n` +
      `• 🇮🇳 **4. Mandatory National & Festival Holidays**:\n` +
      `  - **3 Mandatory National Holidays** (Paid Off):\n` +
      `    1. 🇮🇳 **26th January** (Republic Day)\n` +
      `    2. 🇮🇳 **15th August** (Independence Day)\n` +
      `    3. 🇮🇳 **2nd October** (Gandhi Jayanti)\n` +
      `  - Plus **5 to 7 Festival/State Holidays** declared at the start of each calendar year.\n\n` +
      `• ⚠️ **5. Leave Without Pay (LWP / Loss of Pay)**:\n` +
      `  - Applicable when leave balances are exhausted or unapproved absences occur. Salary is deducted on a per-day pro-rata basis: *(Gross Salary / Month Days)*.`;
  }

  // 4. Gratuity (5-year rule & formula)
  if (
    q.includes("gratuity") ||
    q.includes("gratuity formula") ||
    q.includes("gratuity calculation") ||
    q.includes("5 year") ||
    q.includes("5 years")
  ) {
    return `💰 **Payment of Gratuity Policy & Calculation** (Payment of Gratuity Act, 1972):\n\n` +
      `• 📌 **Statutory Eligibility**:\n` +
      `  - Applicable to all establishments employing **10 or more employees**.\n` +
      `  - Employee must have completed a minimum of **5 years of continuous service** with the organization.\n` +
      `  - *Exception*: The 5-year condition is **waived** in the event of employee death or permanent disablement.\n` +
      `  - *New Labour Code Update*: Fixed-term contract employees will be eligible on a pro-rata basis even if under 5 years.\n\n` +
      `• 📐 **Statutory Gratuity Calculation Formula**:\n` +
      `  $$\\text{Gratuity} = \\frac{15 \\times \\text{Last Drawn (Basic + DA)} \\times \\text{Completed Years of Service}}{26}$$\n\n` +
      `  - **15**: Represents 15 working days of salary per completed year.\n` +
      `  - **26**: Represents working days in a month (excluding 4 Sundays).\n` +
      `  - **Service Rounding**: Any service exceeding **6 months** is rounded up to the next full year (e.g. 5 yrs 7 mos = 6 years).\n\n` +
      `• 💵 **Tax Exemption Ceiling**:\n` +
      `  - Maximum statutory tax-free limit: **₹20 Lakhs** (as enhanced by Central Government).\n\n` +
      `• ⏱️ **Payment Timeline**:\n` +
      `  - Gratuity must be disbursed within **30 days** of separation. If delayed beyond 30 days without lawful reason, employer is liable to pay simple interest.`;
  }

  // 5. EPF & ESIC (Provident Fund & State Insurance)
  if (
    q.includes("epf") ||
    q.includes("pf contribution") ||
    q.includes("provident fund") ||
    q.includes("esic") ||
    q.includes("esi rate") ||
    q.includes("esi calculation") ||
    q.includes("esi contribution")
  ) {
    return `🏦 **Statutory Social Security: EPF & ESIC Framework**:\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏛️ **1. Employees' Provident Fund (EPF Act, 1952)**:\n` +
      `• **Applicability**: Entities employing **20 or more staff**.\n` +
      `• **Wage Threshold**: Mandatory for employees with Basic + DA up to **₹15,000/month** (voluntary on higher basic pay upon mutual consent).\n` +
      `• **Contribution Breakdown** (Total 24% of Basic + DA):\n` +
      `  - 👤 **Employee Contribution**: **12%** (credited entirely to employee EPF account).\n` +
      `  - 🏢 **Employer Contribution**: **12%** distributed as:\n` +
      `    • **3.67%** to EPF (Employee Provident Fund)\n` +
      `    • **8.33%** to EPS (Employee Pension Scheme, capped at ₹1,250/mo)\n` +
      `    • **0.50%** to EDLI (Employees' Deposit Linked Insurance)\n` +
      `    • **0.50%** EPF Administrative Charges (min ₹500/mo)\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏥 **2. Employees' State Insurance (ESIC Act, 1948)**:\n` +
      `• **Applicability**: Establishments with **10 or more** (or 20 in some states) employees.\n` +
      `• **Wage Ceiling**: Applicable to employees drawing gross monthly wages up to **₹21,000/month** (₹25,000 for persons with disabilities).\n` +
      `• **Contribution Rates** (Effective July 2019):\n` +
      `  - 👤 **Employee**: **0.75%** of gross wages.\n` +
      `  - 🏢 **Employer**: **3.25%** of gross wages.\n` +
      `• **Benefits**: Comprehensive medical care for employee and dependents, maternity benefit, temporary/permanent disablement benefit, and sickness cash benefits.\n\n` +
      `💡 *Monthly Due Date: Statutory deposit for both EPF and ESIC is on or before the **15th of every subsequent month**.*`;
  }

  // 6. POSH Act (Prevention of Sexual Harassment at Workplace)
  if (
    q.includes("posh") ||
    q.includes("sexual harassment") ||
    q.includes("internal committee") ||
    q.includes("harassment") ||
    q.includes("women safety")
  ) {
    return `🛡️ **POSH Policy: Prevention of Sexual Harassment at Workplace** (POSH Act, 2013):\n\n` +
      `• 🏢 **Statutory Mandate**:\n` +
      `  - Mandatory for every workplace having **10 or more employees** to constitute an **Internal Committee (IC)**.\n` +
      `  - Zero-tolerance environment toward any unwelcome physical, verbal, visual, or non-verbal conduct of a sexual nature.\n\n` +
      `• 👥 **Internal Committee (IC) Composition**:\n` +
      `  1. 👩 **Presiding Officer**: A senior woman employee from the workplace.\n` +
      `  2. 👥 **Employee Members**: At least 2 employees committed to the cause of women or experienced in social/legal work.\n` +
      `  3. ⚖️ **External Member**: 1 independent member from an NGO, association, or legal expert committed to women's rights.\n` +
      `  *Crucial Rule*: At least **50% of the total members must be women**.\n\n` +
      `• ⏱️ **Redressal & Inquiry Timelines**:\n` +
      `  - **Filing Complaint**: In writing within **3 months** of the incident (extendable by 3 months with recorded reasons).\n` +
      `  - **Inquiry Completion**: Must be completed within **90 days**.\n` +
      `  - **Inquiry Report**: Must be submitted to management within **10 days** of inquiry completion.\n` +
      `  - **Action Taken**: Management must implement recommendations within **60 days**.\n\n` +
      `• 🔒 **Strict Confidentiality (Section 16)**:\n` +
      `  - The identity and address of the complainant, respondent, and witnesses, as well as inquiry proceedings, are strictly confidential. Heavy penalties apply for publication or disclosure.\n\n` +
      `• 📋 **Annual Compliance**:\n` +
      `  - Annual report must be filed with the District Officer summarizing complaints received, disposed of, and employee awareness workshops conducted.`;
  }

  // 7. Probation, Notice Period, PIP & Separation
  if (
    q.includes("probation") ||
    q.includes("notice period") ||
    q.includes("pip") ||
    q.includes("performance improvement") ||
    q.includes("resignation") ||
    q.includes("termination") ||
    q.includes("separation") ||
    q.includes("fnf") ||
    q.includes("full and final")
  ) {
    return `📋 **Probation, Notice Period, PIP & Separation Policies**:\n\n` +
      `• ⏳ **1. Probation Period**:\n` +
      `  - Standard duration: **3 to 6 months** from date of joining.\n` +
      `  - Performance is evaluated prior to completion; confirmation requires a formal written Confirmation Letter.\n` +
      `  - Probation can be extended by up to 3 months if performance needs further assessment.\n\n` +
      `• 🚪 **2. Notice Period & Resignation**:\n` +
      `  - **During Probation**: Typically **15 to 30 calendar days**.\n` +
      `  - **Post Confirmation**: **30 to 90 calendar days** (depending on role: Articles/Juniors 30 days, Seniors/Partners 60-90 days).\n` +
      `  - **Notice Buyout**: Allowed only with mutual management consent, calculated as *(Gross Salary × Shortfall Days / 30)*.\n` +
      `  - Proper handover of all files, clients, and assets is mandatory before issuance of Relieving & Experience Letters.\n\n` +
      `• 📈 **3. Performance Improvement Plan (PIP)**:\n` +
      `  - Duration: **30 to 60 days** for employees with identified performance gaps.\n` +
      `  - Defines SMART measurable targets, weekly review milestones, and mentoring support.\n` +
      `  - If targets are met: Successfully concludes PIP; if unmet: may lead to role realignment or mutual separation.\n\n` +
      `• 💼 **4. Full & Final Settlement (F&F)**:\n` +
      `  - Disbursed within **30 to 45 days** of the last working day.\n` +
      `  - Includes pending salary, encashment of earned leaves, bonus/gratuity (if eligible), adjusted for any outstanding loans or notice recovery.`;
  }

  // 8. The 4 New Labour Codes (Code on Wages 50% Rule, etc.)
  if (
    q.includes("new labour code") ||
    q.includes("labour codes") ||
    q.includes("code on wages") ||
    q.includes("50 rule") ||
    q.includes("50% rule") ||
    q.includes("50 percent") ||
    q.includes("social security code") ||
    q.includes("oshwc") ||
    q.includes("industrial relations code")
  ) {
    return `⚖️ **The 4 New Labour Codes & The 50% Basic Wage Rule** (Consolidation of 29 Central Labour Laws):\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 **1. Code on Wages, 2019 (The 50% Rule)**:\n` +
      `• **Uniform Definition of Wages**: Standardizes the definition across all labour acts.\n` +
      `• **The 50% Basic Rule**: Total excluded allowances (HRA, conveyance, special allowances) cannot exceed **50% of Total CTC**.\n` +
      `  - In effect, **Basic Pay + Dearness Allowance (DA) must constitute at least 50% of gross salary**.\n` +
      `  - If allowances exceed 50%, the excess is deemed as wages and added back to the Basic for PF, ESI & Gratuity calculation.\n` +
      `• **Impact**: Increases retirement savings (EPF & Gratuity contributions go up), while slightly decreasing monthly take-home pay.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🛡️ **2. Code on Social Security, 2020**:\n` +
      `• Extends social security benefits to **Gig Workers, Platform Workers & Fixed-Term Employees**.\n` +
      `• **Gratuity for Fixed-Term Employees**: Eligible on a pro-rata basis for fixed-term contracts even if service is **less than 5 years** (e.g. 1-year contract).\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏭 **3. Occupational Safety, Health & Working Conditions (OSHWC) Code, 2020**:\n` +
      `• Replaces 13 enactments; introduces single registration and uniform safety standards across office and plant sites.\n` +
      `• Formalizes annual free health check-ups for employees above specified age.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤝 **4. Industrial Relations Code, 2020**:\n` +
      `• Consolidates laws on trade unions, conditions of employment, and industrial disputes; updates threshold for standing orders to 300 workers.`;
  }

  // 9. Statutory Bonus
  if (q.includes("bonus") || q.includes("statutory bonus") || q.includes("payment of bonus")) {
    return `🎁 **Payment of Bonus Policy** (Payment of Bonus Act, 1965):\n\n` +
      `• 📌 **Applicability & Eligibility**:\n` +
      `  - Applicable to establishments employing **20 or more staff**.\n` +
      `  - Eligible: Employees earning up to **₹21,000/month** (Basic + DA) who have worked for at least **30 working days** in that financial year.\n\n` +
      `• 💵 **Bonus Rates**:\n` +
      `  - **Minimum Statutory Bonus**: **8.33%** of basic wages earned during the year (or ₹100, whichever is higher), regardless of company profit.\n` +
      `  - **Maximum Bonus**: Up to **20%** of basic wages, contingent upon allocable surplus profits.\n` +
      `  - Calculation ceiling: Salary for calculating bonus is taken as ₹7,000/mo or minimum wage for scheduled employment (whichever is higher).\n\n` +
      `• ⏱️ **Payment Timeline**:\n` +
      `  - Must be disbursed within **8 months** from the close of the financial year (typically around Diwali/festival season).`;
  }

  // 10. General overview of Labour Laws & HR Policies
  if (
    q.includes("labour law") ||
    q.includes("labor law") ||
    q.includes("hr policy") ||
    q.includes("hr policies") ||
    q.includes("statutory compliance") ||
    q.includes("compliance policy")
  ) {
    return `📚 **Agrawal Jain & Co. — HR Policies & Labour Law Compliance Framework**:\n\n` +
      `Our ERP AI Assistant is trained on comprehensive statutory labour laws and professional HR standards:\n\n` +
      `1. ⏰ **Working Hours & Overtime**: 48 hrs/week, max 9 hrs/day, 30 min mandatory break, 2x overtime rates.\n` +
      `2. 🏖️ **Leave Framework**: Earned Leave (15-18 days), Casual Leave (7-12 days), Sick Leave (7-12 days), 3 National Holidays.\n` +
      `3. 🤰 **Maternity Benefit**: 26 weeks paid leave, job security, mandatory crèche for 50+ staff.\n` +
      `4. 💰 **Gratuity**: 5 years continuous service rule, calculated as *(15 × Last Basic × Years / 26)* up to ₹20 Lakhs.\n` +
      `5. 🏦 **EPF & ESIC**: 12% PF contribution (<= ₹15k wage); 0.75% / 3.25% ESIC (<= ₹21k wage).\n` +
      `6. 🛡️ **POSH Policy**: Mandatory Internal Committee (>= 50% women), 90-day inquiry, strict confidentiality.\n` +
      `7. 📋 **Probation & Notice Period**: 3-6 mos probation, 30-90 days notice, formal PIP, full & final settlement.\n` +
      `8. ⚖️ **New Labour Codes**: 50% Basic wage rule, pro-rata gratuity, unified health & safety.\n\n` +
      `💬 *Try asking about any specific topic: "What is the maternity leave rule?", "Explain Gratuity formula", or "What is POSH policy?".*`;
  }

  return null;
};
