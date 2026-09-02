const revisionTasks = [
  { topic: "Partnership Accounts", detail: "Revision 2 · Final Accounts", duration: "45 min", state: "Due now", tone: "coral" },
  { topic: "Depreciation", detail: "Revision 3 · Financial Accounting", duration: "30 min", state: "Due today", tone: "amber" },
  { topic: "Trial Balance", detail: "Quick reinforcement", duration: "20 min", state: "Up next", tone: "mint" },
];

const navItems = ["Dashboard", "Revision", "Mock Tests", "Question Bank", "Analytics"];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark">R</div><div><strong>Revision Room</strong><span>Accountant prep</span></div></div>
        <nav className="main-nav" aria-label="Main navigation">{navItems.map((item, index) => <a className={index === 0 ? "nav-item active" : "nav-item"} href={item === "Mock Tests" ? "/mock-tests" : "#"} key={item}><span className="nav-icon">{["⌂", "↻", "◫", "□", "◌"][index]}</span>{item}</a>)}</nav>
        <div className="sidebar-bottom"><a className="nav-item" href="#"><span className="nav-icon">⚙</span>Settings</a><div className="profile-chip"><div className="avatar">N</div><div><strong>Nishant</strong><span>Study profile</span></div><span className="more">···</span></div></div>
      </aside>
      <section className="content-area">
        <header className="topbar"><div><p className="eyebrow">Wednesday, September 5, 2026</p><h1>Good morning, Nishant.</h1></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♧<span className="notification-dot" /></button><button className="outline-button">View schedule <span>→</span></button></div></header>
        <div className="dashboard-grid">
          <section className="welcome-panel panel accent-panel"><div className="panel-kicker">YOUR PREPARATION WINDOW</div><div className="countdown-row"><div><span className="countdown-number">24</span><span className="countdown-label">days until exam</span></div><div className="exam-copy"><strong>Uttarakhand Accountant</strong><span>Accountant Examination · October 29</span></div></div><div className="progress-track"><span style={{ width: "62%" }} /></div><div className="progress-meta"><span>Preparation progress</span><strong>42 of 68 topics revised</strong></div></section>
          <section className="focus-panel panel"><div className="panel-heading"><div><div className="panel-kicker">TODAY&apos;S FOCUS</div><h2>Make today count.</h2></div><span className="date-badge">SEP<br /><strong>05</strong></span></div><p className="focus-note">Three focused sessions will keep your plan moving.</p><div className="mini-stats"><div><strong>2 / 4</strong><span>tasks complete</span></div><div><strong>1h 35m</strong><span>planned today</span></div></div></section>
          <section className="tasks-section"><div className="section-heading"><div><div className="panel-kicker">YOUR PLAN</div><h2>Today&apos;s revision</h2></div><a href="#">See all <span>→</span></a></div><div className="task-list">{revisionTasks.map((task, index) => <article className={`task-row ${index === 0 ? "task-highlight" : ""}`} key={task.topic}><div className={`task-status ${index === 0 ? "checked" : ""}`}>{index === 0 ? "✓" : String(index + 1)}</div><div className="task-info"><strong>{task.topic}</strong><span>{task.detail}</span></div><span className={`task-tone ${task.tone}`}>{task.state}</span><span className="task-duration">{task.duration}</span><button className="start-button">{index === 0 ? "Continue" : "Start"} <span>→</span></button></article>)}</div></section>
          <section className="attention-panel panel"><div className="section-heading"><div><div className="panel-kicker">NEEDS ATTENTION</div><h2>Weak areas</h2></div><a href="#">Analytics <span>→</span></a></div><div className="attention-item"><div className="attention-bar coral-bar" /><div><strong>Partnership Accounts</strong><span>38% accuracy · high attention</span></div><span className="attention-score">38%</span></div><div className="attention-item"><div className="attention-bar amber-bar" /><div><strong>Depreciation</strong><span>54% accuracy · needs review</span></div><span className="attention-score">54%</span></div></section>
          <section className="mock-panel panel"><div className="panel-kicker">LATEST MOCK TEST</div><div className="mock-score-row"><div><span className="mock-score">76<span>%</span></span><span className="mock-label">overall accuracy</span></div><div className="trend-up">↑ 8%<span>since last test</span></div></div><div className="mock-divider" /><div className="mock-footer"><span>Mock Test 03 · Sep 2</span><a href="#">Review result →</a></div></section>
        </div>
      </section>
    </main>
  );
}
