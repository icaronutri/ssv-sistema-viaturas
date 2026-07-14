"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {LogIn} from "lucide-react";
import {createClient} from "@/lib/supabase/client";

export default function LoginPage(){
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get("error")==="oauth")setMessage("Não foi possível concluir o login com Google. Tente novamente.")},[]);
 async function passwordLogin(e:React.FormEvent){e.preventDefault();setLoading(true);setMessage("");try{const{error}=await createClient().auth.signInWithPassword({email,password});if(error)throw error;setMessage("Acesso realizado. Redirecionando...");window.location.href="/"}catch{setMessage("E-mail ou senha inválidos.");setLoading(false)}}
 async function googleLogin(){setLoading(true);setMessage("");try{const{data,error}=await createClient().auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth/callback?next=/`}});if(error)throw error;if(!data.url)throw new Error("URL de autenticação não recebida");window.location.assign(data.url)}catch(error){setMessage(error instanceof Error?`Não foi possível iniciar o login Google: ${error.message}`:"Não foi possível iniciar o login Google.");setLoading(false)}}
 return <main className="auth-page"><section className="auth-brand"><div className="auth-logo"><img src="/ssv-logo-transparent.png" alt="Logo SSV"/></div><b>SSV</b><h1>Sistema de Supervisão de Viaturas</h1><p>Controle seguro de viaturas, movimentações, checklists e manutenção.</p></section><section className="auth-card"><div><small>ACESSO AO SISTEMA</small><h2>Entrar no SSV</h2><p>Use sua conta autorizada para continuar.</p></div><button className="google" onClick={googleLogin} disabled={loading}><span>G</span> Entrar com Google</button><div className="divider">ou</div><form onSubmit={passwordLogin}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nome@fab.mil.br"/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Sua senha"/></label>{message&&<p className="form-message" role="alert">{message}</p>}<button className="auth-submit" disabled={loading}><LogIn/> {loading?"Aguarde...":"Entrar"}</button></form><p className="auth-link">Sargento de Dia sem cadastro? <Link href="/cadastro">Solicitar acesso</Link></p></section></main>
}
