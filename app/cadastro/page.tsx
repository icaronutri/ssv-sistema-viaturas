"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CadastroPage(){
 const [done,setDone]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
 const [form,setForm]=useState({name:"",rank:"",militaryId:"",sector:"STS",email:"",password:""});
 const set=(k:string,v:string)=>setForm({...form,[k]:v});
 async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");
  const supabase = createClient();
  const {data,error:authError}=await supabase.auth.signUp({email:form.email,password:form.password,options:{data:{
   full_name:form.name.trim(),rank:form.rank.trim(),military_id:form.militaryId.trim(),sector:form.sector,
   registration_type:"duty_sergeant_pre_registration",
  }}});
  if(authError||!data.user){setError(authError?.message??"Não foi possível criar o cadastro.");setLoading(false);return;}
  setDone(true);setLoading(false);
 }
 if(done)return <main className="auth-page single"><section className="auth-card success"><CheckCircle2/><h2>Solicitação enviada</h2><p>Seu cadastro está aguardando aprovação do administrador. Você receberá acesso somente após a conferência dos dados.</p><Link href="/login">Voltar ao login</Link></section></main>;
 return <main className="auth-page"><section className="auth-brand"><div className="auth-logo"><img src="/ssv-logo-transparent.png" alt="Logo SSV"/></div><b>SSV</b><h1>Pré-cadastro do Sargento de Dia</h1><p>Informe seus dados funcionais. O acesso só será liberado após aprovação.</p></section>
 <section className="auth-card"><Link className="back" href="/login"><ArrowLeft/> Voltar</Link><div><small>SOLICITAÇÃO DE ACESSO</small><h2>Criar pré-cadastro</h2></div><form onSubmit={submit}>
 <label>Nome completo<input value={form.name} onChange={e=>set("name",e.target.value)} required/></label><div className="form-grid"><label>Posto/graduação<input value={form.rank} onChange={e=>set("rank",e.target.value)} required placeholder="Ex.: 2º Sgt"/></label><label>Identidade militar<input value={form.militaryId} onChange={e=>set("militaryId",e.target.value)} required/></label></div>
 <label>Setor<select value={form.sector} onChange={e=>set("sector",e.target.value)}><option>STS</option><option>ETA</option><option>STR</option></select></label><label>E-mail<input type="email" value={form.email} onChange={e=>set("email",e.target.value)} required/></label><label>Crie sua senha<input type="password" minLength={8} value={form.password} onChange={e=>set("password",e.target.value)} required/><small>Mínimo de 8 caracteres.</small></label>
 {error&&<p className="form-message error">{error}</p>}<button className="auth-submit" disabled={loading}>{loading?"Enviando...":"Enviar para aprovação"}</button></form></section></main>
}
