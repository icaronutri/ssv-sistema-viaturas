"use client";
import { useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [message,setMessage]=useState(""); const [loading,setLoading]=useState(false);
  async function passwordLogin(e:React.FormEvent){e.preventDefault();setLoading(true);setMessage("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    setMessage(error ? "E-mail ou senha inválidos." : "Acesso realizado. Redirecionando...");
    if(!error) window.location.href="/"; setLoading(false);
  }
  async function googleLogin(){setLoading(true);const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+"/"}});
    if(error){setMessage("O login Google ainda precisa ser ativado pelo administrador.");setLoading(false);}
  }
  return <main className="auth-page"><section className="auth-brand"><div className="auth-logo"><img src="/ssv-logo-transparent.png" alt="Logo SSV"/></div><b>SSV</b><h1>Sistema de Supervisão de Viaturas</h1><p>Controle seguro de viaturas, movimentações, checklists e manutenção.</p></section>
  <section className="auth-card"><div><small>ACESSO AO SISTEMA</small><h2>Entrar no SSV</h2><p>Use sua conta autorizada para continuar.</p></div>
  <button className="google" onClick={googleLogin} disabled={loading}><span>G</span> Entrar com Google</button><div className="divider">ou</div>
  <form onSubmit={passwordLogin}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nome@fab.mil.br"/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Sua senha"/></label>
  {message&&<p className="form-message">{message}</p>}<button className="auth-submit" disabled={loading}><LogIn/> {loading?"Aguarde...":"Entrar"}</button></form>
  <p className="auth-link">Sargento de Dia sem cadastro? <Link href="/cadastro">Solicitar acesso</Link></p></section></main>
}
