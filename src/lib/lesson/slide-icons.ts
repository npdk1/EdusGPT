/**
 * The allowed icon names, resolved to components.
 *
 * A hand-written map rather than a lookup on the `lucide-react` namespace,
 * because the namespace is a ~1500-export bundle and naming it dynamically is
 * exactly what a bundler cannot tree-shake. The map mirrors `SLIDE_ICON_SETS`,
 * and `scripts/check-icons.mjs` fails if the two ever drift apart, so adding an
 * icon is a one-line change in the set plus one import here.
 */
import {
  Activity, ArrowRight, Atom, Banknote, BarChart3, Binary, Bone, BookOpen,
  Brain, Braces, Briefcase, Brush, Bug, Building, Building2, Calculator,
  Camera, CircleCheck, Clapperboard, Clock, Cloud, Code2, Compass, Cpu,
  Database, Dna, Drama, Eye, Factory, FileCode2, Film, Flag, FlaskConical,
  FunctionSquare, Gauge, Gavel, GitBranch, Globe2, Grid3x3, HandCoins,
  Handshake, HeartPulse, KeyRound, Landmark, Layers, Leaf, Lightbulb, LineChart,
  Lock, Magnet, Map, MapPin, Microscope, Music, Network, Orbit, Palette,
  PawPrint, PenTool, Percent, PiggyBank, PieChart, Receipt, Repeat, Rocket,
  Ruler, Salad, Scale, ScrollText, Search, Server, Shapes, ShoppingCart, Sigma,
  Sparkles, Sprout, Star, Sun, Target, Telescope, Terminal, Thermometer,
  TrendingUp, Trees, Users, Vote, Waves, Wifi, Zap, type LucideIcon,
} from "lucide-react";

export const SLIDE_ICONS: Record<string, LucideIcon> = {
  Activity, ArrowRight, Atom, Banknote, BarChart3, Binary, Bone, BookOpen,
  Brain, Braces, Briefcase, Brush, Bug, Building, Building2, Calculator,
  Camera, CircleCheck, Clapperboard, Clock, Cloud, Code2, Compass, Cpu,
  Database, Dna, Drama, Eye, Factory, FileCode2, Film, Flag, FlaskConical,
  FunctionSquare, Gauge, Gavel, GitBranch, Globe2, Grid3x3, HandCoins,
  Handshake, HeartPulse, KeyRound, Landmark, Layers, Leaf, Lightbulb, LineChart,
  Lock, Magnet, Map, MapPin, Microscope, Music, Network, Orbit, Palette,
  PawPrint, PenTool, Percent, PiggyBank, PieChart, Receipt, Repeat, Rocket,
  Ruler, Salad, Scale, ScrollText, Search, Server, Shapes, ShoppingCart, Sigma,
  Sparkles, Sprout, Star, Sun, Target, Telescope, Terminal, Thermometer,
  TrendingUp, Trees, Users, Vote, Waves, Wifi, Zap,
};

/**
 * The icon a scene asked for, or nothing.
 *
 * Returns `null` rather than a fallback: a slide with no icon is still a
 * complete slide, and drawing a random one to fill the gap is the thing this
 * whole allow-list exists to prevent.
 */
export function slideIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  return SLIDE_ICONS[name] ?? null;
}
