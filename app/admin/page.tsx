"use client";

import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,CalendarDays,CheckCircle2,LogOut,RefreshCw,ShieldCheck,UserX} from "lucide-react";
import {createClient} from "@/lib/supabase/client";

type Role="driver"|"duty_sergeant"|"admin"|"master_admin";
type Status="pending"|"approved"|"rejected"|"blocked";
type Profile={id:string;full_name:string;rank:string|null;military_id:string|null;role:Role;status:Status;created_at:string};
type Roster={id:string;duty_date:string;profile_id:string;profiles:{full_name:string;rank:string|null}|null};
const roleLabel:Record<Role,string>={driver:"Motorista",duty_sergeant:"Sargento de Dia",admin:"Administrador",master_admin:"ADM Mestre"};

function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}

export default function AdminPage(){
 const[profiles,setProfiles]=useState<Profile[]>([]),[rosters,setRosters]=useState<Roster[]>([]),[date,setDate]=useState(today()),[sergeant,setSergeant]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[message,setMessage]=useState("");
 const load=useCallback(async()=>{setLoading(true);setMessage("");const supabase=createClient();const[p,r]=await Promise.all([supabase.from("profiles").select("id,full_name,rank,military_id,role,status,created_at").order("created_at",{ascending:false}),supabase.from("duty_rosters").select("id,duty_date,profile_id,profiles!duty_rosters_profile_id_fkey(full_name,rank)").gte("duty_date",today()).order("duty_date").limit(30)]);if(p.error||r.error)setMessage(p.error?.message??r.error?.message??"Falha ao carregar.");setProfiles((p.data??[]) as Profile[]);setRosters((r.data??[]) as unknown as Roster[]);setLoading(false)},[]);
 useEffect(()=>{void load()},[load]);
 async function updateProfile(profile:Profile,status:Status,role:Role=profile.role){setBusy(profile.id);setMessage("");const{error}=await createClient().rpc("master_update_profile",{p_profile_id:profile.id,p_status:status,p_role:role});setBusy("");if(error){setMessage(translate(error.message));return}setMessage(`${profile.full_name}: cadastro atualizado.`);await load()}
 async function saveRoster(e:React.FormEvent){e.preventDefault();if(!sergeant){setMessage("Selecione o Sargento de Dia.");return}setBusy("roster");const{error}=await createClient().rpc("master_set_duty_roster",{p_duty_date:date,p_profile_id:sergeant});setBusy("");if(error){setMessage(translate(error.message));return}setMessage("Escala salva.");await load()}
 async function logout(){setBusy("logout");const{error}=await createClient().auth.signOut();if(error){setMessage(`Não foi possível sair: ${error.message}`);setBusy("");return}window.location.href="/login"}
 const candidates=profiles.filter(p=>p.status==="approved"&&["duty_sergeant","admin","master_admin"].includes(p.role));
 return <main className="admin-page"><header className="admin-header"><Link href="/"><ArrowLeft/> Voltar ao painel</Link><div><ShieldCheck/><span><b>Administração SSV</b><small>Área exclusiva do ADM Mestre</small></span></div><button onClick={logout} disabled={busy==="logout"}><LogOut/> Sair</button></header>
  <div className="admin-content"><div className="admin-title"><div><h1>Aprovações e escala</h1><p>As alterações são validadas novamente pelo banco antes de serem gravadas.</p></div><button onClick={()=>void load()} disabled={loading}><RefreshCw/> Atualizar</button></div>{message&&<p className="admin-message" role="alert">{message}</p>}
   <section className="admin-grid"><article className="admin-panel"><h2>Usuários</h2><p>Analise, aprove, bloqueie e defina o nível de acesso.</p>{loading?<div className="empty">Carregando...</div>:profiles.map(profile=><div className="user-row" key={profile.id}><div><b>{profile.rank?`${profile.rank} `:""}{profile.full_name}</b><small>{profile.military_id??"Sem identidade informada"} · {profile.status}</small></div><select aria-label={`Função de ${profile.full_name}`} value={profile.role} disabled={busy===profile.id} onChange={e=>void updateProfile(profile,profile.status,e.target.value as Role)}>{Object.entries(roleLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><div className="user-actions">{profile.status!=="approved"&&<button className="approve" disabled={busy===profile.id} onClick={()=>void updateProfile(profile,"approved")}><CheckCircle2/> Aprovar</button>}{profile.status!=="blocked"&&<button className="block" disabled={busy===profile.id} onClick={()=>void updateProfile(profile,"blocked")}><UserX/> Bloquear</button>}{profile.status==="blocked"&&<button disabled={busy===profile.id} onClick={()=>void updateProfile(profile,"approved")}><CheckCircle2/> Desbloquear</button>}</div></div>)}</article>
    <article className="admin-panel"><h2>Escala de Sargento de Dia</h2><p>Defina um responsável por data. Salvar novamente substitui a escala daquele dia.</p><form className="roster-form" onSubmit={saveRoster}><label>Data<input type="date" value={date} min={today()} onChange={e=>setDate(e.target.value)} required/></label><label>Responsável<select value={sergeant} onChange={e=>setSergeant(e.target.value)} required><option value="">Selecione...</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.rank?`${p.rank} `:""}{p.full_name}</option>)}</select></label><button disabled={busy==="roster"}><CalendarDays/> {busy==="roster"?"Salvando...":"Salvar escala"}</button></form><div className="roster-list">{rosters.map(item=><div key={item.id}><time>{new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC"}).format(new Date(`${item.duty_date}T12:00:00Z`))}</time><span>{item.profiles?[item.profiles.rank,item.profiles.full_name].filter(Boolean).join(" "):"Perfil indisponível"}</span></div>)}{!rosters.length&&!loading&&<div className="empty">Nenhuma escala futura definida.</div>}</div></article>
   </section>
  </div>
 </main>;
}

function translate(message:string){const known:Record<string,string>={master_admin_required:"Somente o ADM Mestre pode executar esta ação.",profile_not_found:"Perfil não encontrado.",invalid_roster_profile:"O responsável precisa estar aprovado e possuir função operacional.",cannot_block_last_master_admin:"Não é permitido bloquear ou rebaixar o último ADM Mestre."};return known[message]??message}
