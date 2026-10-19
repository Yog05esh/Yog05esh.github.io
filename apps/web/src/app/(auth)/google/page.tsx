"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StrataLoader } from "@/components/ui/Loader";
import { apiPost } from "@/lib/api/client";
import { useAuth, type AuthUser } from "@/lib/auth";
import { takeGoogleNext } from "../_components/GoogleButton";
import { FormError, ROLE_INFO, TextField, friendlyError } from "../_components/shared";
import { DEMO_COMPANIES, DEMO_JOIN_CODES, findDemoJoinCode, isDemoBuild, redeemLocalDemoCode } from "@/lib/demo";
import { getSupabaseClient, supabaseConfigurationMessage } from "@/lib/supabase";
import { profileForGoogle } from "@/lib/demo-api";

type Resp = { token: string; user: AuthUser } | { status: "join_required"; email: string; name: string };

/** Return page for Google sign-in (Supabase Auth). Supabase puts the access token in the URL fragment. */
export default function GoogleReturn() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [join, setJoin] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [role, setRole] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ id: string; email?: string; user_metadata?: { full_name?: string; name?: string } } | null>(null);
  const [companyId, setCompanyId] = useState<string>(DEMO_COMPANIES[0].id);

  const finish = (r: Resp) => {
    if ("token" in r) {
      setSession(r.token, r.user);
      router.replace(takeGoogleNext());
    } else {
      setJoin({ email: r.email, name: r.name });
      setName(r.name);
    }
  };

  useEffect(() => {
    if (isDemoBuild) {
      const supabase = getSupabaseClient();
      if (!supabase) { setError(supabaseConfigurationMessage); return; }
      supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
        if (sessionError || !data.session?.user) { setError(sessionError?.message ?? "Google sign-in did not complete. Please try again."); return; }
        const authUser = data.session.user;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, company_id, display_name")
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (profileError) { setError("Could not read your demo profile. Check that supabase/schema.sql has been applied."); return; }
        if (profile?.role && profile.company_id) {
          const user = profileForGoogle(authUser, profile.role, profile.company_id);
          user.name = profile.display_name || user.name;
          setSession(data.session.access_token, user);
          router.replace(takeGoogleNext());
          return;
        }
        setGoogleUser(authUser);
        setJoin({ email: authUser.email ?? "your Google account", name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? "" });
        setName(authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? "");
      }).catch((e: unknown) => setError(friendlyError(e)));
      return;
    }
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const t = hash.get("access_token");
    window.history.replaceState(null, "", "/google"); // keep the token out of history
    if (!t) {
      setError(hash.get("error_description") || "Google sign-in did not complete. Please try again.");
      return;
    }
    setToken(t);
    apiPost<Resp>("/auth/supabase", { access_token: t }).then(finish).catch((e) => setError(friendlyError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoBuild) {
      if (!googleUser) return;
      setBusy(true); setError(null);
      try {
        const supabase = getSupabaseClient();
        let joinedRole = role;
        let joinedCompanyId = companyId;
        const suppliedCode = demoCode.trim().toUpperCase();
        if (suppliedCode) {
          if (!findDemoJoinCode(suppliedCode)) throw new Error("That demo join code is invalid.");
          if (supabase) {
            const { data, error: codeError } = await supabase.rpc("redeem_company_join_code", { p_code: suppliedCode });
            if (codeError) throw new Error(codeError.message);
            const redemption = data as { company_id?: string; role?: string } | null;
            if (!redemption?.company_id || !redemption.role) throw new Error("That demo join code is invalid, expired, or has already been used.");
            joinedRole = redemption.role;
            joinedCompanyId = redemption.company_id;
          } else {
            const redemption = redeemLocalDemoCode(googleUser.id, suppliedCode);
            joinedRole = redemption.role;
            joinedCompanyId = redemption.companyId;
          }
        }
        if (!joinedRole) throw new Error("Enter a demo join code or choose a demo role.");
        const user = profileForGoogle(googleUser, joinedRole, joinedCompanyId);
        user.name = name.trim() || user.name;
        if (supabase) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            user_id: googleUser.id, email: googleUser.email ?? null, display_name: user.name,
            role: user.role, company_id: user.company_id, company_name: user.company_name,
            company_industry: user.company_industry, company_code: user.company_code, prefs: user.prefs,
          }, { onConflict: "user_id" });
          if (profileError) throw profileError;
          const { data: session } = await supabase.auth.getSession();
          if (!session.session) throw new Error("Your Google session expired. Please sign in again.");
          setSession(session.session.access_token, user);
        } else {
          setSession(`demo-${googleUser.id}`, user);
        }
        router.replace(takeGoogleNext());
      } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
      return;
    }
    if (!token) return;
    setBusy(true); setError(null);
    try {
      finish(await apiPost<Resp>("/auth/supabase", { access_token: token, company_code: code.trim().toUpperCase(), role, name }));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (join) {
    return (
      <section className="auth-card" aria-labelledby="g-title">
        <div className="auth-card__head">
          <h2 id="g-title" className="auth-card__title">Join your company</h2>
          <p className="af-hint">Signed in with Google as <strong>{join.email}</strong>. One last step.</p>
        </div>
        <form className="af-form" onSubmit={submitJoin} noValidate>
          <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          {isDemoBuild ? (
            <>
              <label className="af-field">
                <span className="af-label">Demo company</span>
                <select className="af-input af-select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                  {DEMO_COMPANIES.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </label>
              <TextField label="Demo join code (optional)" value={demoCode} onChange={(e) => setDemoCode(e.target.value.toUpperCase())} maxLength={6} hint="Use a listed demo code, or choose a simulated role below." />
              <p className="af-hint">Demo codes: {DEMO_JOIN_CODES.map((item) => `${item.code} (${item.purpose})`).join(", ")}</p>
            </>
          ) : <TextField label="Company join code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} required hint="Six characters, from your Business Head." />}
          <label className="af-field">
            <span className="af-label">Your role</span>
            <select className="af-input af-select" value={role} onChange={(e) => setRole(e.target.value)} required>
              <option value="" disabled>{isDemoBuild ? "Choose a demo role if you have no code" : "Pick a role"}</option>
              {ROLE_INFO.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          <FormError message={error} />
          <Button type="submit" variant="primary" className="auth-btn-block" disabled={busy || (!isDemoBuild && code.trim().length !== 6) || !role}>
            {busy ? "Joining…" : "Join and continue"}
          </Button>
        </form>
      </section>
    );
  }
  if (error) {
    return (
      <section className="auth-card">
        <h2 className="auth-card__title">Google sign-in failed</h2>
        <FormError message={error} />
        <Button variant="primary" onClick={() => router.replace("/")}>Back to sign in</Button>
      </section>
    );
  }
  return <StrataLoader size="lg" label="Finishing Google sign-in" />;
}
