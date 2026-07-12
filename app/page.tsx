"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Car, CircleHelp, ClipboardCheck, FileText, KeyRound, LayoutDashboard, LogIn, LogOut, Plus, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const vehicles = [
  { name: "Kombi", prefix: "12BP150", plate: "ABC-1234", origin: "ETA", current: "STS", km: "84.620", status: "Na STS", tone: "blue" },
  { name: "L200 Triton", prefix: "12BP204", plate: "DEF-5G67", origin: "STS", current: "Em missão", km: "61.380", status: "Em missão", tone: "green" },
  { name: "Micro-ônibus", prefix: "12BP088", plate: "GHI-8J90", origin: "STR", current: "STS", km: "132.910", status: "Manutenção próxima", tone: "amber" },
];

const movements = [
  { time: "07:12", vehicle: "L200 Triton · 12BP204", driver: "Cb Silva", mission: "Apoio operacional", startKm: "61.380", endKm: "—", distance: "—", state: "Em missão" },
  { time: "06:48", vehicle: "Kombi · 12BP150", driver: "S2 Oliveira", mission: "Transporte ETA", startKm: "84.588", endKm: "84.620", distance: "32 km", state: "Regressou 09:35" },
  { time: "06:20", vehicle: "Micro-ônibus · 12BP088", driver: "3S Martins", mission: "Transporte de efetivo", startKm: "132.862", endKm: "132.910", distance: "48 km", state: "Regressou 08:10" },
];

function Icon({ children }: { children: React.ReactNode }) {
  const icons: Record<string, React.ReactNode> = { "▦": <LayoutDashboard />, "↔": <LogIn />, "▰": <Car />, "✓": <ClipboardCheck />, "⚙": <Wrench />, "▤": <FileText />, "?": <CircleHelp /> };
  return <span className="icon" aria-hidden="true">{icons[String(children)]}</span>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [sessionReady,setSessionReady]=useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const [profile,setProfile]=useState({full_name:"",rank:"",role:""});
  useEffect(()=>{const supabase=createClient();const load=async(userId?:string)=>{if(!userId)return;const {data}=await supabase.from("profiles").select("full_name,rank,role,status").eq("id",userId).single();if(data)setProfile(data)};
    supabase.auth.getSession().then(({data})=>{setAuthenticated(!!data.session);load(data.session?.user.id);setSessionReady(true)});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{setAuthenticated(!!session);load(session?.user.id)});
    return()=>data.subscription.unsubscribe();
  },[]);
  const filtered = useMemo(() => vehicles.filter(v => `${v.name} ${v.prefix} ${v.plate}`.toLowerCase().replace(/[- ]/g, "").includes(query.toLowerCase().replace(/[- ]/g, ""))), [query]);
  const action = (text: string) => { setToast(text); setTimeout(() => setToast(""), 2500); };
  const displayName=profile.full_name||"Usuário";
  const firstName=displayName.split(" ")[0];
  const initials=displayName.split(" ").filter(Boolean).slice(0,2).map(n=>n[0]).join("").toUpperCase();
  const roleLabel=profile.role==="master_admin"?"ADM Mestre":profile.role==="admin"?"Administrador":profile.role==="duty_sergeant"?"Sargento de Dia":"Motorista";
  const isAdmin=profile.role==="master_admin"||profile.role==="admin";

  if(!sessionReady) return <main className="splash"><div className="auth-logo"><img src="/ssv-logo-transparent.png" alt="SSV"/></div><b>SSV</b><span>Carregando sistema...</span></main>;
  if(!authenticated) return <main className="portal">
    <section className="portal-hero"><div className="portal-brand"><div className="auth-logo"><img src="/ssv-logo-transparent.png" alt="Logo SSV"/></div><div><b>SSV</b><small>Sistema de Supervisão de Viaturas</small></div></div>
      <div className="portal-copy"><span>GESTÃO OPERACIONAL DE FROTA</span><h1>Supervisão segura, simples e centralizada.</h1><p>Controle viaturas, movimentações, checklists, panes, manutenção e relatórios em um único sistema.</p></div>
      <div className="portal-features"><div><Car/><span><b>Frota em tempo real</b><small>Origem, localização e situação atual</small></span></div><div><ClipboardCheck/><span><b>Checklist digital</b><small>Fotos e funcionamento offline</small></span></div><div><ShieldCheck/><span><b>Acesso controlado</b><small>Motorista, Sargento e Administração</small></span></div></div>
    </section>
    <section className="portal-access"><div className="portal-card"><small>ACESSO AO SSV</small><h2>Como deseja entrar?</h2><p>O sistema abrirá o painel correto conforme seu nível de acesso.</p>
      <Link className="access-button primary-access" href="/login"><LogIn/><span><b>Entrar no sistema</b><small>ADM Mestre, administrador ou Sargento de Dia</small></span></Link>
      <Link className="access-button google-access" href="/login"><span className="google-g">G</span><span><b>Entrar com Google</b><small>Acesso rápido para motoristas autorizados</small></span></Link>
      <div className="portal-divider"><span>NOVO ACESSO</span></div>
      <Link className="access-button register-access" href="/cadastro"><UserRound/><span><b>Solicitar pré-cadastro</b><small>Sargento de Dia — sujeito à aprovação</small></span></Link>
      <div className="access-note"><ShieldCheck/><p>Seus dados são protegidos. Nenhum acesso é liberado sem validação do administrador.</p></div>
    </div></section>
  </main>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="wing handshake"><img src="/ssv-logo-transparent.png" alt="SSV"/></div><div><strong>SSV</strong><small>Sistema de Supervisão de Viaturas</small></div></div>
        <nav>
          <a className="active"><Icon>▦</Icon> Visão geral</a>
          <a><Icon>↔</Icon> Movimentações</a>
          <a><Icon>▰</Icon> Viaturas</a>
          <a><Icon>✓</Icon> Checklists</a>
          <a><Icon>⚙</Icon> Manutenção <b>2</b></a>
          <a><Icon>▤</Icon> Relatório diário</a>
          <Link href="/claviculario"><KeyRound size={18}/> Claviculário</Link>
          {isAdmin&&<><a><ShieldCheck size={18}/> Administração</a><a><UserRound size={18}/> Usuários</a></>}
        </nav>
        <div className="sidebar-bottom"><a><Icon>?</Icon> Ajuda e suporte</a><div className="profile"><div className="avatar">{initials}</div><div><strong>{profile.rank?profile.rank+" ":""}{displayName}</strong><small>{roleLabel}</small></div><span>⋮</span></div></div>
      </aside>

      <main className="main">
        <header className="topbar"><div className="mobile-brand"><div className="wing handshake"><img src="/ssv-logo-transparent.png" alt="SSV"/></div><strong>SSV</strong></div><div className="sync"><i></i> Sistema online</div><button className="bell" aria-label="Notificações"><Bell /><em>3</em></button><div className="top-profile"><div className="avatar">{initials}</div><div><strong>{profile.rank?profile.rank+" ":""}{displayName}</strong><small>{roleLabel}</small></div></div></header>

        <div className="content">
          <section className="welcome"><div><p>Domingo, 12 de julho</p><h1>Bom dia, {firstName}</h1><span>{isAdmin?"Painel de administração e supervisão geral do SSV.":"Acompanhe a situação das viaturas durante o seu serviço."}</span></div><button className="primary" onClick={() => action("Cadastro rápido de viatura aberto")}>＋ Cadastrar viatura</button></section>

          <section className="stats">
            <article><div className="stat-icon blue">▰</div><div><span>Na STS</span><strong>08</strong><small>6 próprias · 2 de setores</small></div></article>
            <article><div className="stat-icon green">➜</div><div><span>Em missão</span><strong>03</strong><small>Saídas em andamento</small></div></article>
            <article><div className="stat-icon amber">⚠</div><div><span>Com alerta</span><strong>02</strong><small>Requerem atenção</small></div></article>
            <article><div className="stat-icon purple">↗</div><div><span>Externas</span><strong>01</strong><small>De outra unidade</small></div></article>
          </section>

          <section className="quick-actions"><button onClick={() => action("Nova saída iniciada")}><b><LogOut /></b><span><strong>Registrar saída</strong><small>Iniciar uma movimentação</small></span></button><button onClick={() => action("Entrada manual iniciada")}><b><LogIn /></b><span><strong>Registrar entrada</strong><small>Viatura externa ou regresso</small></span></button><button onClick={() => action("Relatório do dia preparado")}><b><FileText /></b><span><strong>Relatório do dia</strong><small>Revisar e finalizar serviço</small></span></button></section>

          <div className="dashboard-grid">
            <section className="panel vehicles-panel"><div className="panel-head"><div><h2>Viaturas sob controle</h2><p>Busque por nome, prefixo ou placa</p></div><a>Ver todas →</a></div><label className="search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: Kombi, 12BP150 ou ABC-1234" /></label><div className="vehicle-list">{filtered.map(v => <article key={v.prefix}><div className="vehicle-img">▰</div><div className="vehicle-info"><div><h3>{v.name}</h3><span className={`badge ${v.tone}`}>{v.status}</span></div><p><b>{v.prefix}</b><i>•</i>{v.plate}<i>•</i>{v.km} km</p><small>Origem: {v.origin} <span>→</span> Atual: <b>{v.current}</b></small></div><button aria-label="Abrir ficha" onClick={() => action(`Ficha da ${v.name} aberta`)}>›</button></article>)}{filtered.length === 0 && <div className="empty">Nenhuma viatura encontrada.</div>}</div></section>

            <section className="panel alerts"><div className="panel-head"><div><h2>Alertas de manutenção</h2><p>Próximos vencimentos</p></div><a>Ver todos →</a></div><article><div className="alert-icon amber">●</div><div><h3>Troca de óleo</h3><p>Micro-ônibus · 12BP088</p><small>Faltam <b>310 km</b> ou vence em 8 dias</small><div className="progress"><i style={{width:"78%"}}></i></div></div></article><article><div className="alert-icon red">!</div><div><h3>Licenciamento</h3><p>Van Sprinter · 12BP119</p><small><b>Vencido há 3 dias</b></small></div></article><button className="outline" onClick={() => action("Painel de manutenção aberto")}>Abrir painel de manutenção</button></section>
          </div>

          <section className="panel movements"><div className="panel-head"><div><h2>Movimentações de hoje</h2><p>Quilometragem vinculada permanentemente ao histórico da viatura</p></div><a>Ver histórico →</a></div><div className="movement-table"><div className="row heading"><span>Horário</span><span>Viatura</span><span>Motorista</span><span>KM inicial</span><span>KM final</span><span>Percorrido</span><span>Situação</span></div>{movements.map(m => <div className="row" key={m.time}><span data-label="Horário"><b>{m.time}</b></span><span data-label="Viatura"><b>{m.vehicle}</b><small>{m.mission}</small></span><span data-label="Motorista">{m.driver}</span><span data-label="KM inicial"><b>{m.startKm}</b></span><span data-label="KM final"><b>{m.endKm}</b></span><span data-label="Percorrido">{m.distance}</span><span data-label="Situação"><em className={m.state === "Em missão" ? "mission" : "returned"}>{m.state}</em></span></div>)}</div></section>
        </div>
        <nav className="bottom-nav"><a className="active"><b><LayoutDashboard /></b><span>Início</span></a><a><b><LogIn /></b><span>Movimentos</span></a><button onClick={() => action("Nova movimentação iniciada")}><Plus /></button><a><b><Car /></b><span>Viaturas</span></a><a><b><UserRound /></b><span>Perfil</span></a></nav>
      </main>
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}
