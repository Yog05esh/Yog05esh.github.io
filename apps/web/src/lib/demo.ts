import type { PersonaKey } from "@/lib/api/types";

/** The static Pages build is deliberately opt-in. */
export const isDemoBuild = process.env.NEXT_PUBLIC_DEMO === "1";

export const DEMO_COMPANIES = [{
  id: "co_altygen",
  name: "Altygen Biopharm",
  industry: "Synthetic nephrology-pharma operations",
  code: "ALTADM",
  challenge_district: "District 05: Intelligent Business Operations & Customer Engagement",
  headquarters: "Gurugram, India",
  size: "Synthetic 180-person B2B team",
  departments: ["Operations", "Accounts", "Sales", "Support", "Quality assurance"],
  team: ["Business Head", "Operations Manager", "Account Manager", "Sales Manager", "Support Manager", "QA Head"],
}] as const;

export const ROLE_LABEL: Record<PersonaKey, string> = {
  business_head: "Business Head",
  operations_manager: "Operations Manager",
  account_manager: "Account Manager",
  sales_manager: "Sales Manager",
  support_manager: "Support Manager",
  qa_head: "QA Head",
};

export const DEMO_ROLES = Object.entries(ROLE_LABEL).map(([key, label]) => ({ key: key as PersonaKey, label }));

export const DEMO_JOIN_CODES: Array<{ code: string; role: PersonaKey; purpose: string; maxUses: number }> = [
  { code: "ALTADM", role: "business_head", purpose: "Admin and company manager", maxUses: 3 },
  { code: "ALTEMP", role: "account_manager", purpose: "General employee", maxUses: 20 },
  { code: "ALTOPS", role: "operations_manager", purpose: "Operations department", maxUses: 10 },
  { code: "ALTACC", role: "account_manager", purpose: "Accounts department", maxUses: 10 },
  { code: "ALTSAL", role: "sales_manager", purpose: "Sales department", maxUses: 10 },
  { code: "ALTSUP", role: "support_manager", purpose: "Support department", maxUses: 10 },
  { code: "ALTQA1", role: "qa_head", purpose: "Quality assurance department", maxUses: 10 },
];

const REDEEMED_CODES_KEY = "strata.demo.redeemed-codes";

export function findDemoJoinCode(value: string) {
  return DEMO_JOIN_CODES.find((item) => item.code === value.trim().toUpperCase()) ?? null;
}

/** Local-only fallback. It prevents the same browser user from redeeming a code twice. */
export function redeemLocalDemoCode(userId: string, value: string): { role: PersonaKey; companyId: string } {
  const code = findDemoJoinCode(value);
  if (!code) throw new Error("That demo join code is invalid.");
  try {
    const used = JSON.parse(localStorage.getItem(REDEEMED_CODES_KEY) ?? "[]") as string[];
    const key = `${userId}:${code.code}`;
    if (used.includes(key)) throw new Error("That demo join code has already been used by this account.");
    if (used.filter((item) => item.endsWith(`:${code.code}`)).length >= code.maxUses) throw new Error("That demo join code has already reached its use limit.");
    localStorage.setItem(REDEEMED_CODES_KEY, JSON.stringify([...used, key]));
  } catch (error) {
    if (error instanceof Error && error.message.includes("already")) throw error;
  }
  return { role: code.role, companyId: DEMO_COMPANIES[0].id };
}

export interface DemoUserShape {
  id: string;
  name: string;
  email: string;
  role: PersonaKey;
  role_label: string;
  company_id: string;
  company_name: string;
  company_industry?: string;
  demo_password?: string;
  company_code?: string | null;
  verified: boolean;
  prefs: { theme?: "light" | "dark" | "system"; email_alerts?: boolean };
}

export function makeDemoUser(input: Partial<Pick<DemoUserShape, "id" | "name" | "email" | "role" | "company_id">> = {}): DemoUserShape {
  const company = DEMO_COMPANIES.find((item) => item.id === input.company_id) ?? DEMO_COMPANIES[0];
  const role = input.role ?? "operations_manager";
  return {
    id: input.id ?? `demo-${role}`,
    name: input.name ?? `Demo ${ROLE_LABEL[role]}`,
    email: input.email ?? `${role.replace("_", ".")}@demo.strata.local`,
    role,
    role_label: ROLE_LABEL[role],
    company_id: company.id,
    company_name: company.name,
    company_industry: company.industry,
    demo_password: "demo-only",
    company_code: role === "business_head" ? company.code : null,
    verified: true,
    prefs: { theme: "system", email_alerts: false },
  };
}

export const DEMO_LOGIN_USERS = DEMO_ROLES.map(({ key, label }) => makeDemoUser({
  id: `demo-${key}`,
  name: `Synthetic ${label}`,
  email: `${key.replace("_", ".")}@altygen.demo.invalid`,
  role: key,
}));

export function demoUserForEmail(email: string): DemoUserShape | null {
  const known = DEMO_LOGIN_USERS.find((user) => user.email === email.trim().toLowerCase());
  return known ?? null;
}
