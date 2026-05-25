import { useState } from "react";
import { OrganizePage } from "./pages/OrganizePage";
import { RulesPage } from "./pages/RulesPage";
import { AISettingsPage } from "./pages/AISettingsPage";
import { HelpPage } from "./pages/HelpPage";

type TabId = "organize" | "rules" | "ai" | "help";

const TABS: { id: TabId; label: string }[] = [
  { id: "organize", label: "整理" },
  { id: "rules", label: "规则" },
  { id: "ai", label: "AI" },
  { id: "help", label: "帮助" },
];

export default function App() {
  const [tab, setTab] = useState<TabId>("organize");

  return (
    <main className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Bookmark Organizer</h1>
          <span className="version-badge">v{chrome.runtime.getManifest().version}</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? " tab--active" : ""}`}
              onClick={() => setTab(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <section className="app-content">
        {tab === "organize" && <OrganizePage />}
        {tab === "rules" && <RulesPage />}
        {tab === "ai" && <AISettingsPage />}
        {tab === "help" && <HelpPage />}
      </section>
    </main>
  );
}
