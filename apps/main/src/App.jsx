import WelcomeSplash from "./components/WelcomeSplash.jsx";
import FriendChat from "./components/FriendChat.jsx";
import Onboarding from "./components/Onboarding.jsx";
import WellbeingPage from "./pages/WellbeingPage.jsx";
import "./styles/kitchen.css";
import { useAccountSync, loadAccountSnapshot } from "./hooks/useAccountSync.jsx";
import React, { useCallback, useEffect, useState } from "react";
import { initialState, today, daysLeft, uid, totals } from "./data/food.mjs";
import { upgradeState, getFridgeItems } from "./lib/domain.mjs";
import { refreshDerived } from "./lib/planning.mjs";
import { useAutomaticInventory } from "./hooks/useAutomaticInventory.jsx";
import { useFriendFridges } from "./hooks/useFriendFridges.jsx";
import Icon from "./components/Icon.jsx";
import FoodModal from "./components/FoodModal.jsx";
import InventoryModal from "./components/InventoryModal.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import MealsPage from "./pages/MealsPage.jsx";
import GroceryPage from "./pages/GroceryPage.jsx";
import NutritionPage from "./pages/NutritionPage.jsx";
import CamerasPage from "./pages/CamerasPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import GoalsPage from "./pages/GoalsPage.jsx";
import ChallengesPage from "./pages/ChallengesPage.jsx";
import WrappedPage from "./pages/WrappedPage.jsx";
import MorePage, { featureNav } from "./pages/MorePage.jsx";
const nav = [
  ["home", "Fridge"],
  ["activity", "Today"],
  ["fridge", "Inventory"],
  ["cameras", "Scan"],
  ["meals", "Recipes"],
  ["list", "Grocery"],
  ["profile", "Profile & goals"],
  ["kitchens", "Kitchens"],
  ["challenges", "Compete"],
  ["more", "More"],
];
function KitchensPage(props) {
  const [section, setSection] = useState(props.chatTarget ? "messages" : "connections");
  useEffect(() => { if (props.chatTarget) setSection("messages"); }, [props.chatTarget]);
  return <div className="feature-page"><div className="tabs" aria-label="Kitchens sections">
    <button className={section === "connections" ? "active" : ""} onClick={() => setSection("connections")}>Connections & trades</button>
    <button className={section === "meals" ? "active" : ""} onClick={() => setSection("meals")}>Shared meal plans</button>
    <button className={section === "messages" ? "active" : ""} onClick={() => setSection("messages")}>Messages</button>
    {section === "meals" && <button className="text-btn" onClick={() => props.navigate("challenges")}>This Week’s Leaderboard ↗</button>}
  </div>{section === "connections" ? <InventoryPage {...props} community /> : section === "messages" ? <FriendChat {...props} onMealCollab={() => setSection("meals")} /> : <MealsPage {...props} community />}</div>;
}
function ProfileAndGoals(props) {
  const goals = props.activeProfileTab === "goals";
  return <div className="feature-page profile-goals-page">
    <nav className="profile-goals-tabs" aria-label="Profile and goals">
      <button type="button" aria-current={!goals ? "page" : undefined} onClick={() => props.navigate("profile")}><Icon name="profile" /> Profile</button>
      <button type="button" aria-current={goals ? "page" : undefined} onClick={() => props.navigate("goals")}><Icon name="goals" /> Goals</button>
    </nav>
    {goals ? <GoalsPage {...props} /> : <ProfilePage {...props} />}
  </div>;
}
const mobileNav = [
  ["home", "Fridge"],
  ["activity", "Today"],
  ["fridge", "Inventory"],
  ["list", "Groceries"],
  ["more", "More"],
];
const meta = {
  home: [
    "Your fridge, at a glance.",
    "A place for everything, and something good to make.",
  ],
  kitchens: ["Kitchens", "Connect with friends and family to share your fridge."],
  fridge: ["Inventory", "Food, ownership, and in-person exchanges."],
  meals: [
    "Make a plan. Share a meal.",
    "Ingredient-aware ideas for you and your shared fridges.",
  ],
  list: [
    "Your next shop",
    "Usual foods, measured in grams, ready when stock runs low.",
  ],
  activity: [
    "Your day, nourished.",
    "Logged meals, daily macros, and a closer look at your micronutrients.",
  ],
  cameras: [
    "Two angles. One inventory.",
    "Connect camera phones and enable automatic food-change analysis.",
  ],
  wellbeing: ["Wellbeing & trends", "Small check-ins and a longer view of your recorded habits."],
  profile: [
    "Your profile",
    "Personal details, dietary restrictions, and nutrition references.",
  ],
  goals: [
    "Food goals & taste",
    "Targets and preferences that adapt to your kitchen.",
  ],
  challenges: [
    "Daily challenges",
    "Earn points from recorded actions and compare time periods.",
  ],
  wrapped: [
    "Refridge Wrapped",
    "A monthly picture of your food, nutrients, and cuisines.",
  ],
  more: ["Your kitchen tools", "Everything else, one tap away."],
};
function read(account) {
  const empty = () => {
    const seed = refreshDerived(upgradeState({ ...initialState(), items: [], groceries: [], logs: [] }));
    return { ...seed, profile: { ...seed.profile, name: account.username } };
  };
  try {
    const snapshot = loadAccountSnapshot(account);
    return snapshot && Array.isArray(snapshot.items) && Array.isArray(snapshot.logs) && Array.isArray(snapshot.groceries) && snapshot.goals
      ? refreshDerived(upgradeState(snapshot)) : empty();
  } catch { return empty(); }
}
export default function App({ account, onLogout }) {
  const [state, rawSet] = useState(() => read(account)),
    [page, setPage] = useState("home"),
    [modal, setModal] = useState(null),
    [welcome, setWelcome] = useState(false),
    [incomingMessage, setIncomingMessage] = useState(null),
    [chatTarget, setChatTarget] = useState(null),
    [toast, setToast] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine),
    [signingOut, setSigningOut] = useState(false);
  const setState = useCallback(
    (change) =>
      rawSet((previous) =>
        refreshDerived(
          typeof change === "function" ? change(previous) : change,
        ),
      ),
    [],
  );
  const finishWelcome = useCallback(() => setWelcome(false), []);
  const beginWelcome = useCallback(() => { setPage("home"); setModal(null); setWelcome(true); }, []);
  const syncError = useAutomaticInventory(state, setState);
  const socialError = useFriendFridges(state, setState, setIncomingMessage);
  const cloud = useAccountSync(account, state);
  async function signOut() {
    setSigningOut(true);
    try { await cloud.flush(); await onLogout(); }
    catch (error) { setToast(error.message); }
    finally { setSigningOut(false); }
  }
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const timer = setInterval(() => setState((s) => s), 60000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      clearInterval(timer);
    };
  }, [setState]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const notify = setToast;
  const navigate = (p) => {
    setChatTarget(null);
    setPage(p);
    window.scrollTo(0, 0);
  };
  const addGroceries = (entries) => {
    setState((s) => ({
      ...s,
      groceries: [
        ...s.groceries,
        ...entries
          .map((n) => (typeof n === "string" ? { name: n } : n))
          .filter(
            (n) =>
              !s.groceries.some(
                (g) => g.name.toLowerCase() === n.name.toLowerCase(),
              ),
          )
          .map((n) => ({ id: uid(), checked: false, ...n })),
      ],
    }));
    notify("Grocery list updated");
  };
  const food = getFridgeItems(state),
    soon = food.filter((i) => i.expires && daysLeft(i.expires) <= 2),
    remaining = state.groceries.length;
  const common = { state, setState, navigate, setModal, notify, addGroceries, chatTarget, activeProfileTab: page === "goals" ? "goals" : "profile" };
  const pages = {
    home: OverviewPage,
    wellbeing: WellbeingPage,
    fridge: InventoryPage,
    meals: MealsPage,
    list: GroceryPage,
    activity: NutritionPage,
    cameras: CamerasPage,
    profile: ProfileAndGoals,
    kitchens: KitchensPage,
    goals: ProfileAndGoals,
    challenges: ChallengesPage,
    wrapped: WrappedPage,
    more: MorePage,
  };
  const Page = pages[page] || OverviewPage;
  const avatar = state.profile.avatar ? (
    <img src={state.profile.avatar} alt="" />
  ) : (
    (state.profile.name || "Y")[0]
  );
  if (state.onboarding?.completed === false || (!state.onboarding && !state.profile.complete))
    return <Onboarding state={state} setState={setState} saveStatus={cloud.status} error={cloud.error || toast} onLogout={signOut} signingOut={signingOut} onComplete={beginWelcome} />;
  if (welcome) return <WelcomeSplash onDone={finishWelcome} />;
  return (
    <div className={"app-shell" + (page === "home" ? " home-screen" : "")}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => navigate("home")}>
          <svg
            className="brand-icon"
            viewBox="0 0 80 88"
            width="40"
            height="44"
            fill="none"
            aria-hidden="true"
          >
            <g transform="rotate(-4 40 44)">
              <rect x="3" y="3" width="74" height="82" rx="23" fill="#285c43" />
              <path
                d="M25 25h29v38H25zM25 40h29M31 30v6M31 46v9"
                stroke="#f4f7e6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
          <span>
            Refridge<span className="brand-dot">.</span>
          </span>
        </button>
        <button className="workspace" onClick={() => navigate("profile")}>
          <span className="avatar">{avatar}</span>
          <div>
            <strong>{state.household || `${state.profile.name}'s kitchen`}</strong>
            <small>
              {state.profile.complete
                ? "Profile & dietary preferences"
                : "Set up your profile"}
            </small>
          </div>
        </button>
        <nav aria-label="Kitchen navigation">
          {nav.map(([id, label]) => (
            <React.Fragment key={id}>
            {id === "kitchens" && <div className="sidebar-community-divider" role="separator" aria-label="Community" />}
            <button
              key={id}
              className={"nav-item " + (page === id || (id === "profile" && page === "goals") || (id === "more" && ["wellbeing", "wrapped"].includes(page)) ? "active" : "")}
              aria-current={page === id || (id === "profile" && page === "goals") || (id === "more" && ["wellbeing", "wrapped"].includes(page)) ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon name={id} />
              <span>{label}</span>
              {id === "list" && remaining > 0 && (
                <span className="nav-count">{remaining}</span>
              )}
            </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setModal({ type: "install" })}
          >
            <Icon name="download" />
            <span>Install app</span>
          </button>
          <button
            className="nav-item"
            onClick={() => setModal({ type: "settings" })}
          >
            <Icon name="settings" />
            <span>Export & settings</span>
          </button>
          <button className="nav-item" disabled={signingOut} onClick={signOut}>
            <Icon name="profile" /><span>{signingOut ? "Saving & logging out…" : "Log out"}</span>
          </button>
          <small className="account-save-status" role="status">@{account.username} · {cloud.status}</small>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            My kitchen <span>/</span>
            <strong>{[...nav, ...featureNav].find((n) => n[0] === page)?.[1] || "More"}</strong>
          </div>
          <div className="topbar-right">
            <button className="btn outline header-logout" disabled={signingOut} onClick={signOut}>{signingOut ? "Logging out…" : "Log out"}</button>
            <span className="local-pill">
              {offline ? "Offline" : cloud.status}
            </span>
            <button
              className="profile"
              aria-label="My profile"
              onClick={() => navigate("profile")}
            >
              {avatar}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {state.sampleAccount && page !== "home" && <p className="sample-account-note">Sample account · Food history, wellbeing check-ins, and friend activity are demonstration data.</p>}
          {cloud.error && <div className="error" role="alert">Account sync: {cloud.error} <button type="button" className="text-btn" onClick={() => cloud.flush().catch(() => {})}>Retry save</button></div>}
          {offline && (
            <div className="notice">
              Offline. Saved food and planning tools remain available; camera
              syncing waits for a connection.
            </div>
          )}
          {socialError && (
            <div className="notice" role="status">
              Friend sync: {socialError}
            </div>
          )}
          {syncError && (
            <div className="notice" role="status">
              Camera sync: {syncError}
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow date-line">
                {new Date().toLocaleDateString("en-CA", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1>{meta[page]?.[0]}</h1>
              <p className="subtitle">{meta[page]?.[1]}</p>
            </div>
            {page === "activity" && (
              <button
                className="btn primary"
                onClick={() => setModal({ type: "outside" })}
              >
                Log food eaten out
              </button>
            )}
          </div>
          <Page
            {...common}
            food={food}
            soon={soon}
            remaining={remaining}
            nutrients={totals(
              state.logs.filter((l) => (l.userId || "me") === "me"),
            )}
          />
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Main navigation">
        {mobileNav.map(([id, label]) => (
          <button
            className={
              page === id ||
              (id === "more" && !mobileNav.some((n) => n[0] === page))
                ? "active"
                : ""
            }
            key={id}
            onClick={() => navigate(id)}
          >
            <Icon name={id} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {incomingMessage && <div className="incoming-message-toast" role="status">
        <button className="incoming-message-open" onClick={() => {
          navigate("kitchens"); setChatTarget({ friendId: incomingMessage.friendId, requestId: incomingMessage.id }); setIncomingMessage(null); setModal(null);
        }}><Icon name="bell" size={19} /><span><strong>{incomingMessage.friendName}</strong><small>New message · Open conversation</small><span className="incoming-message-preview">{incomingMessage.text}</span></span></button>
        <button className="incoming-message-dismiss" aria-label="Dismiss message notification" onClick={() => setIncomingMessage(null)}><Icon name="close" size={16} /></button>
      </div>}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {modal &&
        (["add", "edit"].includes(modal.type) ? (
          <InventoryModal
            model={modal}
            close={() => setModal(null)}
            {...common}
          />
        ) : (
          <FoodModal model={modal} close={() => setModal(null)} {...common} />
        ))}
    </div>
  );
}
