"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Bell, Car, ClipboardCheck, Eye, FileText, KeyRound, LayoutDashboard, LogIn, LogOut, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile={full_name:string;rank:string|null;role:"driver"|"duty_sergeant"|"admin"|"master_admin";status:string};
type Vehicle={id:string;name:string;prefix:string;plate:string;current_odometer:number;status:string;is_external:boolean;origin_sector:{name:string}|null;current_sector:{name:string}|null};
type Movement={id:string;departure_at:string;return_at:string|null;start_odometer:number;end_odometer:number|null;distance_km:number|null;mission:string|null;driver_name_manual:string|null;status:string;vehicle:{name:string;prefix:string}|null};
type Maintenance={id:string;service_type:string;next_due_date:string|null;next_due_odometer:number|null;status:string;vehicle:{name:string;prefix:string}|null};
type Counts={checklists:number;reports:number;openMovements:number};

const roleNames:Record<Profile["role"],string>={driver:"Motorista",duty_sergeant:"Sargento de Dia",admin:"Administrador",master_admin:"ADM Mestre"};
const statusNames:Record<string,string>={available:"Disponível",at_sts:"Na STS",on_mission:"Em missão",maintenance:"Manutenção",unavailable:"Indisponível",external:"Externa"};

export default function Home(){
 const router=useRouter();
 const[ready,setReady]=useState(false),[session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null);
 const[vehicles,setVehicles]=useState<Vehicle[]>([]),[movements,setMovements]=useState<Movement[]>([]),[maintenance,setMaintenance]=useState<Maintenance[]>([]),[counts,setCounts]=useState<Counts>({checklists:0,reports:0,openMovements:0});
 const[query,setQuery]=useState(""),[message,setMessage]=useState(""),[viewAsSergeant,setViewAsSergeant]=useState(false),[loggingOut,setLoggingOut]=useState(false);

 useEffect(()=>{
  let active=true;const supabase=createClient();
  const apply=async(next:Session|null)=>{if(!active)return;setSession(next);if(!next){setProfile(null);setReady(true);return}
   const{data,error}=await supabase.from("profiles").select("full_name,rank,role,status").eq("id",next.user.id).single();
   if(!active)return;if(error||!data||data.status!=="approved"){router.replace(`/acesso-negado?reason=${data?.status??"profile"}`);return}
   setProfile(data as Profile);
   const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
   const start=`${today}T00:00:00-03:00`,end=`${today}T23:59:59-03:00`;
   const[v,m,open,mt,c,r]=await Promise.all([
    supabase.from("vehicles").select("id,name,prefix,plate,current_odometer,status,is_external,origin_sector:sectors!vehicles_origin_sector_id_fkey(name),current_sector:sectors!vehicles_current_sector_id_fkey(name)").eq("active",true).order("prefix"),
    supabase.from("movements").select("id,departure_at,return_at,start_odometer,end_odometer,distance_km,mission,driver_name_manual,status,vehicle:vehicles(name,prefix)").gte("departure_at",start).lte("departure_at",end).order("departure_at",{ascending:false}),
    supabase.from("movements").select("id",{count:"exact",head:true}).eq("status","open").is("return_at",null),
    supabase.from("maintenance_plans").select("id,service_type,next_due_date,next_due_odometer,status,vehicle:vehicles(name,prefix)").in("status",["scheduled","due_soon","overdue"]).order("next_due_date").limit(5),
    supabase.from("checklists").select("id",{count:"exact",head:true}).gte("performed_at",start).lte("performed_at",end),
    supabase.from("daily_reports").select("id",{count:"exact",head:true}).eq("report_date",today),
   ]);
   if(!active)return;
   setVehicles((v.data??[]) as unknown as Vehicle[]);setMovements((m.data??[]) as unknown as Movement[]);setMaintenance((mt.data??[]) as unknown as Maintenance[]);setCounts({checklists:c.count??0,reports:r.count??0,openMovements:open.count??0});
   const first=[v.error,m.error,open.error,mt.error,c.error,r.error].find(Boolean);if(first)setMessage(`Parte dos dados não pôde ser carregada: ${first.message}`);
   setReady(true);
  };
  void supabase.auth.getSession().then(({data})=>apply(data.session));
  const{data}=supabase.auth.onAuthStateChange((_event,next)=>queueMicrotask(()=>void apply(next)));
  return()=>{active=false;data.subscription.unsubscribe()};
 },[router]);

 async function logout(){setLoggingOut(true);setMessage("");try{const{error}=await createClient().auth.signOut();if(error)throw error;router.replace("/login");router.refresh()}catch(error){setMessage(error instanceof Error?`Não foi possível sair: ${error.message}`:"Não foi possível sair.");setLoggingOut(false)}}
 const filtered=useMemo(()=>vehicles.filter(v=>`${v.name} ${v.prefix} ${v.plate}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))),[vehicles,query]);
 const actualRole=profile?.role;const effectiveRole=viewAsSergeant&&actualRole==="master_admin"?"duty_sergeant":actualRole;
 const operational=effectiveRole&&["duty_sergeant","admin","master_admin"].includes(effectiveRole);const master=actualRole==="master_admin"&&!viewAsSergeant;
 const displayName=profile?.full_name??"Usuário",initials=displayName.split(" ").filter(Boolean).slice(0,2).map(n=>n[0]).join("").toUpperCase();
 const dateLabel=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",weekday:"long",day:"2-digit",month:"long"}).format(new Date());

 if(!ready)return <main className="splash"><div className="auth-logo"><img src="/ssv-logo-transparent.png" alt="SSV"/></div><b>SSV</b><span>Carregando sistema...</span></main>;
 if(!session)return <main className="portal"><section className="portal-hero"><div className="portal-brand"><div className="auth-logo"><img src="/ssv-logo-transparent.png" alt="Logo SSV"/></div><div><b>SSV</b><small>Sistema de Supervisão de Viaturas</small></div></div><div className="portal-copy"><span>GESTÃO OPERACIONAL DE FROTA</span><h1>Supervisão segura, simples e centralizada.</h1><p>Controle viaturas, movimentações, checklists, panes, manutenção e relatórios em um único sistema.</p></div><div className="portal-features"><div><Car/><span><b>Frota em tempo real</b><small>Situação atual com dados do SSV</small></span></div><div><ClipboardCheck/><span><b>Checklist digital</b><small>Histórico vinculado à viatura</small></span></div><div><ShieldCheck/><span><b>Acesso controlado</b><small>Motorista, Sargento e Administração</small></span></div></div></section><section className="portal-access"><div className="portal-card"><small>ACESSO AO SSV</small><h2>Como deseja entrar?</h2><p>O sistema abrirá o painel permitido para a sua conta.</p><Link className="access-button primary-access" href="/login"><LogIn/><span><b>Entrar no sistema</b><small>Link seguro por e-mail ou senha</small></span></Link><div className="portal-divider"><span>NOVO ACESSO</span></div><Link className="access-button register-access" href="/cadastro"><UserRound/><span><b>Solicitar pré-cadastro</b><small>Sargento de Dia — sujeito à aprovação</small></span></Link></div></section></main>;

 return <div className="app-shell">
  <aside className="sidebar"><div className="brand"><div className="wing handshake"><img src="/ssv-logo-transparent.png" alt="SSV"/></div><div><strong>SSV</strong><small>Sistema de Supervisão de Viaturas</small></div></div><nav>
   <Link className="active" href="/"><LayoutDashboard/> Visão geral</Link>
   {operational&&<Link href="/claviculario"><KeyRound/> Claviculário</Link>}
   {master&&<Link href="/admin"><ShieldCheck/> Administração</Link>}
   <span className="nav-disabled" title="Módulo ainda não disponível"><Car/> Viaturas <small>em breve</small></span><span className="nav-disabled" title="Módulo ainda não disponível"><ClipboardCheck/> Checklists <small>em breve</small></span><span className="nav-disabled" title="Módulo ainda não disponível"><Wrench/> Manutenção <small>em breve</small></span><span className="nav-disabled" title="Módulo ainda não disponível"><FileText/> Relatórios <small>em breve</small></span>
  </nav><div className="sidebar-bottom">{actualRole==="master_admin"&&<button className="view-role" onClick={()=>setViewAsSergeant(v=>!v)}><Eye/> {viewAsSergeant?"Voltar ao ADM Mestre":"Ver como Sargento"}</button>}<div className="profile"><div className="avatar">{initials}</div><div><strong>{profile?.rank?`${profile.rank} `:""}{displayName}</strong><small>{viewAsSergeant?"Visualização: Sargento de Dia":roleNames[actualRole!]}</small></div></div><button className="logout-button" onClick={logout} disabled={loggingOut}><LogOut/> {loggingOut?"Saindo...":"Sair"}</button></div></aside>
  <main className="main"><header className="topbar"><div className="mobile-brand"><div className="wing handshake"><img src="/ssv-logo-transparent.png" alt="SSV"/></div><strong>SSV</strong></div><div className="sync"><i/> Sistema online</div><button className="bell" aria-label="Notificações" disabled><Bell/></button><div className="top-profile"><div className="avatar">{initials}</div><div><strong>{displayName}</strong><small>{roleNames[effectiveRole!]}</small></div></div><button className="top-logout" onClick={logout} disabled={loggingOut} aria-label="Sair"><LogOut/></button></header>
   {viewAsSergeant&&<div className="view-banner"><Eye/> Você está vendo a apresentação de Sargento de Dia. Seu perfil e seus registros continuam sendo de ADM Mestre.<button onClick={()=>setViewAsSergeant(false)}>Encerrar visualização</button></div>}
   <div className="content"><section className="welcome"><div><p>{dateLabel}</p><h1>Olá, {displayName.split(" ")[0]}</h1><span>{effectiveRole==="driver"?"Consulte suas movimentações e a situação da frota.":"Acompanhe a operação com dados reais do SSV."}</span></div></section>
    {message&&<p className="dashboard-message" role="alert">{message}</p>}
    <section className="stats"><article><div className="stat-icon blue"><Car/></div><div><span>Na STS / disponíveis</span><strong>{vehicles.filter(v=>["available","at_sts"].includes(v.status)).length}</strong><small>{vehicles.length} viaturas ativas</small></div></article><article><div className="stat-icon green"><LogOut/></div><div><span>Em missão</span><strong>{counts.openMovements}</strong><small>Saídas ainda sem retorno</small></div></article><article><div className="stat-icon amber"><Wrench/></div><div><span>Alertas</span><strong>{maintenance.length}</strong><small>Manutenções próximas ou vencidas</small></div></article><article><div className="stat-icon purple"><ClipboardCheck/></div><div><span>Checklists hoje</span><strong>{counts.checklists}</strong><small>{counts.reports} relatório(s) do dia</small></div></article></section>
    <div className="dashboard-grid"><section className="panel vehicles-panel"><div className="panel-head"><div><h2>Viaturas sob controle</h2><p>Dados atuais do Supabase</p></div></div><label className="search"><span aria-hidden>⌕</span><input aria-label="Buscar viatura" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, prefixo ou placa"/></label><div className="vehicle-list">{filtered.map(v=><article key={v.id}><div className="vehicle-img"><Car/></div><div className="vehicle-info"><div><h3>{v.name}</h3><span className={`badge ${v.status==="on_mission"?"green":v.status==="maintenance"?"amber":"blue"}`}>{statusNames[v.status]??v.status}</span></div><p><b>{v.prefix}</b><i>•</i>{v.plate}<i>•</i>{Number(v.current_odometer).toLocaleString("pt-BR")} km</p><small>Origem: {v.origin_sector?.name??"—"} <span>→</span> Atual: <b>{v.current_sector?.name??"—"}</b></small></div></article>)}{!filtered.length&&<div className="empty">Nenhuma viatura cadastrada ou visível para este perfil.</div>}</div></section>
     <section className="panel alerts"><div className="panel-head"><div><h2>Manutenção</h2><p>Próximos vencimentos</p></div></div>{maintenance.map(item=><article key={item.id}><div className={`alert-icon ${item.status==="overdue"?"red":"amber"}`}><Wrench/></div><div><h3>{item.service_type}</h3><p>{item.vehicle?`${item.vehicle.name} · ${item.vehicle.prefix}`:"Viatura"}</p><small>{item.next_due_date?`Vencimento: ${new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC"}).format(new Date(`${item.next_due_date}T12:00:00Z`))}`:item.next_due_odometer?`Aos ${Number(item.next_due_odometer).toLocaleString("pt-BR")} km`:"Sem vencimento informado"}</small></div></article>)}{!maintenance.length&&<div className="empty">Nenhum alerta de manutenção.</div>}</section></div>
    <section className="panel movements"><div className="panel-head"><div><h2>Movimentações de hoje</h2><p>Somente registros que o seu nível de acesso pode consultar</p></div></div><div className="movement-table"><div className="row heading"><span>Horário</span><span>Viatura</span><span>Motorista</span><span>KM inicial</span><span>KM final</span><span>Percorrido</span><span>Situação</span></div>{movements.map(m=><div className="row" key={m.id}><span data-label="Horário"><b>{new Date(m.departure_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</b></span><span data-label="Viatura"><b>{m.vehicle?`${m.vehicle.name} · ${m.vehicle.prefix}`:"—"}</b><small>{m.mission??"Sem missão"}</small></span><span data-label="Motorista">{m.driver_name_manual??"Usuário cadastrado"}</span><span data-label="KM inicial"><b>{Number(m.start_odometer).toLocaleString("pt-BR")}</b></span><span data-label="KM final"><b>{m.end_odometer==null?"—":Number(m.end_odometer).toLocaleString("pt-BR")}</b></span><span data-label="Percorrido">{m.distance_km==null?"—":`${m.distance_km} km`}</span><span data-label="Situação"><em className={m.status==="open"?"mission":"returned"}>{m.status==="open"?"Em missão":m.status==="returned"?"Regressou":"Cancelada"}</em></span></div>)}{!movements.length&&<div className="empty">Nenhuma movimentação hoje.</div>}</div></section>
   </div><nav className="bottom-nav"><Link className="active" href="/"><LayoutDashboard/><span>Início</span></Link>{operational&&<Link href="/claviculario"><KeyRound/><span>Chaves</span></Link>}{master&&<Link href="/admin"><ShieldCheck/><span>Admin</span></Link>}<button onClick={logout} aria-label="Sair"><LogOut/></button></nav>
  </main>
 </div>;
}
