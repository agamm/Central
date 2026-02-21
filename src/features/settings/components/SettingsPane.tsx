import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Eye, EyeOff, Check, X, Key, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "../store";

type Category = "api-keys";

function ApiKeysSection() {
  const openRouterKey = useSettingsStore((s) => s.openRouterKey);
  const openRouterKeyValid = useSettingsStore((s) => s.openRouterKeyValid);
  const loading = useSettingsStore((s) => s.loading);
  const error = useSettingsStore((s) => s.error);
  const saveOpenRouterKey = useSettingsStore((s) => s.saveOpenRouterKey);

  const [localKey, setLocalKey] = useState(openRouterKey);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setLocalKey(openRouterKey);
  }, [openRouterKey]);

  const handleSave = useCallback(() => {
    if (localKey.trim()) {
      void saveOpenRouterKey(localKey.trim());
    }
  }, [localKey, saveOpenRouterKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      }
    },
    [handleSave],
  );

  const dirty = localKey !== openRouterKey;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          OpenRouter API Key
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Used for routing requests through OpenRouter. Get a key at{" "}
          <span className="text-muted-foreground/80">openrouter.ai</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={localKey}
            onChange={(e) => { setLocalKey(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder="sk-or-..."
            className="pr-10 font-mono text-xs"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => { setShowKey((prev) => !prev); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showKey ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={loading || !localKey.trim() || !dirty}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>

        {openRouterKeyValid === true && (
          <Check className="h-5 w-5 text-green-500" />
        )}
        {openRouterKeyValid === false && (
          <X className="h-5 w-5 text-red-500" />
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {openRouterKeyValid === false && (
        <p className="text-xs text-red-400">
          Key is invalid or could not be verified.
        </p>
      )}
      {openRouterKeyValid === true && (
        <p className="text-xs text-green-400">Key verified successfully.</p>
      )}
    </div>
  );
}

// Renders settings content for the active category.
// When adding new categories, extend this with a conditional.
function CategoryContent({ category }: { readonly category: Category }) {
  // Currently only one category exists
  void category;
  return <ApiKeysSection />;
}

const CATEGORIES: readonly { readonly id: Category; readonly label: string; readonly icon: typeof Key }[] = [
  { id: "api-keys", label: "API Keys", icon: Key },
] as const;

function SettingsPane() {
  const setShowSettings = useSettingsStore((s) => s.setShowSettings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loading = useSettingsStore((s) => s.loading);

  const [activeCategory, setActiveCategory] = useState<Category>("api-keys");

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleClose = useCallback(() => {
    setShowSettings(false);
  }, [setShowSettings]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleClose}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">Settings</h1>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div
          className="flex w-48 flex-col border-r border-border py-2"
          style={{ backgroundColor: "hsl(0 0% 4%)" }}
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === (cat.id as string);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setActiveCategory(cat.id); }}
                className={`mx-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CategoryContent category={activeCategory} />
          )}
        </div>
      </div>
    </div>
  );
}

export { SettingsPane };
