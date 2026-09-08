import { type ReactNode, useId } from "react";

type WorkspaceTabsProps<T extends string> = {
  label: string;
  tabs: readonly { id: T; label: string }[];
  activeTab: T;
  onChange: (tab: T) => void;
  children: ReactNode;
};

export function WorkspaceTabs<T extends string>({
  label,
  tabs,
  activeTab,
  onChange,
  children
}: WorkspaceTabsProps<T>) {
  const id = useId();

  return (
    <>
      <div className="workspace-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`${id}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${id}-panel`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`ghost-button ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              const nextIndex =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index - 1 + tabs.length) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : null;
              if (nextIndex === null) return;
              const next = tabs[nextIndex];
              if (!next) return;
              event.preventDefault();
              onChange(next.id);
              document.getElementById(`${id}-${next.id}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: The tab panel is the keyboard entry point after its active tab. */}
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeTab}`} tabIndex={0}>
        {children}
      </div>
    </>
  );
}
