import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const OPTIONS: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Tema claro" },
  { value: "dark", icon: Moon, label: "Tema escuro" },
  { value: "system", icon: Monitor, label: "Automático" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-sidebar-accent/30 border border-white/5">
        {OPTIONS.map(({ value, icon: Icon, label }) => {
          const active = theme === value;
          return (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-label={label}
                  className={cn(
                    "flex-1 flex items-center justify-center h-8 rounded-md transition-all duration-200",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
