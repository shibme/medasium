import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePref } from '@/lib/theme';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu';

export function ThemeToggle() {
  const { pref, resolved, setPref } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${pref}`}>
          {resolved === 'dark' ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[10rem]">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={pref} onValueChange={(v) => setPref(v as ThemePref)}>
          <DropdownMenuRadioItem value="system"><Monitor />System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
