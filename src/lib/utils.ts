import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RANKINGS = [
  { name: 'Quantum Starter', minVolume: 0, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { name: 'Quantum Pro', minVolume: 10000, color: 'text-green-400', bg: 'bg-green-400/10' },
  { name: 'Quantum Professional', minVolume: 50000, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { name: 'Quantum Elite', minVolume: 250000, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { name: 'Quantum Apex', minVolume: 1000000, color: 'text-yellow-400', bg: 'bg-yellow-400/10' }
];

export function getRank(volume: number = 0) {
  return [...RANKINGS].reverse().find(r => volume >= r.minVolume) || RANKINGS[0];
}

export function getLogo(symbol: string) {
  const cleanSymbol = symbol.split('/')[0].toLowerCase();
  // Using high-quality crypto icon repository
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${cleanSymbol}.png`;
}
